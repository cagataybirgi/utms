import { createHash } from "node:crypto";

// In-memory demo only — a real system would use bcrypt/scrypt/argon2 with a salt.
export function hashPassword(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function verifyPassword(plain: string, hash?: string): boolean {
  if (!hash) return false;
  return hashPassword(plain) === hash;
}

/**
 * Validates new-password complexity for the reset flow (Scenario 1, Test Case 1G).
 * Returns a Turkish error message, or null when the password is acceptable.
 */
export function validatePasswordComplexity(password: string): string | null {
  if (password.length < 8) return "Şifre en az 8 karakter olmalıdır.";
  if (!/[A-ZĞÜŞİÖÇ]/.test(password)) return "Şifre en az bir büyük harf içermelidir.";
  if (!/[0-9]/.test(password)) return "Şifre en az bir rakam içermelidir.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Şifre en az bir özel karakter içermelidir.";
  return null;
}
