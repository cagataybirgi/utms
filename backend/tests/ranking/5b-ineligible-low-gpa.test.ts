import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { buildTestApplication } from "./ranking-test-helpers";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus, RankingCategory } from "../../src/shared/types";

describe("Ranking 5B: Ineligible - Low GPA", () => {
  let app: Express;
  let container: AppContainer;

  beforeAll(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    // Seed test data: 3 applications, 2 eligible, 1 with low GPA
    const applications = [
      buildTestApplication({
        applicationId: "low-gpa-app-01",
        studentId: "student-low-01",
        studentTckn: "22345678901",
        studentFullName: "Low GPA Student",
        periodId: "period-fall-2026",
        targetDepartmentId: "dept-cs",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 2.3, // Below 2.5 minimum
        submittedYksScore: 480.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "low-gpa-app-02",
        studentId: "student-low-02",
        studentTckn: "22345678902",
        studentFullName: "Eligible Student 1",
        periodId: "period-fall-2026",
        targetDepartmentId: "dept-cs",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.0,
        submittedYksScore: 470.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "low-gpa-app-03",
        studentId: "student-low-03",
        studentTckn: "22345678903",
        studentFullName: "Eligible Student 2",
        periodId: "period-fall-2026",
        targetDepartmentId: "dept-cs",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 2.8,
        submittedYksScore: 460.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
    ];

    applications.forEach((app) => container.applications.put(app));
  });

  it("should reject application with GPA below 2.5", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-cs",
        periodId: "period-fall-2026",
        quota: 2,
      })
      .expect(200);

    expect(response.body.totalEvaluated).toBe(3);
    expect(response.body.eligible).toBe(2);
    expect(response.body.ineligible).toBe(1);
    expect(response.body.asilCount).toBe(2);
    expect(response.body.yedekCount).toBe(0);
    expect(response.body.redCount).toBe(1);

    // Verify ineligible student is marked RED
    const lowGpaApp = container.applications.findById("low-gpa-app-01");
    expect(lowGpaApp?.currentStatus).toBe(ApplicationStatus.RankedRed);
    expect(lowGpaApp?.rankingCategory).toBe(RankingCategory.Red);
    expect(lowGpaApp?.rejectionReason).toContain("Minimum GPA requirement not met");
    expect(lowGpaApp?.rejectionReason).toContain("2.30 < 2.5");
    expect(lowGpaApp?.transferScore).toBe(0);

    // Verify eligible students are ranked
    const eligible1 = container.applications.findById("low-gpa-app-02");
    expect(eligible1?.currentStatus).toBe(ApplicationStatus.RankedAsil);
    expect(eligible1?.rankingCategory).toBe(RankingCategory.Asil);
    expect(eligible1?.transferScore).toBeGreaterThan(0);
  });
});
