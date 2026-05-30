import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus, RankingCategory } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Ranking 5D: Ineligible - Expired YKS Score", () => {
  let app: Express;
  let container: AppContainer;

  beforeAll(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    const applications = [
      buildTestApplication({
        applicationId: "yks-app-01",
        studentId: "student-yks-01",
        studentTckn: "42345678901",
        studentFullName: "Old YKS Student",
        periodId: "period-yks-test",
        targetDepartmentId: "dept-me",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.5,
        submittedYksScore: 480.0,
        yksExamYear: 2020, // Expired (before 2022)
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "yks-app-02",
        studentId: "student-yks-02",
        studentTckn: "42345678902",
        studentFullName: "Valid YKS Student",
        periodId: "period-yks-test",
        targetDepartmentId: "dept-me",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.2,
        submittedYksScore: 470.0,
        yksExamYear: 2023, // Valid
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "yks-app-03",
        studentId: "student-yks-03",
        studentTckn: "42345678903",
        studentFullName: "No YKS Student",
        periodId: "period-yks-test",
        targetDepartmentId: "dept-me",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.0,
        submittedYksScore: undefined, // Missing YKS score
        yksExamYear: undefined,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
    ];

    applications.forEach((app) => container.applications.put(app));
  });

  it("should reject applications with expired or missing YKS scores", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-me",
        periodId: "period-yks-test",
        quota: 3,
      })
      .expect(200);

    expect(response.body.totalEvaluated).toBe(3);
    expect(response.body.eligible).toBe(1); // Only 1 valid
    expect(response.body.ineligible).toBe(2); // 1 expired, 1 missing
    expect(response.body.asilCount).toBe(1);

    // Verify expired YKS rejected
    const expiredApp = container.applications.findById("yks-app-01");
    expect(expiredApp?.currentStatus).toBe(ApplicationStatus.RankedRed);
    expect(expiredApp?.rankingCategory).toBe(RankingCategory.Red);
    expect(expiredApp?.rejectionReason).toContain("YKS exam year too old");
    expect(expiredApp?.rejectionReason).toContain("2020");
    expect(expiredApp?.rejectionReason).toContain("2022");

    // Verify missing YKS rejected
    const missingApp = container.applications.findById("yks-app-03");
    expect(missingApp?.currentStatus).toBe(ApplicationStatus.RankedRed);
    expect(missingApp?.rejectionReason).toContain("YKS score is required");

    // Verify valid YKS accepted
    const validApp = container.applications.findById("yks-app-02");
    expect(validApp?.currentStatus).toBe(ApplicationStatus.RankedAsil);
    expect(validApp?.transferScore).toBeGreaterThan(0);
  });
});
