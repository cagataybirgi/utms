import { randomUUID } from "node:crypto";
import { AppContainer } from "../../shared/container";
import { AuditLogger } from "../../shared/audit/audit-logger";
import { User, UserRole } from "../../shared/types";
import {
  LockedError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "../../shared/errors";
import { hashPassword, validatePasswordComplexity, verifyPassword } from "./password";

// Scenario 1 — Login to UTMS. User-facing messages mirror the test report (Turkish).
export const AUTH_MESSAGES = {
  invalidCredentials: "TCKN veya şifre hatalı.",
  accountLocked: "Hesabınız kilitlendi. Lütfen 15 dakika sonra tekrar deneyin.",
  forgotSuccess: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.",
  forgotMismatch: "Girilen bilgiler kayıtlı hesapla eşleşmiyor.",
  tokenInvalid: "Bu bağlantının süresi dolmuş veya daha önce kullanılmış.",
  passwordsDoNotMatch: "Şifreler eşleşmiyor.",
  resetSuccess: "Şifreniz başarıyla güncellendi. Giriş sayfasına yönlendiriliyorsunuz.",
  emailServiceDown: "E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.",
  rateLimited: "Çok fazla istek gönderdiniz. Lütfen bir süre bekleyin.",
} as const;

export const AUTH_CONFIG = {
  maxFailedAttempts: 5,
  lockDurationMs: 15 * 60 * 1000, // 15 minutes
  tokenExpiryMs: 60 * 60 * 1000, // 1 hour
  resetRateWindowMs: 15 * 60 * 1000, // 15 minutes
  resetRateMax: 2, // allow 2 reset requests per window; the 3rd is blocked
} as const;

export interface AuthUserDto {
  userId: string;
  tckn: string;
  fullName: string;
  email: string;
  roles: UserRole[];
  departmentId?: string;
  facultyId?: string;
}

export interface ForgotPasswordResult {
  message: string;
  // Returned for the in-memory demo so the SPA can open the reset page without a
  // real inbox. A production system would only deliver this via e-mail.
  resetToken: string;
}

function toDto(u: User): AuthUserDto {
  return {
    userId: u.userId,
    tckn: u.tckn,
    fullName: u.fullName,
    email: u.email,
    roles: u.roles,
    departmentId: u.departmentId,
    facultyId: u.facultyId,
  };
}

export class AuthService {
  private readonly audit: AuditLogger;

  constructor(private readonly container: AppContainer) {
    this.audit = new AuditLogger(container.audit);
  }

  /** Test Cases 1A (success), 1B (lockout), 1C (invalid credentials). */
  login(tckn: string, password: string, now: number = Date.now()): AuthUserDto {
    if (!tckn || !password) {
      throw new ValidationError("TCKN ve şifre zorunludur.");
    }

    const user = this.container.users.findByTckn(tckn);

    // Already-locked account: block before checking the password.
    if (user && this.isLocked(user, now)) {
      throw new LockedError(AUTH_MESSAGES.accountLocked);
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      if (user) this.registerFailedAttempt(user, now);
      throw new UnauthorizedError(AUTH_MESSAGES.invalidCredentials);
    }

    // Success — clear the failed-attempt counter and any expired lock.
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    this.container.users.put(user);

    this.audit.write({
      actorUserId: user.userId,
      actorRole: user.roles[0],
      actionType: "LOGIN_SUCCESS",
      affectedEntityId: user.userId,
      affectedEntityType: "User",
    });

    return toDto(user);
  }

  private isLocked(user: User, now: number): boolean {
    return !!user.lockedUntil && new Date(user.lockedUntil).getTime() > now;
  }

  private registerFailedAttempt(user: User, now: number): void {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    user.failedLoginAttempts = attempts;

    if (attempts >= AUTH_CONFIG.maxFailedAttempts) {
      user.lockedUntil = new Date(now + AUTH_CONFIG.lockDurationMs).toISOString();
      this.container.users.put(user);
      this.audit.write({
        actorUserId: user.userId,
        actorRole: user.roles[0],
        actionType: "ACCOUNT_LOCKED",
        affectedEntityId: user.userId,
        affectedEntityType: "User",
        newValue: { lockedUntil: user.lockedUntil, failedLoginAttempts: attempts },
      });
      throw new LockedError(AUTH_MESSAGES.accountLocked);
    }

    this.container.users.put(user);
    this.audit.write({
      actorUserId: user.userId,
      actorRole: user.roles[0],
      actionType: "LOGIN_FAILED",
      affectedEntityId: user.userId,
      affectedEntityType: "User",
      newValue: { failedLoginAttempts: attempts },
    });
  }

  /** Test Cases 1D (request), 1E (mismatch), 1H (e-mail down), 1I (rate limit). */
  requestPasswordReset(
    tckn: string,
    email: string,
    now: number = Date.now(),
  ): ForgotPasswordResult {
    if (!tckn || !email) {
      throw new ValidationError("TCKN ve e-posta zorunludur.");
    }

    const user = this.container.users.findByTckn(tckn);

    // 1E — TCKN/e-mail do not belong to the same account. Generic message; no leak.
    if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
      throw new ValidationError(AUTH_MESSAGES.forgotMismatch);
    }

    const key = `${tckn}::${email.toLowerCase()}`;

    // 1I — rate limit before doing any work / sending mail.
    if (
      this.container.auth.countResetRequests(key, AUTH_CONFIG.resetRateWindowMs, now) >=
      AUTH_CONFIG.resetRateMax
    ) {
      throw new TooManyRequestsError(AUTH_MESSAGES.rateLimited);
    }

    // 1H — simulated e-mail gateway outage. Nothing is recorded so the user can retry.
    if (!this.container.auth.isEmailServiceAvailable()) {
      throw new ServiceUnavailableError("EMAIL_SERVICE_DOWN", AUTH_MESSAGES.emailServiceDown);
    }

    const token = randomUUID();
    this.container.auth.saveToken({
      token,
      userId: user.userId,
      expiresAt: now + AUTH_CONFIG.tokenExpiryMs,
      used: false,
    });
    this.container.auth.recordResetRequest(key, AUTH_CONFIG.resetRateWindowMs, now);

    // Simulated e-mail delivery via the notification repository.
    this.container.notifications.append({
      notificationId: randomUUID(),
      recipientUserId: user.userId,
      eventType: "PASSWORD_RESET_REQUESTED",
      channel: "EMAIL",
      subject: "UTMS şifre sıfırlama",
      body: `Şifre sıfırlama bağlantınız: /reset-password?token=${token}`,
      isDelivered: true,
      createdAt: new Date(now).toISOString(),
    });

    this.audit.write({
      actorUserId: user.userId,
      actorRole: user.roles[0],
      actionType: "PASSWORD_RESET_REQUESTED",
      affectedEntityId: user.userId,
      affectedEntityType: "User",
    });

    return { message: AUTH_MESSAGES.forgotSuccess, resetToken: token };
  }

  /** Test Cases 1D (complete), 1F (expired/used), 1G (validation). */
  resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string,
    now: number = Date.now(),
  ): { message: string } {
    const record = this.container.auth.findToken(token);

    // 1F — token missing, already used, or expired.
    if (!record || record.used || record.expiresAt < now) {
      throw new ValidationError(AUTH_MESSAGES.tokenInvalid, { code: "TOKEN_INVALID" });
    }

    // 1G — complexity + confirmation. The token is NOT consumed so the user can retry.
    const complexityError = validatePasswordComplexity(newPassword);
    if (complexityError) {
      throw new ValidationError(complexityError);
    }
    if (newPassword !== confirmPassword) {
      throw new ValidationError(AUTH_MESSAGES.passwordsDoNotMatch);
    }

    const user = this.container.users.findById(record.userId);
    if (!user) {
      throw new ValidationError(AUTH_MESSAGES.tokenInvalid, { code: "TOKEN_INVALID" });
    }

    user.passwordHash = hashPassword(newPassword);
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    this.container.users.put(user);
    this.container.auth.markTokenUsed(token);

    this.audit.write({
      actorUserId: user.userId,
      actorRole: user.roles[0],
      actionType: "PASSWORD_RESET_COMPLETED",
      affectedEntityId: user.userId,
      affectedEntityType: "User",
    });

    return { message: AUTH_MESSAGES.resetSuccess };
  }
}
