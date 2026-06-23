import { Prisma } from "@prisma/client";
import { EvaluationPackage, PackageStatus } from "../types";

export type PrismaEvaluationPackageRow = Prisma.EvaluationPackageGetPayload<
  Record<string, never>
>;

/**
 * Map a Neon `evaluation_packages` row onto the domain `EvaluationPackage`.
 * Array columns map 1:1, optional timestamps cast to ISO strings.
 */
export function packageToDomain(row: PrismaEvaluationPackageRow): EvaluationPackage {
  return {
    packageId: row.packageId,
    departmentId: row.departmentId,
    periodId: row.periodId,
    status: row.status as PackageStatus,
    asilApplicationIds: row.asilApplicationIds,
    yedekApplicationIds: row.yedekApplicationIds,
    redApplicationIds: row.redApplicationIds,
    intibakTableIds: row.intibakTableIds,
    digitalSignatureBy: row.digitalSignatureBy ?? undefined,
    digitalSignatureAt: row.digitalSignatureAt
      ? row.digitalSignatureAt.toISOString()
      : undefined,
    sentBy: row.sentBy ?? undefined,
    sentAt: row.sentAt ? row.sentAt.toISOString() : undefined,
  };
}

/**
 * Full column set for upserting an EvaluationPackage. Same shape used for both
 * create and update because the package mutates as a unit (status flips, new
 * application IDs added when the YGK chair re-sends, etc.).
 */
export function packageToPrismaUpsert(
  pkg: EvaluationPackage,
): Prisma.EvaluationPackageUncheckedCreateInput {
  return {
    packageId: pkg.packageId,
    departmentId: pkg.departmentId,
    periodId: pkg.periodId,
    status: pkg.status,
    asilApplicationIds: pkg.asilApplicationIds,
    yedekApplicationIds: pkg.yedekApplicationIds,
    redApplicationIds: pkg.redApplicationIds,
    intibakTableIds: pkg.intibakTableIds,
    digitalSignatureBy: pkg.digitalSignatureBy ?? null,
    digitalSignatureAt: pkg.digitalSignatureAt
      ? new Date(pkg.digitalSignatureAt)
      : null,
    sentBy: pkg.sentBy ?? null,
    sentAt: pkg.sentAt ? new Date(pkg.sentAt) : null,
  };
}
