import { Request, Response } from "express";
import { UnauthorizedError } from "../../shared/errors";
import { INotificationStore } from "./notification.store";

export class NotificationController {
  constructor(private readonly store: INotificationStore) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    const [items, unread] = await Promise.all([
      this.store.listByRecipient(userId),
      this.store.unreadCount(userId),
    ]);
    res.json({ items, unreadCount: unread });
  };

  markRead = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    await this.store.markRead(req.params.notificationId, userId);
    res.json({ ok: true });
  };

  markAllRead = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    await this.store.markAllRead(userId);
    res.json({ ok: true });
  };

  private requireUser(req: Request): string {
    if (!req.authUser) throw new UnauthorizedError();
    return req.authUser.userId;
  }
}
