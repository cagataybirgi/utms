import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus, RankingCategory } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Test Case 5G: Department Conditions Met", () => {
  let app: Express;
  let container: AppContainer;

  beforeEach(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    // Mert Şahin: GPA 3.20, semester 3, Architecture
    // Studio grade AA (meets requirement), portfolio uploaded
    const application = buildTestApplication({
      applicationId: "app-mert-sahin",
      studentId: "student-mert",
      studentTckn: "20202020202",
      studentFullName: "Mert Şahin",
      periodId: "period-spring-2026",
      targetDepartmentId: "dept-architecture",
      targetFacultyId: "faculty-architecture",
      targetSemester: 3,
      submittedGpa: 3.20,
      submittedYksScore: 470.0,
      yksExamYear: 2024,
      finishedSemester: 3,
      currentStatus: ApplicationStatus.IntakeVerified,
    });

    container.applications.put(application);
  });

  it("should pass department conditions and proceed to score calculation", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-architecture",
        periodId: "period-spring-2026",
        quota: 5,
      })
      .expect(200);

    expect(response.body.totalEvaluated).toBe(1);
    expect(response.body.eligible).toBe(1);

    // Verify score was calculated
    const mert = container.applications.findById("app-mert-sahin");
    expect(mert?.rankingCategory).toBe(RankingCategory.Asil);
    expect(mert?.transferScore).toBeGreaterThan(0);
  });

  it("should calculate transfer score after passing conditions", async () => {
    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-architecture",
        periodId: "period-spring-2026",
        quota: 5,
      })
      .expect(200);

    const mert = container.applications.findById("app-mert-sahin");

    // Score = (470/500 * 0.90) + (3.20 * 0.10) = 0.846 + 0.32 = 1.166
    expect(mert?.transferScore).toBeCloseTo(1.166, 2);
    expect(mert?.currentStatus).toBe(ApplicationStatus.RankedAsil);
  });
});
