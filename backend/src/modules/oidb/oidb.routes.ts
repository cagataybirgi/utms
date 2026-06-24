import { Router } from "express";
import { OidbController } from "./oidb.controller";
import { OidbService } from "./oidb.service";
import { OidbDocumentsService } from "./oidb-documents.service";
import { AppContainer } from "../../shared/container";
import { AuditLogger, NotificationService } from "../../shared/audit";
import { requireRoles } from "../../shared/middleware/rbac";
import { UserRole } from "../../shared/types";
import { asyncHandler } from "../../shared/middleware/async-handler";
import {
  IAsyncApplicationRepository,
  IAsyncDocumentRepository,
  InMemoryAsyncApplicationRepository,
  InMemoryAsyncDocumentRepository,
  PrismaApplicationRepository,
  PrismaDocumentRepository,
} from "../../shared/repositories";

export function buildOidbRouter(container: AppContainer): Router {
  const audit = new AuditLogger(container.audit);
  const notifications = new NotificationService(container.notifications);

  // Runtime reads/writes applications AND documents from Neon (Prisma) so the
  // ÖİDB pool sees live student submissions and Dean → ÖİDB returns, and the
  // detail view shows documents a live student actually uploaded. Tests use the
  // in-memory container (NODE_ENV=test).
  const useDatabase = process.env.NODE_ENV !== "test";
  const applications: IAsyncApplicationRepository = useDatabase
    ? new PrismaApplicationRepository()
    : new InMemoryAsyncApplicationRepository(container.applications);
  const documents: IAsyncDocumentRepository = useDatabase
    ? new PrismaDocumentRepository()
    : new InMemoryAsyncDocumentRepository(container.documents);

  const service = new OidbService({
    applications,
    documents,
    users: container.users,
    edevlet: container.edevlet,
    audit,
    notifications,
  });
  const controller = new OidbController(service, new OidbDocumentsService());

  const r = Router();
  r.use(requireRoles(UserRole.OidbOfficer, UserRole.SystemAdmin));

  r.get("/applications", asyncHandler(controller.listPool));
  r.get("/applications/:applicationId", asyncHandler(controller.getDetail));
  r.get(
    "/applications/:applicationId/documents/:documentType/file",
    asyncHandler(controller.getDocumentFile),
  );
  r.post("/applications/:applicationId/verify", asyncHandler(controller.verify));
  r.post("/applications/:applicationId/return", asyncHandler(controller.returnForCorrection));
  r.post("/applications/:applicationId/reject", asyncHandler(controller.reject));
  r.post("/applications/:applicationId/forward", asyncHandler(controller.forward));

  return r;
}
