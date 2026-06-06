import { Router } from "express";
import { AppContainer } from "../../shared/container";
import { AuditLogger, NotificationService } from "../../shared/audit";
import { requireRoles } from "../../shared/middleware/rbac";
import { asyncHandler } from "../../shared/middleware/async-handler";
import { UserRole } from "../../shared/types";
import {
  IAsyncApplicationRepository,
  InMemoryAsyncApplicationRepository,
  PrismaApplicationRepository,
} from "../../shared/repositories";
import { BoardService } from "./board.service";
import { BoardController } from "./board.controller";

export function buildBoardRouter(container: AppContainer): Router {
  // Runtime reads/writes against Neon (Prisma) so the Board sees the same
  // application data that Dean/YGK wrote. Tests run against the in-memory
  // container (NODE_ENV=test) so the existing HTTP fixtures keep working.
  const useDatabase = process.env.NODE_ENV !== "test";
  const applications: IAsyncApplicationRepository = useDatabase
    ? new PrismaApplicationRepository()
    : new InMemoryAsyncApplicationRepository(container.applications);

  const audit = new AuditLogger(container.audit);
  const notifications = new NotificationService(container.notifications);
  const service = new BoardService({
    applications,
    intibakTables: container.intibakTables,
    packages: container.packages,
    boardStates: container.boardStates,
    audit,
    notifications,
  });
  const controller = new BoardController(service);

  const r = Router();

  // The Faculty Board endpoints are gated to board members and admins.
  // The Dean signature endpoints are reachable to dean's office staff too.
  const boardRoles = requireRoles(
    UserRole.FacultyBoardMember,
    UserRole.SystemAdmin,
  );
  const signatureRoles = requireRoles(
    UserRole.DeansOfficeStaff,
    UserRole.FacultyBoardMember,
    UserRole.SystemAdmin,
  );

  // ── Queue / detail ────────────────────────────────────────────────────────
  r.get("/packages", boardRoles, controller.listQueue);
  r.get("/packages/:packageId", boardRoles, controller.getDetail);

  // ── TC-7B ─────────────────────────────────────────────────────────────────
  r.get(
    "/packages/:packageId/intibak-check",
    boardRoles,
    asyncHandler(controller.intibakCompleteness),
  );

  // ── 702-HASH ──────────────────────────────────────────────────────────────
  r.get(
    "/packages/:packageId/hash-check",
    boardRoles,
    controller.hashCheck,
  );
  r.post(
    "/packages/:packageId/clear-hash-lock",
    requireRoles(UserRole.SystemAdmin),
    controller.clearHashLock,
  );

  // ── TC-7C ─────────────────────────────────────────────────────────────────
  r.post(
    "/signatures/issue",
    signatureRoles,
    controller.issueSignatureToken,
  );
  r.post(
    "/packages/:packageId/verify-signature",
    signatureRoles,
    controller.verifySignature,
  );

  // ── TC-7A / TC-7E ─────────────────────────────────────────────────────────
  r.post(
    "/packages/:packageId/board-decision",
    boardRoles,
    asyncHandler(controller.boardDecision),
  );

  // ── TC-571-NOTIFY ─────────────────────────────────────────────────────────
  r.post(
    "/packages/:packageId/publish",
    requireRoles(UserRole.OidbOfficer, UserRole.SystemAdmin),
    asyncHandler(controller.publish),
  );

  return r;
}
