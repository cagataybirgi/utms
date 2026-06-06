import { Router } from "express";
import { AppContainer } from "../../shared/container";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

// Scenario 1 — Login to UTMS. These endpoints are pre-authentication, so the
// router is mounted BEFORE the mock-auth middleware (no x-mock-user required).
export function buildAuthRouter(container: AppContainer): Router {
  const service = new AuthService(container);
  const controller = new AuthController(service);

  const r = Router();
  r.post("/login", controller.login);
  r.post("/forgot-password", controller.forgotPassword);
  r.post("/reset-password", controller.resetPassword);

  return r;
}
