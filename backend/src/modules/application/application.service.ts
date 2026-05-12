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
}

export class ApplicationService {
  async create(studentId: string, dto: CreateApplicationDto): Promise<{ applicationId: string }> {
    const application = await prisma.application.create({
      data: {
        studentId,
        studentTckn: dto.studentTckn,
        studentFullName: dto.studentFullName,
        periodId: dto.periodId,
        targetDepartmentId: dto.targetDepartmentId,
        targetFacultyId: dto.targetFacultyId,
        transferType: dto.transferType,
        targetedSemester: dto.targetSemester,
        submittedGpa: dto.submittedGpa,
        submittedYksScore: dto.submittedYksScore,
        yksExamYear: dto.yksExamYear,
        currentInstitution: dto.currentInstitution,
        currentDepartment: dto.currentDepartment,
        currentStatus: ApplicationStatus.PendingDocumentUpload,
      },
    });
    return { applicationId: application.applicationId };
  }
}
