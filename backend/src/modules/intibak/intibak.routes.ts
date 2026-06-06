import { Router } from "express";
import { AppContainer } from "../../shared/container";
import { AuditLogger } from "../../shared/audit";
import { requireRoles } from "../../shared/middleware/rbac";
import { asyncHandler } from "../../shared/middleware/async-handler";
import { UserRole } from "../../shared/types";
import {
  IAsyncApplicationRepository,
  InMemoryAsyncApplicationRepository,
  PrismaApplicationRepository,
} from "../../shared/repositories";
import { IntibakService } from "./intibak.service";
import { IntibakController } from "./intibak.controller";

export function buildIntibakRouter(container: AppContainer): Router {
  // Runtime reads/writes the Scenario 5 ranking results (rankingCategory, status)
  // from Neon (Prisma) so Intibak can see Asil applicants. Tests run against the
  // in-memory container so the existing HTTP fixtures keep working unchanged.
  // Jest sets NODE_ENV=test; dev/prod leave it as development/production.
  const useDatabase = process.env.NODE_ENV !== "test";
  const applications: IAsyncApplicationRepository = useDatabase
    ? new PrismaApplicationRepository()
    : new InMemoryAsyncApplicationRepository(container.applications);

  const audit = new AuditLogger(container.audit);
  const service = new IntibakService({
    applications,
    documents: container.documents,
    intibakTables: container.intibakTables,
    curriculum: container.curriculum,
    packages: container.packages,
    boardStates: container.boardStates,
    ocr: container.ocr,
    audit,
  });
  const controller = new IntibakController(service);

  const r = Router();
  r.use(requireRoles(UserRole.YgkMember, UserRole.YgkChair, UserRole.SystemAdmin));

  r.get("/department-overview", asyncHandler(controller.overview));
  r.get("/intibak/candidates", asyncHandler(controller.candidates));
  r.post("/intibak/:applicationId/prepare", asyncHandler(controller.prepare));
  r.post("/intibak/:applicationId/courses", asyncHandler(controller.addManualCourse));
  r.post("/intibak/:applicationId/regenerate-suggestions", asyncHandler(controller.generateSuggestions));
  r.patch("/intibak/:applicationId/mappings", asyncHandler(controller.updateMappings));
  r.post("/intibak/:applicationId/not-exempt", asyncHandler(controller.markNotExempt));
  r.post("/intibak/:applicationId/save", asyncHandler(controller.save));
  r.post(
    "/package/send",
    requireRoles(UserRole.YgkChair, UserRole.SystemAdmin),
    asyncHandler(controller.sendPackage),
  );

  return r;
}
