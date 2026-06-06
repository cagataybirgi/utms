import { Router, Request, Response } from "express";
import { requireRoles } from "../../shared/middleware/rbac";
import { UserRole, ApplicationStatus } from "../../shared/types";
import { AppContainer } from "../../shared/container";
import { NotFoundError, ValidationError, UnauthorizedError } from "../../shared/errors";
import { AuditLogger } from "../../shared/audit/audit-logger";
import { asyncHandler } from "../../shared/middleware/async-handler";
import {
  IAsyncApplicationRepository,
  InMemoryAsyncApplicationRepository,
  PrismaApplicationRepository,
} from "../../shared/repositories";

export function buildDeanRouter(container: AppContainer): Router {
  const r = Router();
  const audit = new AuditLogger(container.audit);

  // Runtime reads/writes from Neon (Prisma) so the Dean → YGK handoff stays in
  // the same store the ranking queue reads from. Tests use the in-memory
  // container (NODE_ENV=test).
  const useDatabase = process.env.NODE_ENV !== "test";
  const applications: IAsyncApplicationRepository = useDatabase
    ? new PrismaApplicationRepository()
    : new InMemoryAsyncApplicationRepository(container.applications);

  const requireUser = (req: Request) => {
    if (!req.authUser) throw new UnauthorizedError();
    return req.authUser;
  };

  // GET /api/dean/queue — Dean kuyruğu (PENDING_DEANS_OFFICE_REVIEW)
  r.get(
    "/queue",
    requireRoles(UserRole.DeansOfficeStaff, UserRole.SystemAdmin),
    asyncHandler(async (req: Request, res: Response) => {
      requireUser(req);
      const apps = (await applications.findAll())
        .filter((a) => a.currentStatus === ApplicationStatus.PendingDeansOfficeReview)
        .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

      res.json({
        applications: apps.map((a) => ({
          applicationId: a.applicationId,
          studentFullName: a.studentFullName,
          studentTckn: a.studentTckn,
          targetDepartmentId: a.targetDepartmentId,
          targetFacultyId: a.targetFacultyId,
          targetSemester: a.targetSemester,
          submittedGpa: a.submittedGpa,
          submittedYksScore: a.submittedYksScore,
          currentStatus: a.currentStatus,
          submittedAt: a.submittedAt,
          ydyoExempt: a.ydyoExempt,
          preScreening: a.preScreening,
          currentInstitution: a.currentInstitution,
          currentDepartment: a.currentDepartment,
        })),
        count: apps.length,
      });
    })
  );

  // POST /api/dean/:applicationId/forward-to-ygk — YGK'ya İlet
  r.post(
    "/:applicationId/forward-to-ygk",
    requireRoles(UserRole.DeansOfficeStaff, UserRole.SystemAdmin),
    asyncHandler(async (req: Request, res: Response) => {
      const actor = requireUser(req);
      const { applicationId } = req.params;

      const app = await applications.findById(applicationId);
      if (!app) throw new NotFoundError(`Application ${applicationId} not found`);

      if (app.currentStatus !== ApplicationStatus.PendingDeansOfficeReview) {
        throw new ValidationError(
          `Application must be in PENDING_DEANS_OFFICE_REVIEW. Current: ${app.currentStatus}`
        );
      }

      // Fakülte uyuşmazlığı kontrolü
      if (actor.facultyId && app.targetFacultyId !== actor.facultyId) {
        throw new ValidationError(
          `Faculty mismatch: application targets ${app.targetFacultyId} but you are assigned to ${actor.facultyId}`
        );
      }

      app.currentStatus = ApplicationStatus.InReviewYgk;
      await applications.save(app);

      audit.write({
        actorUserId: actor.userId,
        actorRole: UserRole.DeansOfficeStaff,
        actionType: "FORWARDED_TO_YGK",
        affectedEntityId: applicationId,
        affectedEntityType: "Application",
        previousValue: JSON.stringify({ status: ApplicationStatus.PendingDeansOfficeReview }),
        newValue: JSON.stringify({ status: ApplicationStatus.InReviewYgk }),
      });

      res.json({ message: "Başvuru YGK'ya iletildi.", applicationId, status: "IN_REVIEW_YGK" });
    })
  );

  // POST /api/dean/:applicationId/return-to-oidb — ÖİDB'ye İade
  r.post(
    "/:applicationId/return-to-oidb",
    requireRoles(UserRole.DeansOfficeStaff, UserRole.SystemAdmin),
    asyncHandler(async (req: Request, res: Response) => {
      const actor = requireUser(req);
      const { applicationId } = req.params;
      const { note } = req.body;

      if (!note || !String(note).trim()) {
        throw new ValidationError("İade etmeden önce not girmelisiniz.");
      }

      const app = await applications.findById(applicationId);
      if (!app) throw new NotFoundError(`Application ${applicationId} not found`);

      if (app.currentStatus !== ApplicationStatus.PendingDeansOfficeReview) {
        throw new ValidationError(
          `Application must be in PENDING_DEANS_OFFICE_REVIEW. Current: ${app.currentStatus}`
        );
      }

      app.currentStatus = ApplicationStatus.IntakeVerified;
      app.rejectionReason = String(note).trim();
      await applications.save(app);

      audit.write({
        actorUserId: actor.userId,
        actorRole: UserRole.DeansOfficeStaff,
        actionType: "RETURNED_TO_OIDB",
        affectedEntityId: applicationId,
        affectedEntityType: "Application",
        previousValue: JSON.stringify({ status: ApplicationStatus.PendingDeansOfficeReview }),
        newValue: JSON.stringify({ status: ApplicationStatus.IntakeVerified, note }),
      });

      res.json({ message: "Başvuru ÖİDB'ye iade edildi.", applicationId });
    })
  );

  return r;
}
