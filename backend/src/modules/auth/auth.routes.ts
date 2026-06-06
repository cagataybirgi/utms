import { Router } from "express";
import { AppContainer } from "../../shared/container";
import { asyncHandler } from "../../shared/middleware/async-handler";
import {
  InMemoryAuthRepository,
  PrismaAuthRepository,
} from "../../shared/repositories/auth-repositories";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

// Scenario 1 — Login to UTMS. Pre-authentication endpoints (no x-mock-user).
// Runtime persists auth state in Neon (Prisma); Jest keeps the in-memory path.
export function buildAuthRouter(container: AppContainer): Router {
  const useDatabase = process.env.NODE_ENV !== "test";
  const authRepo = useDatabase
    ? new PrismaAuthRepository()
    : new InMemoryAuthRepository(container);

  const service = new AuthService({ auth: authRepo, audit: container.audit });
  const controller = new AuthController(service);

  const r = Router();
  r.post("/login", asyncHandler(controller.login));
  r.post("/forgot-password", asyncHandler(controller.forgotPassword));
  r.post("/reset-password", asyncHandler(controller.resetPassword));

  return r;
}
