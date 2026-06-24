import { prisma } from "../../shared/prisma-client";
import { ApplicationStatus } from "../../shared/types";

export interface CreateApplicationDto {
  studentTckn: string;
  studentFullName: string;
  periodId: string;
  targetDepartmentId: string;
  targetFacultyId: string;
  transferType: string;
  targetSemester: number;
  submittedGpa: number;
  submittedYksScore?: number;
  yksExamYear?: number;
  currentInstitution?: string;
  currentDepartment?: string;
  isDraft?: boolean;
}

export interface ApplicationSummaryDto {
  applicationId: string;
  targetDepartmentId: string;
  targetFacultyId: string;
  currentStatus: string;
  submittedAt: string;
  lastModifiedAt: string;
  uploadedDocumentCount: number;
}

export interface StageLogDto {
  stageKey: string;
  actorName: string | null;
  actorRole: string | null;
  occurredAt: string;
  notes: string | null;
}

// Scenario 7 — the student-facing final result reads the intibak mapping rows
// straight off the locked intibak table so the muafiyet (course equivalence)
// table on the result screen reflects the real YGK decision, not a mock.
export interface IntibakCourseRowDto {
  sourceCourses: { code: string; name: string; ects: number }[];
  targetCourse: { code: string; name: string; ects: number } | null;
  status: string;
}

export interface IntibakDetailDto {
  isLocked: boolean;
  rows: IntibakCourseRowDto[];
  totalExemptedEcts: number;
}

export interface ApplicationDetailDto {
  applicationId: string;
  studentFullName: string;
  currentStatus: string;
  submittedAt: string;
  lastModifiedAt: string;
  intakeVerifiedAt: string | null;
  intakeVerifiedBy: string | null;
  routedToYdyo: boolean;
  routedToDeansOffice: boolean;
  ydyoExempt: boolean;
  correctionReasons: unknown[];
  rejectionReason: string | null;
  rankingCategory: string | null;
  transferScore: number | null;
  hasIntibak: boolean;
  hasLockedIntibak: boolean;
  intibak: IntibakDetailDto | null;
  stageLogs: StageLogDto[];
  targetDepartmentId: string;
  targetFacultyId: string;
  transferType: string;
  targetedSemester: number | null;
  submittedGpa: number;
  submittedYksScore: number | null;
  yksExamYear: number | null;
  currentInstitution: string | null;
  currentDepartment: string | null;
}

export class ApplicationService {
  async listByStudent(studentId: string): Promise<ApplicationSummaryDto[]> {
    const apps = await prisma.application.findMany({
      where: { studentId },
      include: {
        documents: {
          include: { versions: { where: { isActive: true } } },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    return apps.map((a) => ({
      applicationId: a.applicationId,
      targetDepartmentId: a.targetDepartmentId,
      targetFacultyId: a.targetFacultyId,
      currentStatus: a.currentStatus,
      submittedAt: a.submittedAt.toISOString(),
      lastModifiedAt: a.lastModifiedAt.toISOString(),
      uploadedDocumentCount: a.documents.filter((d) => d.versions.length > 0).length,
    }));
  }

  async create(studentId: string, dto: CreateApplicationDto): Promise<{ applicationId: string }> {
    const application = await prisma.application.create({
      data: {
        studentId,
        studentTckn: dto.studentTckn,
        studentFullName: dto.studentFullName,
        periodId: dto.periodId,
        // Use placeholder values for required DB fields when saving as draft
        targetDepartmentId: dto.targetDepartmentId || 'DRAFT',
        targetFacultyId: dto.targetFacultyId || 'DRAFT',
        transferType: dto.transferType || 'DRAFT',
        targetedSemester: dto.targetSemester || 0,
        submittedGpa: dto.submittedGpa || 0,
        submittedYksScore: dto.submittedYksScore,
        yksExamYear: dto.yksExamYear,
        currentInstitution: dto.currentInstitution,
        currentDepartment: dto.currentDepartment,
        currentStatus: dto.isDraft ? ApplicationStatus.Draft : ApplicationStatus.PendingDocumentUpload,
      },
    });
    return { applicationId: application.applicationId };
  }

  async getById(studentId: string, applicationId: string): Promise<ApplicationDetailDto> {
    const [app, intibakTable, stageLogs] = await Promise.all([
      prisma.application.findFirst({ where: { applicationId, studentId } }),
      prisma.intibakTable.findFirst({
        where: { applicationId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.applicationStageLog.findMany({
        where: { applicationId },
        orderBy: { occurredAt: "asc" },
      }),
    ]);
    if (!app) throw new Error("Application not found");

    return {
      applicationId: app.applicationId,
      studentFullName: app.studentFullName,
      currentStatus: app.currentStatus,
      submittedAt: app.submittedAt.toISOString(),
      lastModifiedAt: app.lastModifiedAt.toISOString(),
      intakeVerifiedAt: app.intakeVerifiedAt?.toISOString() ?? null,
      intakeVerifiedBy: app.intakeVerifiedBy ?? null,
      routedToYdyo: app.routedToYdyo,
      routedToDeansOffice: app.routedToDeansOffice,
      ydyoExempt: app.ydyoExempt,
      correctionReasons: Array.isArray(app.correctionReasons) ? app.correctionReasons as unknown[] : [],
      rejectionReason: app.rejectionReason ?? null,
      rankingCategory: app.rankingCategory ?? null,
      transferScore: app.transferScore ?? null,
      hasIntibak: !!intibakTable,
      hasLockedIntibak: intibakTable?.isLocked ?? false,
      intibak: intibakTable ? buildIntibakDetail(intibakTable) : null,
      stageLogs: stageLogs.map((l) => ({
        stageKey: l.stageKey,
        actorName: l.actorName ?? null,
        actorRole: l.actorRole ?? null,
        occurredAt: l.occurredAt.toISOString(),
        notes: l.notes ?? null,
      })),
      targetDepartmentId: app.targetDepartmentId,
      targetFacultyId: app.targetFacultyId,
      transferType: app.transferType,
      targetedSemester: app.targetedSemester ?? null,
      submittedGpa: app.submittedGpa,
      submittedYksScore: app.submittedYksScore ?? null,
      yksExamYear: app.yksExamYear ?? null,
      currentInstitution: app.currentInstitution ?? null,
      currentDepartment: app.currentDepartment ?? null,
    };
  }

  async cancel(studentId: string, applicationId: string): Promise<void> {
    const app = await prisma.application.findFirst({
      where: { applicationId, studentId },
    });

    if (!app) throw new Error("Application not found");

    const cancellableStatuses = ["DRAFT", "PENDING_DOCUMENT_UPLOAD"];
    if (!cancellableStatuses.includes(app.currentStatus)) {
      throw new Error("Bu aşamadaki başvuru iptal edilemez");
    }

    // Recursively remove all dependent rows before the application itself so the
    // FK constraints (documents, appeals, intibak tables, stage logs, and the
    // document_versions hanging off each document) don't block the delete.
    await prisma.$transaction(async (tx) => {
      const documents = await tx.document.findMany({
        where: { applicationId },
        select: { documentId: true },
      });
      const documentIds = documents.map((d) => d.documentId);

      if (documentIds.length > 0) {
        await tx.documentVersion.deleteMany({
          where: { documentId: { in: documentIds } },
        });
      }

      await tx.document.deleteMany({ where: { applicationId } });
      await tx.appeal.deleteMany({ where: { applicationId } });
      await tx.intibakTable.deleteMany({ where: { applicationId } });
      await tx.applicationStageLog.deleteMany({ where: { applicationId } });

      await tx.application.delete({ where: { applicationId } });
    });
  }
}

// ─── Intibak detail builder ─────────────────────────────────────────────────
// Resolves the locked intibak table's JSON columns (previousCourses,
// targetCurriculum, mappings) into display rows for the student result screen.
// "Exempted" ECTS counts only mappings that landed on a real target course.

interface PrevCourse { code: string; name: string; ects: number; letterGrade?: string }
interface TargetCourse { code: string; name: string; ects: number }
interface Mapping { sourceCourseCodes: string[]; targetCourseCode: string | null; status: string }

function buildIntibakDetail(table: {
  isLocked: boolean;
  previousCourses: unknown;
  targetCurriculum: unknown;
  mappings: unknown;
}): IntibakDetailDto {
  const prev = (table.previousCourses as PrevCourse[]) ?? [];
  const target = (table.targetCurriculum as TargetCourse[]) ?? [];
  const mappings = (table.mappings as Mapping[]) ?? [];

  const prevByCode = new Map(prev.map((c) => [c.code, c]));
  const targetByCode = new Map(target.map((c) => [c.code, c]));

  let totalExemptedEcts = 0;
  const rows: IntibakCourseRowDto[] = mappings.map((m) => {
    const sourceCourses = m.sourceCourseCodes
      .map((code) => prevByCode.get(code))
      .filter((c): c is PrevCourse => !!c)
      .map((c) => ({ code: c.code, name: c.name, ects: c.ects }));
    const t = m.targetCourseCode ? targetByCode.get(m.targetCourseCode) ?? null : null;
    const targetCourse = t ? { code: t.code, name: t.name, ects: t.ects } : null;
    if (targetCourse && (m.status === "APPROVED" || m.status === "SUGGESTED_MATCH" || m.status === "MANUAL_OVERRIDE")) {
      totalExemptedEcts += targetCourse.ects;
    }
    return { sourceCourses, targetCourse, status: m.status };
  });

  return { isLocked: table.isLocked, rows, totalExemptedEcts };
}
