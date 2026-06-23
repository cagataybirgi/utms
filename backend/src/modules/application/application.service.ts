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
  hasIntibak: boolean;
  hasLockedIntibak: boolean;
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
      hasIntibak: !!intibakTable,
      hasLockedIntibak: intibakTable?.isLocked ?? false,
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

    await prisma.application.delete({
      where: { applicationId },
    });
  }
}
