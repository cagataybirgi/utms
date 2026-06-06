import { randomUUID } from "node:crypto";
import { prisma } from "../prisma-client";
import { prismaUserToDomain } from "../mappers/user-mapper";
import { User } from "../types";
import { AppContainer } from "../container";
import { IAuthRepository, ResetTokenRecord } from "./auth-interfaces";

// ─── Prisma (Neon) — Scenario 1 runtime persistence ───────────────────────────

export class PrismaAuthRepository implements IAuthRepository {
  private emailServiceAvailable = true;

  async findUserByTckn(tckn: string): Promise<User | undefined> {
    const row = await prisma.user.findUnique({
      where: { tckn },
      include: { password: true },
    });
    return row ? prismaUserToDomain(row) : undefined;
  }

  async findUserById(userId: string): Promise<User | undefined> {
    const row = await prisma.user.findUnique({
      where: { userId },
      include: { password: true },
    });
    return row ? prismaUserToDomain(row) : undefined;
  }

  async updateUserAuthState(
    userId: string,
    state: { failedLoginAttempts: number; lockedUntil: string | null },
  ): Promise<void> {
    await prisma.user.update({
      where: { userId },
      data: {
        failedLoginCount: state.failedLoginAttempts,
        lockedUntil: state.lockedUntil ? new Date(state.lockedUntil) : null,
      },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.password.upsert({
      where: { userId },
      create: { userId, passwordHash, previousPasswordHashes: [] },
      update: { passwordHash, lastChangedAt: new Date() },
    });
    await this.updateUserAuthState(userId, { failedLoginAttempts: 0, lockedUntil: null });
  }

  async saveResetToken(record: ResetTokenRecord): Promise<void> {
    await prisma.resetToken.upsert({
      where: { userId: record.userId },
      create: {
        userId: record.userId,
        token: record.token,
        expiry: new Date(record.expiresAt),
      },
      update: {
        token: record.token,
        expiry: new Date(record.expiresAt),
      },
    });
  }

  async findResetToken(token: string): Promise<ResetTokenRecord | undefined> {
    const row = await prisma.resetToken.findFirst({ where: { token } });
    if (!row) return undefined;
    return {
      userId: row.userId,
      token: row.token,
      expiresAt: row.expiry.getTime(),
      used: false,
    };
  }

  async markResetTokenUsed(token: string): Promise<void> {
    const row = await prisma.resetToken.findFirst({ where: { token } });
    if (row) {
      await prisma.resetToken.delete({ where: { userId: row.userId } });
    }
  }

  async countRecentResetRequests(userId: string, windowMs: number, now: number): Promise<number> {
    const since = new Date(now - windowMs);
    return prisma.notificationRecord.count({
      where: {
        recipientUserId: userId,
        eventType: "PASSWORD_RESET_REQUESTED",
        createdAt: { gte: since },
      },
    });
  }

  async recordResetRequest(_userId: string, _windowMs: number, _now: number): Promise<void> {
    // Rate-limit counter is derived from notification rows in Neon.
  }

  async appendPasswordResetNotification(userId: string, token: string, now: number): Promise<void> {
    await prisma.notificationRecord.create({
      data: {
        notificationId: randomUUID(),
        recipientUserId: userId,
        eventType: "PASSWORD_RESET_REQUESTED",
        channel: "EMAIL",
        subject: "UTMS şifre sıfırlama",
        body: `Şifre sıfırlama bağlantınız: /?token=${token}`,
        isDelivered: this.emailServiceAvailable,
        failureReason: this.emailServiceAvailable ? null : "Notification service offline",
        createdAt: new Date(now),
      },
    });
  }

  isEmailServiceAvailable(): boolean {
    return this.emailServiceAvailable;
  }

  setEmailServiceAvailable(available: boolean): void {
    this.emailServiceAvailable = available;
  }
}

// ─── In-memory — used under Jest (NODE_ENV=test) ──────────────────────────────

export class InMemoryAuthRepository implements IAuthRepository {
  constructor(private readonly container: AppContainer) {}

  async findUserByTckn(tckn: string): Promise<User | undefined> {
    return this.container.users.findByTckn(tckn);
  }

  async findUserById(userId: string): Promise<User | undefined> {
    return this.container.users.findById(userId);
  }

  async updateUserAuthState(
    userId: string,
    state: { failedLoginAttempts: number; lockedUntil: string | null },
  ): Promise<void> {
    const user = this.container.users.findById(userId);
    if (!user) return;
    user.failedLoginAttempts = state.failedLoginAttempts;
    user.lockedUntil = state.lockedUntil;
    this.container.users.put(user);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.container.users.findById(userId);
    if (!user) return;
    user.passwordHash = passwordHash;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    this.container.users.put(user);
  }

  async saveResetToken(record: ResetTokenRecord): Promise<void> {
    this.container.auth.saveToken(record);
  }

  async findResetToken(token: string): Promise<ResetTokenRecord | undefined> {
    return this.container.auth.findToken(token);
  }

  async markResetTokenUsed(token: string): Promise<void> {
    this.container.auth.markTokenUsed(token);
  }

  async countRecentResetRequests(userId: string, windowMs: number, now: number): Promise<number> {
    return this.container.auth.countResetRequests(userId, windowMs, now);
  }

  async recordResetRequest(userId: string, windowMs: number, now: number): Promise<void> {
    this.container.auth.recordResetRequest(userId, windowMs, now);
  }

  async appendPasswordResetNotification(userId: string, token: string, now: number): Promise<void> {
    this.container.notifications.append({
      notificationId: randomUUID(),
      recipientUserId: userId,
      eventType: "PASSWORD_RESET_REQUESTED",
      channel: "EMAIL",
      subject: "UTMS şifre sıfırlama",
      body: `Şifre sıfırlama bağlantınız: /?token=${token}`,
      isDelivered: this.container.auth.isEmailServiceAvailable(),
      failureReason: this.container.auth.isEmailServiceAvailable()
        ? undefined
        : "Notification service offline",
      createdAt: new Date(now).toISOString(),
    });
  }

  isEmailServiceAvailable(): boolean {
    return this.container.auth.isEmailServiceAvailable();
  }

  setEmailServiceAvailable(available: boolean): void {
    this.container.auth.setEmailServiceAvailable(available);
  }
}
