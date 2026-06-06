import { User } from "../types";

export interface ResetTokenRecord {
  userId: string;
  token: string;
  expiresAt: number;
  used: boolean;
}

export interface IAuthRepository {
  findUserByTckn(tckn: string): Promise<User | undefined>;
  findUserById(userId: string): Promise<User | undefined>;
  updateUserAuthState(
    userId: string,
    state: { failedLoginAttempts: number; lockedUntil: string | null },
  ): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  saveResetToken(record: ResetTokenRecord): Promise<void>;
  findResetToken(token: string): Promise<ResetTokenRecord | undefined>;
  markResetTokenUsed(token: string): Promise<void>;
  countRecentResetRequests(userId: string, windowMs: number, now: number): Promise<number>;
  recordResetRequest(userId: string, windowMs: number, now: number): Promise<void>;
  appendPasswordResetNotification(userId: string, token: string, now: number): Promise<void>;
  isEmailServiceAvailable(): boolean;
  setEmailServiceAvailable(available: boolean): void;
}
