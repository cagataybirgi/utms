import { Application, ApplicationStatus } from "../../src/shared/types";

/**
 * Helper to create minimal test applications with all required fields
 */
export function buildTestApplication(
  partial: Partial<Application> & { applicationId: string }
): Application {
  return {
    studentId: "student-test",
    studentTckn: "00000000000",
    studentFullName: "Test Student",
    periodId: "period-test",
    targetDepartmentId: "dept-test",
    targetFacultyId: "faculty-test",
    transferType: "HORIZONTAL",
    targetSemester: 3,
    submittedGpa: 3.0,
    submittedYksScore: 450,
    yksExamYear: 2024,
    finishedSemester: 3,
    currentStatus: ApplicationStatus.IntakeVerified,
    preScreening: { isPassed: true, failedRules: [] },
    correctionReasons: [],
    routedToYdyo: false,
    routedToDeansOffice: false,
    ydyoExempt: false,
    submittedAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    ...partial,
  };
}
