import { Router } from "express";
import { AppContainer } from "../../shared/container";
import { AuditLogger, NotificationService } from "../../shared/audit";
import { requireRoles } from "../../shared/middleware/rbac";
import { asyncHandler } from "../../shared/middleware/async-handler";
import { UserRole } from "../../shared/types";
import {
  IAsyncApplicationRepository,
  IAsyncBoardReviewStateRepository,
  IAsyncPackageRepository,
  InMemoryAsyncApplicationRepository,
  InMemoryAsyncBoardReviewStateRepository,
  InMemoryAsyncPackageRepository,
  PrismaApplicationRepository,
  PrismaBoardReviewStateRepository,
  PrismaPackageRepository,
} from "../../shared/repositories";
import { BoardService } from "./board.service";
import { BoardController } from "./board.controller";
import { INotificationStore } from "../notification/notification.store";
import { createNotificationStore } from "../notification/notification.routes";

export function buildBoardRouter(
  container: AppContainer,
  notificationStore: INotificationStore = createNotificationStore(container),
): Router {
  // Runtime persists applications, packages and board states to Neon (Prisma).
  // Tests run against the in-memory container (NODE_ENV=test).
  const useDatabase = process.env.NODE_ENV !== "test";
  const applications: IAsyncApplicationRepository = useDatabase
    ? new PrismaApplicationRepository()
    : new InMemoryAsyncApplicationRepository(container.applications);
  const packages: IAsyncPackageRepository = useDatabase
    ? new PrismaPackageRepository()
    : new InMemoryAsyncPackageRepository(container.packages);
  const boardStates: IAsyncBoardReviewStateRepository = useDatabase
    ? new PrismaBoardReviewStateRepository()
    : new InMemoryAsyncBoardReviewStateRepository(container.boardStates);

  const audit = new AuditLogger(container.audit);
  const notifications = new NotificationService(container.notifications);
  const service = new BoardService({
    applications,
    intibakTables: container.intibakTables,
    packages,
    boardStates,
    audit,
    notifications,
    notificationStore,
  });
  const controller = new BoardController(service);

  const r = Router();

  // The Faculty Board endpoints are gated to board members and admins.
  // The Dean signature endpoints are reachable to dean's office staff too.
  // Read-only package views are widened so Dean (pre-signature) and ÖİDB
  // (pre-publish) can also see the package without needing duplicate routes.
  const boardRoles = requireRoles(
    UserRole.FacultyBoardMember,
    UserRole.SystemAdmin,
  );
  const signatureRoles = requireRoles(
    UserRole.DeansOfficeStaff,
    UserRole.FacultyBoardMember,
    UserRole.SystemAdmin,
  );
  const packageViewerRoles = requireRoles(
    UserRole.DeansOfficeStaff,
    UserRole.FacultyBoardMember,
    UserRole.OidbOfficer,
    UserRole.SystemAdmin,
  );

  // ── Queue / detail ────────────────────────────────────────────────────────
  r.get("/packages", packageViewerRoles, asyncHandler(controller.listQueue));
  r.get(
    "/packages/:packageId",
    packageViewerRoles,
    asyncHandler(controller.getDetail),
  );

  // ── TC-7B ─────────────────────────────────────────────────────────────────
  r.get(
    "/packages/:packageId/intibak-check",
    packageViewerRoles,
    asyncHandler(controller.intibakCompleteness),
  );
  r.post(
    "/packages/:packageId/return-to-ygk",
    signatureRoles,
    asyncHandler(controller.returnToYgkForClarification),
  );

  // ── 702-HASH ──────────────────────────────────────────────────────────────
  r.get(
    "/packages/:packageId/hash-check",
    packageViewerRoles,
    asyncHandler(controller.hashCheck),
  );
  r.post(
    "/packages/:packageId/clear-hash-lock",
    requireRoles(UserRole.SystemAdmin),
    asyncHandler(controller.clearHashLock),
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
    asyncHandler(controller.verifySignature),
  );

  // ── TC-7A / TC-7E ─────────────────────────────────────────────────────────
  r.post(
    "/packages/:packageId/board-decision",
    boardRoles,
    asyncHandler(controller.boardDecision),
  );
  r.post(
    "/packages/:packageId/confirm-for-publication",
    boardRoles,
    asyncHandler(controller.confirmForPublication),
  );

  // ── TC-571-NOTIFY ─────────────────────────────────────────────────────────
  r.post(
    "/packages/:packageId/publish",
    requireRoles(UserRole.OidbOfficer, UserRole.SystemAdmin),
    asyncHandler(controller.publish),
  );

  return r;
}
