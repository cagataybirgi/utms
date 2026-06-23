import { Prisma } from "@prisma/client";
import {
  Application,
  ApplicationStatus,
  CorrectionReason,
  LanguageDecision,
  LanguageProofInfo,
  PreScreeningResult,
  RankingCategory,
} from "../types";

// The shape returned by prisma.application.findX — i.e. all scalar columns.
export type PrismaApplicationRow = Prisma.ApplicationGetPayload<Record<string, never>>;

/**
 * Map a Neon `applications` row onto the domain `Application` used across the
 * ranking workflow. Field renames (targeted_semester → targetSemester), JSON
 * columns and DateTime → ISO string conversions all happen here.
 */
export function toDomain(row: PrismaApplicationRow): Application {
  return {
    applicationId: row.applicationId,
    studentId: row.studentId,
    studentTckn: row.studentTckn,
    studentFullName: row.studentFullName,
    periodId: row.periodId,
    targetDepartmentId: row.targetDepartmentId,
    targetFacultyId: row.targetFacultyId,
    transferType: row.transferType,
    targetSemester: (row.targetedSemester ?? 3) as 3 | 5,
    submittedGpa: row.submittedGpa,
    submittedYksScore: row.submittedYksScore ?? undefined,
    yksExamYear: row.yksExamYear ?? undefined,
    language: row.language ?? undefined,
    finishedSemester: row.finishedSemester ?? undefined,
    finishedYear: row.finishedYear ?? undefined,
    currentInstitution: row.currentInstitution ?? undefined,
    currentDepartment: row.currentDepartment ?? undefined,
    currentStatus: row.currentStatus as ApplicationStatus,
    preScreening:
      (row.preScreening as unknown as PreScreeningResult) ?? {
        isPassed: true,
        failedRules: [],
      },
    correctionReasons:
      (row.correctionReasons as unknown as CorrectionReason[]) ?? [],
    rejectionReason: row.rejectionReason ?? undefined,
    intakeVerifiedBy: row.intakeVerifiedBy ?? undefined,
    intakeVerifiedAt: row.intakeVerifiedAt
      ? row.intakeVerifiedAt.toISOString()
      : undefined,
    routedToYdyo: row.routedToYdyo,
    routedToDeansOffice: row.routedToDeansOffice,
    ydyoExempt: row.ydyoExempt,
    languageProof:
      (row.languageProof as unknown as LanguageProofInfo) ?? undefined,
    ydyoDecision: (row.ydyoDecision as LanguageDecision) ?? undefined,
    ydyoReviewNotes: row.ydyoReviewNotes ?? undefined,
    ydyoReviewedBy: row.ydyoReviewedBy ?? undefined,
    ydyoReviewedAt: row.ydyoReviewedAt
      ? row.ydyoReviewedAt.toISOString()
      : undefined,
    rankingCategory: (row.rankingCategory as RankingCategory) ?? undefined,
    transferScore: row.transferScore ?? undefined,
    submittedAt: row.submittedAt.toISOString(),
    lastModifiedAt: row.lastModifiedAt.toISOString(),
  };
}

/**
 * Build the full set of scalar columns for inserting (or upserting) a domain
 * Application into Neon. `lastModifiedAt` is managed by Prisma (@updatedAt) and
 * scalar list columns default to [], so both are intentionally omitted.
 */
export function toPrismaCreate(
  app: Application
): Prisma.ApplicationUncheckedCreateInput {
  return {
    applicationId: app.applicationId,
    studentId: app.studentId,
    studentTckn: app.studentTckn,
    studentFullName: app.studentFullName,
    periodId: app.periodId,
    targetDepartmentId: app.targetDepartmentId,
    targetFacultyId: app.targetFacultyId,
    transferType: app.transferType,
    targetedSemester: app.targetSemester,
    submittedGpa: app.submittedGpa,
    submittedYksScore: app.submittedYksScore ?? null,
    yksExamYear: app.yksExamYear ?? null,
    language: app.language ?? null,
    finishedSemester: app.finishedSemester ?? null,
    finishedYear: app.finishedYear ?? null,
    currentInstitution: app.currentInstitution ?? null,
    currentDepartment: app.currentDepartment ?? null,
    currentStatus: app.currentStatus,
    preScreening: app.preScreening as unknown as Prisma.InputJsonValue,
    correctionReasons: app.correctionReasons as unknown as Prisma.InputJsonValue,
    rejectionReason: app.rejectionReason ?? null,
    intakeVerifiedBy: app.intakeVerifiedBy ?? null,
    intakeVerifiedAt: app.intakeVerifiedAt
      ? new Date(app.intakeVerifiedAt)
      : null,
    routedToYdyo: app.routedToYdyo,
    routedToDeansOffice: app.routedToDeansOffice,
    ydyoExempt: app.ydyoExempt,
    languageProof: app.languageProof
      ? (app.languageProof as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull,
    ydyoDecision: app.ydyoDecision ?? null,
    ydyoReviewNotes: app.ydyoReviewNotes ?? null,
    ydyoReviewedBy: app.ydyoReviewedBy ?? null,
    ydyoReviewedAt: app.ydyoReviewedAt ? new Date(app.ydyoReviewedAt) : null,
    rankingCategory: app.rankingCategory ?? null,
    submittedAt: new Date(app.submittedAt),
  };
}

/**
 * The columns a repository.save() may mutate across the intake → ranking
 * workflow. The domain Application is always read in full (findById → toDomain)
 * before being mutated and saved back, so every field here round-trips safely —
 * a save never silently drops a column the caller changed. Intake/routing fields
 * are included so the ÖİDB and Dean handoffs persist to Neon (not just status).
 */
export function toPrismaUpdate(
  app: Application
): Prisma.ApplicationUncheckedUpdateInput {
  return {
    currentStatus: app.currentStatus,
    transferScore: app.transferScore ?? null,
    rankingCategory: app.rankingCategory ?? null,
    rejectionReason: app.rejectionReason ?? null,
    preScreening: app.preScreening as unknown as Prisma.InputJsonValue,
    correctionReasons: app.correctionReasons as unknown as Prisma.InputJsonValue,
    intakeVerifiedBy: app.intakeVerifiedBy ?? null,
    intakeVerifiedAt: app.intakeVerifiedAt
      ? new Date(app.intakeVerifiedAt)
      : null,
    routedToYdyo: app.routedToYdyo,
    routedToDeansOffice: app.routedToDeansOffice,
    ydyoExempt: app.ydyoExempt,
    languageProof: app.languageProof
      ? (app.languageProof as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull,
    ydyoDecision: app.ydyoDecision ?? null,
    ydyoReviewNotes: app.ydyoReviewNotes ?? null,
    ydyoReviewedBy: app.ydyoReviewedBy ?? null,
    ydyoReviewedAt: app.ydyoReviewedAt ? new Date(app.ydyoReviewedAt) : null,
  };
}
