import { randomUUID } from "node:crypto";
import { AuditLogger } from "../../shared/audit/audit-logger";
import { IAuditRepository } from "../../shared/repositories";
import { IAuthRepository } from "../../shared/repositories/auth-interfaces";
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
  lockDurationMs: 15 * 60 * 1000,
  tokenExpiryMs: 60 * 60 * 1000,
  resetRateWindowMs: 15 * 60 * 1000,
  resetRateMax: 2,
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
  resetToken: string;
}

export interface AuthServiceDeps {
  auth: IAuthRepository;
  audit: IAuditRepository;
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

  constructor(private readonly deps: AuthServiceDeps) {
    this.audit = new AuditLogger(deps.audit);
  }

  /** Test Cases 1A (success), 1B (lockout), 1C (invalid credentials). */
  async login(tckn: string, password: string, now: number = Date.now()): Promise<AuthUserDto> {
    if (!tckn || !password) {
      throw new ValidationError("TCKN ve şifre zorunludur.");
    }

    const user = await this.deps.auth.findUserByTckn(tckn);

    if (user && this.isLocked(user, now)) {
      throw new LockedError(AUTH_MESSAGES.accountLocked);
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      if (user) await this.registerFailedAttempt(user, now);
      throw new UnauthorizedError(AUTH_MESSAGES.invalidCredentials);
    }

    await this.deps.auth.updateUserAuthState(user.userId, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

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

  private async registerFailedAttempt(user: User, now: number): Promise<void> {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;

    if (attempts >= AUTH_CONFIG.maxFailedAttempts) {
      const lockedUntil = new Date(now + AUTH_CONFIG.lockDurationMs).toISOString();
      await this.deps.auth.updateUserAuthState(user.userId, {
        failedLoginAttempts: attempts,
        lockedUntil,
      });
      this.audit.write({
        actorUserId: user.userId,
        actorRole: user.roles[0],
        actionType: "ACCOUNT_LOCKED",
        affectedEntityId: user.userId,
        affectedEntityType: "User",
        newValue: { lockedUntil, failedLoginAttempts: attempts },
      });
      throw new LockedError(AUTH_MESSAGES.accountLocked);
    }

    await this.deps.auth.updateUserAuthState(user.userId, {
      failedLoginAttempts: attempts,
      lockedUntil: user.lockedUntil ?? null,
    });
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
  async requestPasswordReset(
    tckn: string,
    email: string,
    now: number = Date.now(),
  ): Promise<ForgotPasswordResult> {
    if (!tckn || !email) {
      throw new ValidationError("TCKN ve e-posta zorunludur.");
    }

    const user = await this.deps.auth.findUserByTckn(tckn);

    if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
      throw new ValidationError(AUTH_MESSAGES.forgotMismatch);
    }

    if (
      (await this.deps.auth.countRecentResetRequests(
        user.userId,
        AUTH_CONFIG.resetRateWindowMs,
        now,
      )) >= AUTH_CONFIG.resetRateMax
    ) {
      throw new TooManyRequestsError(AUTH_MESSAGES.rateLimited);
    }

    if (!this.deps.auth.isEmailServiceAvailable()) {
      throw new ServiceUnavailableError("EMAIL_SERVICE_DOWN", AUTH_MESSAGES.emailServiceDown);
    }

    const token = randomUUID();
    await this.deps.auth.saveResetToken({
      token,
      userId: user.userId,
      expiresAt: now + AUTH_CONFIG.tokenExpiryMs,
      used: false,
    });
    await this.deps.auth.recordResetRequest(user.userId, AUTH_CONFIG.resetRateWindowMs, now);
    await this.deps.auth.appendPasswordResetNotification(user.userId, token, now);

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
  async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string,
    now: number = Date.now(),
  ): Promise<{ message: string }> {
    const record = await this.deps.auth.findResetToken(token);

    if (!record || record.used || record.expiresAt < now) {
      throw new ValidationError(AUTH_MESSAGES.tokenInvalid, { code: "TOKEN_INVALID" });
    }

    const complexityError = validatePasswordComplexity(newPassword);
    if (complexityError) {
      throw new ValidationError(complexityError);
    }
    if (newPassword !== confirmPassword) {
      throw new ValidationError(AUTH_MESSAGES.passwordsDoNotMatch);
    }

    const user = await this.deps.auth.findUserById(record.userId);
    if (!user) {
      throw new ValidationError(AUTH_MESSAGES.tokenInvalid, { code: "TOKEN_INVALID" });
    }

    await this.deps.auth.updatePassword(record.userId, hashPassword(newPassword));
    await this.deps.auth.markResetTokenUsed(token);

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
