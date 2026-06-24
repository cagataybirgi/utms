import { randomUUID } from "node:crypto";
import { prisma } from "../../shared/prisma-client";
import { InMemoryUserRepository } from "../../shared/repositories";

// Scenario 7 + shared — the notification bell reads real, per-user records from
// Neon. Distinct from the legacy in-memory NotificationService (which still
// powers the 571-NOTIFY decoupling semantics inside board publish): this store
// is the read model the AppShell bell consumes, and is written to with REAL
// recipient userIds by the board workflow.

export interface NotificationDto {
  notificationId: string;
  recipientUserId: string;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationCreateInput {
  recipientUserId: string;
  eventType: string;
  channel: "EMAIL" | "DASHBOARD_ALERT";
  subject: string;
  body: string;
}

export type RoleNotificationInput = Omit<NotificationCreateInput, "recipientUserId">;

export interface INotificationStore {
  create(input: NotificationCreateInput): Promise<NotificationDto>;
  /** Fan a single notification out to every user holding `role`. Returns count. */
  createForRole(role: string, input: RoleNotificationInput): Promise<number>;
  listByRecipient(userId: string): Promise<NotificationDto[]>;
  unreadCount(userId: string): Promise<number>;
  markRead(notificationId: string, userId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}

// ─── Prisma (Neon) — runtime ───────────────────────────────────────────────

export class PrismaNotificationStore implements INotificationStore {
  async create(input: NotificationCreateInput): Promise<NotificationDto> {
    const row = await prisma.notificationRecord.create({
      data: {
        recipientUserId: input.recipientUserId,
        eventType: input.eventType,
        channel: input.channel,
        subject: input.subject,
        body: input.body,
        isDelivered: true,
        isRead: false,
      },
    });
    return toDto(row);
  }

  async createForRole(role: string, input: RoleNotificationInput): Promise<number> {
    const users = await prisma.user.findMany({
      where: { roles: { has: role } },
      select: { userId: true },
    });
    if (users.length === 0) return 0;
    await prisma.notificationRecord.createMany({
      data: users.map((u) => ({
        recipientUserId: u.userId,
        eventType: input.eventType,
        channel: input.channel,
        subject: input.subject,
        body: input.body,
        isDelivered: true,
        isRead: false,
      })),
    });
    return users.length;
  }

  async listByRecipient(userId: string): Promise<NotificationDto[]> {
    const rows = await prisma.notificationRecord.findMany({
      where: { recipientUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(toDto);
  }

  async unreadCount(userId: string): Promise<number> {
    return prisma.notificationRecord.count({
      where: { recipientUserId: userId, isRead: false },
    });
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notificationRecord.updateMany({
      where: { notificationId, recipientUserId: userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await prisma.notificationRecord.updateMany({
      where: { recipientUserId: userId, isRead: false },
      data: { isRead: true },
    });
  }
}

interface PrismaNotificationRow {
  notificationId: string;
  recipientUserId: string;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
}

function toDto(row: PrismaNotificationRow): NotificationDto {
  return {
    notificationId: row.notificationId,
    recipientUserId: row.recipientUserId,
    eventType: row.eventType,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── In-memory — used under test (NODE_ENV=test) ───────────────────────────

export class InMemoryNotificationStore implements INotificationStore {
  private readonly records: NotificationDto[] = [];

  constructor(private readonly users?: InMemoryUserRepository) {}

  async create(input: NotificationCreateInput): Promise<NotificationDto> {
    const dto: NotificationDto = {
      notificationId: randomUUID(),
      recipientUserId: input.recipientUserId,
      eventType: input.eventType,
      channel: input.channel,
      subject: input.subject,
      body: input.body,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.records.push(dto);
    return dto;
  }

  async createForRole(role: string, input: RoleNotificationInput): Promise<number> {
    const recipients = this.users?.findByRole(role) ?? [];
    for (const u of recipients) {
      await this.create({ ...input, recipientUserId: u.userId });
    }
    return recipients.length;
  }

  async listByRecipient(userId: string): Promise<NotificationDto[]> {
    return this.records
      .filter((r) => r.recipientUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async unreadCount(userId: string): Promise<number> {
    return this.records.filter((r) => r.recipientUserId === userId && !r.isRead).length;
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    const rec = this.records.find(
      (r) => r.notificationId === notificationId && r.recipientUserId === userId,
    );
    if (rec) rec.isRead = true;
  }

  async markAllRead(userId: string): Promise<void> {
    for (const r of this.records) {
      if (r.recipientUserId === userId) r.isRead = true;
    }
  }
}
