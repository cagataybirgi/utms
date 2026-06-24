import { Router } from "express";
import { AppContainer } from "../../shared/container";
import { asyncHandler } from "../../shared/middleware/async-handler";
import {
  INotificationStore,
  InMemoryNotificationStore,
  PrismaNotificationStore,
} from "./notification.store";
import { NotificationController } from "./notification.controller";

/**
 * Builds the notification store the way the rest of the app picks data sources:
 * Neon (Prisma) at runtime, in-memory under test. Shared so board.routes can
 * reuse the SAME store instance for writes (see createNotificationStore).
 */
export function createNotificationStore(container: AppContainer): INotificationStore {
  const useDatabase = process.env.NODE_ENV !== "test";
  return useDatabase
    ? new PrismaNotificationStore()
    : new InMemoryNotificationStore(container.users);
}

export function buildNotificationRouter(
  container: AppContainer,
  store: INotificationStore = createNotificationStore(container),
): Router {
  const controller = new NotificationController(store);

  const r = Router();
  // Any authenticated user can read their own notifications.
  r.get("/", asyncHandler(controller.list));
  r.post("/:notificationId/read", asyncHandler(controller.markRead));
  r.post("/read-all", asyncHandler(controller.markAllRead));

  return r;
}
