import express, { Express, NextFunction, Request, Response } from "express";
import { AppContainer, createContainer, resetContainer } from "./shared/container";
import { mockAuthMiddleware } from "./shared/middleware/mock-auth";
import { errorHandler } from "./shared/middleware/error-handler";
import { buildOidbRouter } from "./modules/oidb/oidb.routes";
import { buildIntibakRouter } from "./modules/intibak/intibak.routes";
import { buildDocumentUploadRouter } from "./modules/document-upload/document-upload.routes";
import { buildApplicationRouter } from "./modules/application/application.routes";
import { buildRankingRouter } from "./modules/ranking/ranking.routes";
import { buildDeanRouter } from "./modules/dean/dean.routes";
import { buildAuthRouter } from "./modules/auth/auth.routes";
import { buildPeriodRouter } from "./modules/period/period.routes";
import { buildBoardRouter } from "./modules/board/board.routes";
import { buildProfileRouter } from "./modules/profile/profile.routes";

export interface CreateAppOptions {
  container?: AppContainer;
}

export function createApp(options: CreateAppOptions = {}): { app: Express; container: AppContainer } {
  const container = options.container ?? createContainer();
  const app = express();

  // CORS — allow any origin so the frontend Vercel domain can call this backend.
  // ALLOWED_ORIGIN env var can restrict to a specific domain in production.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin ?? "*";
    res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN ?? origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-mock-user");
    if (req.method === "OPTIONS") { res.status(204).end(); return; }
    next();
  });

  app.use(express.json({ limit: "12mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", scope: "Scenario 1 (Login) & Scenario 3 (Document Upload) & Scenario 4 (OIDB) & Scenario 5 (Ranking) & Scenario 6 (Intibak)" });
  });

  // DEV-ONLY: reset in-memory state (auth locks, reset tokens, rate limits,
  // seed passwords) to baseline so the Scenario 1 manual test flow is repeatable.
  // Disabled in production; Neon data is reset separately via prisma/seed.ts.
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/dev/reset", (_req: Request, res: Response) => {
      resetContainer(container);
      res.json({ status: "ok", message: "In-memory state reset to seed baseline." });
    });

    // Test Case 1H — let QA simulate the e-mail provider being offline without
    // any special privilege. POST { available: false } before a password-reset
    // request to exercise the EMAIL_SERVICE_DOWN path, then { available: true }
    // (or /api/dev/reset) to restore. This is the manual-test hook that was
    // missing when TC-1H was reported as "could not be tested".
    app.post("/api/dev/email-service", (req: Request, res: Response) => {
      const available = req.body?.available !== false;
      container.auth.setEmailServiceAvailable(available);
      res.json({ status: "ok", emailServiceAvailable: available });
    });
  }

  // Scenario 1 (Login) — pre-authentication endpoints, mounted before mock-auth.
  app.use("/api/auth", buildAuthRouter(container));
  app.use("/api/period", buildPeriodRouter());
  app.use("/api/profile", buildProfileRouter(container));

  const auth = mockAuthMiddleware(container);
  app.use("/api/applications", auth, buildApplicationRouter());
  app.use("/api/documents", auth, buildDocumentUploadRouter());
  app.use("/api/oidb", auth, buildOidbRouter(container));
  app.use("/api/ranking", auth, buildRankingRouter(container));
  app.use("/api/dean", auth, buildDeanRouter(container));
  app.use("/api/ygk", auth, buildIntibakRouter(container));
  app.use("/api/board", auth, buildBoardRouter(container));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "NOT_FOUND" });
  });
  app.use(errorHandler);

  return { app, container };
}
