import { Router } from "express";
import { AppContainer } from "../../shared/container";
import { AuditLogger, NotificationService } from "../../shared/audit";
import { requireRoles } from "../../shared/middleware/rbac";
import { UserRole } from "../../shared/types";
import { asyncHandler } from "../../shared/middleware/async-handler";
import {
  IAsyncApplicationRepository,
  InMemoryAsyncApplicationRepository,
  PrismaApplicationRepository,
} from "../../shared/repositories";
import { YdyoService } from "./ydyo.service";
import { YdyoController } from "./ydyo.controller";

export function buildYdyoRouter(container: AppContainer): Router {
  const audit = new AuditLogger(container.audit);
  const notifications = new NotificationService(container.notifications);

  // Runtime reads/writes applications from Neon (Prisma) so the YDYO queue sees
  // the apps ÖİDB forwards (IN_REVIEW_YDYO) and its decisions persist to the
  // same store the Dean/YGK steps read from. Tests use the in-memory container
  // (NODE_ENV=test).
  const useDatabase = process.env.NODE_ENV !== "test";
  const applications: IAsyncApplicationRepository = useDatabase
    ? new PrismaApplicationRepository()
    : new InMemoryAsyncApplicationRepository(container.applications);

  const service = new YdyoService({
    applications,
    documents: container.documents,
    audit,
    notifications,
  });
  const controller = new YdyoController(service);

  const r = Router();
  r.use(requireRoles(UserRole.YdyoOfficer, UserRole.SystemAdmin));

  r.get("/queue", asyncHandler(controller.listQueue));
  r.get("/:applicationId", asyncHandler(controller.getDetail));
  r.post("/:applicationId/decision", asyncHandler(controller.decide));

  return r;
}
