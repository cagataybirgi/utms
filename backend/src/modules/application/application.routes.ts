import { Router, Request, Response, NextFunction } from "express";
import { requireRoles } from "../../shared/middleware/rbac";
import { UserRole } from "../../shared/types";
import { UnauthorizedError, ValidationError } from "../../shared/errors";
import { ApplicationService } from "./application.service";

export function buildApplicationRouter(): Router {
  const service = new ApplicationService();
  const r = Router();

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
      } = req.body;

      if (!studentTckn || !targetDepartmentId || !targetSemester || !submittedGpa) {
        throw new ValidationError("studentTckn, targetDepartmentId, targetSemester, and submittedGpa are required.");
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
      });

      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
