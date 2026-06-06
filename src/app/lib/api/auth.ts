// Scenario 1 — Login to UTMS. Frontend client for the pre-auth /api/auth endpoints.
// In local dev the Vite proxy routes /api → backend; on Vercel vercel.json rewrites it.
import type { User, UserRole } from '../../App';

const BASE = '/api';

export interface BackendAuthUser {
  userId: string;
  tckn: string;
  fullName: string;
  email: string;
  roles: string[];
  departmentId?: string;
  facultyId?: string;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AuthApiError(data.message ?? `HTTP ${res.status}`, res.status, data.error);
  }
  return data as T;
}

const ROLE_MAP: Record<string, UserRole> = {
  STUDENT: 'Student',
  OIDB_OFFICER: 'OIDB',
  YDYO_OFFICER: 'YDYO',
  YGK_MEMBER: 'YGK',
  YGK_CHAIR: 'YGK',
  DEANS_OFFICE_STAFF: 'Dean',
  FACULTY_BOARD_MEMBER: 'Board',
  SYSTEM_ADMIN: 'Admin',
};

export function mapBackendUser(b: BackendAuthUser): User {
  // Strip any parenthetical role suffix, e.g. "Melih Macit (YGK Member)" → "Melih Macit".
  const cleanName = b.fullName.replace(/\s*\(.*\)\s*$/, '').trim();
  const parts = cleanName.split(/\s+/);
  const name = parts[0] ?? cleanName;
  const surname = parts.slice(1).join(' ') || '-';
  const roles = Array.from(
    new Set(b.roles.map((r) => ROLE_MAP[r]).filter((r): r is UserRole => Boolean(r))),
  );
  return { id: b.userId, tckn: b.tckn, name, surname, roles, email: b.email };
}

export async function login(tckn: string, password: string): Promise<User> {
  const res = await postJson<{ user: BackendAuthUser }>('/auth/login', { tckn, password });
  return mapBackendUser(res.user);
}

export async function forgotPassword(
  tckn: string,
  email: string,
): Promise<{ message: string; resetToken: string }> {
  return postJson('/auth/forgot-password', { tckn, email });
}

export async function resetPassword(
  token: string,
  newPassword: string,
  confirmPassword: string,
): Promise<{ message: string }> {
  return postJson('/auth/reset-password', { token, newPassword, confirmPassword });
}
