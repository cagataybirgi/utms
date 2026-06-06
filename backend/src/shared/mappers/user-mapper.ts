import type { Password, User as PrismaUser } from "@prisma/client";
import { User, UserRole } from "../types";

type PrismaUserWithPassword = PrismaUser & { password: Password | null };

export function prismaUserToDomain(row: PrismaUserWithPassword): User {
  return {
    userId: row.userId,
    tckn: row.tckn,
    fullName: row.fullName,
    email: row.email,
    roles: row.roles as UserRole[],
    departmentId: row.departmentId ?? undefined,
    facultyId: row.facultyId ?? undefined,
    passwordHash: row.password?.passwordHash,
    failedLoginAttempts: row.failedLoginCount,
    lockedUntil: row.lockedUntil?.toISOString() ?? null,
  };
}
