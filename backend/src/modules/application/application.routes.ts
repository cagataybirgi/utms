import { Router, Request, Response, NextFunction } from "express";
import { requireRoles } from "../../shared/middleware/rbac";
import { UserRole } from "../../shared/types";
import { UnauthorizedError, ValidationError } from "../../shared/errors";
import { ApplicationService } from "./application.service";

export function buildApplicationRouter(): Router {
  const service = new ApplicationService();
  const r = Router();

  r.get("/", requireRoles(UserRole.Student, UserRole.SystemAdmin), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.authUser) throw new UnauthorizedError();
      const apps = await service.listByStudent(req.authUser.userId);
      res.json(apps);
    } catch (e) {
      next(e);
    }
  });

  r.post("/", requireRoles(UserRole.Student, UserRole.SystemAdmin), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.authUser) throw new UnauthorizedError();

      const {
        studentTckn,
        studentFullName,
        periodId,
        targetDepartmentId,
        targetFacultyId,
        transferType,
        targetSemester,
        submittedGpa,
        submittedYksScore,
        yksExamYear,
        currentInstitution,
        currentDepartment,
        isDraft,
      } = req.body;

      if (!studentTckn) {
        throw new ValidationError("studentTckn is required.");
      }
      if (!isDraft && (!targetDepartmentId || !targetSemester || !submittedGpa)) {
        throw new ValidationError("targetDepartmentId, targetSemester, and submittedGpa are required for submission.");
      }

      const result = await service.create(req.authUser.userId, {
        studentTckn,
        studentFullName: studentFullName ?? req.authUser.fullName,
        periodId: periodId ?? "period-spring-2026",
        targetDepartmentId,
        targetFacultyId: targetFacultyId ?? "faculty-engineering",
        transferType: transferType ?? "HORIZONTAL",
        targetSemester: Number(targetSemester),
        submittedGpa: Number(submittedGpa),
        submittedYksScore: submittedYksScore ? Number(submittedYksScore) : undefined,
        yksExamYear: yksExamYear ? Number(yksExamYear) : undefined,
        currentInstitution,
        currentDepartment,
        isDraft: isDraft === true,
      });

      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  });

  r.delete("/:applicationId", requireRoles(UserRole.Student, UserRole.SystemAdmin), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.authUser) throw new UnauthorizedError();
      await service.cancel(req.authUser.userId, req.params.applicationId);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  });

  return r;
}
