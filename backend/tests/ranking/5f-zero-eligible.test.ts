import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus, RankingCategory } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Ranking 5F: Zero Eligible Applicants", () => {
  let app: Express;
  let container: AppContainer;

  beforeAll(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    // All applicants fail eligibility for different reasons
    const applications = [
      buildTestApplication({
        applicationId: "zero-app-01",
        studentId: "student-zero-01",
        studentTckn: "62345678901",
        studentFullName: "Low GPA",
        periodId: "period-zero-test",
        targetDepartmentId: "dept-zero",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 2.2, // Too low
        submittedYksScore: 480.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "zero-app-02",
        studentId: "student-zero-02",
        studentTckn: "62345678902",
        studentFullName: "Invalid Semester",
        periodId: "period-zero-test",
        targetDepartmentId: "dept-zero",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.5,
        submittedYksScore: 470.0,
        yksExamYear: 2024,
        finishedSemester: 2, // Invalid
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "zero-app-03",
        studentId: "student-zero-03",
        studentTckn: "62345678903",
        studentFullName: "No YKS",
        periodId: "period-zero-test",
        targetDepartmentId: "dept-zero",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.0,
        submittedYksScore: undefined, // Missing
        yksExamYear: undefined,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
    ];

    applications.forEach((app) => container.applications.put(app));
  });

  it("should handle case where all applicants are ineligible", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-zero",
        periodId: "period-zero-test",
        quota: 5,
      })
      .expect(200);

    expect(response.body.totalEvaluated).toBe(3);
    expect(response.body.eligible).toBe(0);
    expect(response.body.ineligible).toBe(3);
    expect(response.body.asilCount).toBe(0);
    expect(response.body.yedekCount).toBe(0);
    expect(response.body.redCount).toBe(3);
    expect(response.body.rankings).toHaveLength(0); // No ranked students

    // Verify all marked as RED with reasons
    const app1 = container.applications.findById("zero-app-01");
    expect(app1?.currentStatus).toBe(ApplicationStatus.RankedRed);
    expect(app1?.rankingCategory).toBe(RankingCategory.Red);
    expect(app1?.rejectionReason).toContain("Minimum GPA");

    const app2 = container.applications.findById("zero-app-02");
    expect(app2?.rejectionReason).toContain("Invalid semester");

    const app3 = container.applications.findById("zero-app-03");
    expect(app3?.rejectionReason).toContain("YKS score is required");
  });
});
