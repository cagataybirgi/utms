import { Router } from "express";
import { requireRoles } from "../../shared/middleware/rbac";
import { UserRole } from "../../shared/types";
import { RankingService } from "./ranking.service";
import { RankingController } from "./ranking.controller";
import { AuditLogger } from "../../shared/audit/audit-logger";
import { AppContainer } from "../../shared/container";

export function buildRankingRouter(container: AppContainer): Router {
  const audit = new AuditLogger(container.audit);
  const service = new RankingService({
    applications: container.applications,
    audit,
  });
  const controller = new RankingController(service);
  const r = Router();

  /**
   * POST /api/ranking/execute
   * Execute ranking for a department/period
   * Requires: YGK Chair role
   */
  r.post(
    "/execute",
    requireRoles(UserRole.YgkChair, UserRole.SystemAdmin),
    controller.execute
  );

  /**
   * GET /api/ranking/:departmentId/:periodId/results
   * Get ranking results for a department/period
   * Requires: YGK Member or higher
   */
  r.get(
    "/:departmentId/:periodId/results",
    requireRoles(
      UserRole.YgkMember,
      UserRole.YgkChair,
      UserRole.DeansOfficeStaff,
      UserRole.SystemAdmin
    ),
    controller.getResults
  );

  /**
   * GET /api/ranking/:departmentId/:periodId/overview
   * Get department ranking overview (stats for dashboard)
   * Requires: YGK Member or higher
   */
  r.get(
    "/:departmentId/:periodId/overview",
    requireRoles(
      UserRole.YgkMember,
      UserRole.YgkChair,
      UserRole.DeansOfficeStaff,
      UserRole.SystemAdmin
    ),
    controller.getOverview
  );

  return r;
}
