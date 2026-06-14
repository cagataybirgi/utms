import { Router } from "express";
import { AppContainer } from "../../shared/container";
import { AuditLogger, NotificationService } from "../../shared/audit";
import { requireRoles } from "../../shared/middleware/rbac";
import { UserRole } from "../../shared/types";
import { YdyoService } from "./ydyo.service";
import { YdyoController } from "./ydyo.controller";

export function buildYdyoRouter(container: AppContainer): Router {
  const audit = new AuditLogger(container.audit);
  const notifications = new NotificationService(container.notifications);
  const service = new YdyoService({
    applications: container.applications,
    documents: container.documents,
    audit,
    notifications,
  });
  const controller = new YdyoController(service);

  const r = Router();
  r.use(requireRoles(UserRole.YdyoOfficer, UserRole.SystemAdmin));

  r.get("/queue", controller.listQueue);
  r.get("/:applicationId", controller.getDetail);
  r.post("/:applicationId/decision", controller.decide);

  return r;
}
