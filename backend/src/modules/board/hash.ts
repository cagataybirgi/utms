import { createHash } from "node:crypto";

/**
 * Deterministic SHA-256 over the input string.
 * Used by 702-HASH integrity checks on the Board's review surface.
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Compute the canonical hash of the fields that are considered "signed"
 * when the YGK Chair sends a package to the Dean.
 *
 * Inputs intentionally kept to immutable fields only:
 *   - packageId, departmentId, periodId
 *   - sorted application IDs by ranking category
 *   - sorted intibak table IDs
 *
 * Excludes signature, status, sentAt — those mutate after signing.
 */
export function computePackageHash(input: {
  packageId: string;
  departmentId: string;
  periodId: string;
  asilApplicationIds: string[];
  yedekApplicationIds: string[];
  redApplicationIds: string[];
  intibakTableIds: string[];
}): string {
  const canonical = {
    packageId: input.packageId,
    departmentId: input.departmentId,
    periodId: input.periodId,
    asil: [...input.asilApplicationIds].sort(),
    yedek: [...input.yedekApplicationIds].sort(),
    red: [...input.redApplicationIds].sort(),
    intibak: [...input.intibakTableIds].sort(),
  };
  return sha256(JSON.stringify(canonical));
}
