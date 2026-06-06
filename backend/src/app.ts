import express, { Express, NextFunction, Request, Response } from "express";
import { AppContainer, createContainer } from "./shared/container";
import { mockAuthMiddleware } from "./shared/middleware/mock-auth";
import { errorHandler } from "./shared/middleware/error-handler";
import { buildOidbRouter } from "./modules/oidb/oidb.routes";
import { buildIntibakRouter } from "./modules/intibak/intibak.routes";
import { buildDocumentUploadRouter } from "./modules/document-upload/document-upload.routes";
import { buildApplicationRouter } from "./modules/application/application.routes";
import { buildRankingRouter } from "./modules/ranking/ranking.routes";
import { buildDeanRouter } from "./modules/dean/dean.routes";
import { buildAuthRouter } from "./modules/auth/auth.routes";
// DEV-ONLY: remove this import before submission
import { seedAll } from "./mocks/seed-data";

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

  // DEV-ONLY: reset all in-memory data back to seed state — remove before submission
  app.post("/api/dev/reset", (_req: Request, res: Response) => {
    container.applications.clear();
    container.documents.clear();
    container.intibakTables.clear();
    container.packages.clear();
    container.quotas.clear();
    container.audit.clear();
    container.notifications.clear();
    container.users.clear();
    container.curriculum.clear();
    container.auth.clear();
    seedAll(container);
    res.json({ message: "Test verileri sıfırlandı" });
  });

  // Scenario 1 (Login) — pre-authentication endpoints, mounted before mock-auth.
  app.use("/api/auth", buildAuthRouter(container));

  const auth = mockAuthMiddleware(container);
  app.use("/api/applications", auth, buildApplicationRouter());
  app.use("/api/documents", auth, buildDocumentUploadRouter());
  app.use("/api/oidb", auth, buildOidbRouter(container));
  app.use("/api/ranking", auth, buildRankingRouter(container));
  app.use("/api/dean", auth, buildDeanRouter(container));
  app.use("/api/ygk", auth, buildIntibakRouter(container));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "NOT_FOUND" });
  });
  app.use(errorHandler);

  return { app, container };
}
