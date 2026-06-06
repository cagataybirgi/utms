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
    // Duplicate check: block if student already has an active (non-draft) application for this period
    if (!dto.isDraft) {
      const existing = await prisma.application.findFirst({
        where: {
          studentId,
          periodId: dto.periodId,
          currentStatus: { not: "DRAFT" },
        },
      });
      if (existing) {
        throw new Error(`Bu dönem için zaten aktif bir başvurunuz bulunmaktadır. Başvuru ID: ${existing.applicationId}`);
      }
    }

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
