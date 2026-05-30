import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus, RankingCategory } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Test Case 5E: Department Conditions - No Conditions Defined (Auto Pass)", () => {
  let app: Express;
  let container: AppContainer;

  beforeEach(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    // Burak Çelik: GPA 2.90, semester 5, Civil Engineering (no dept conditions defined)
    const application = buildTestApplication({
      applicationId: "app-burak-celik",
      studentId: "student-burak",
      studentTckn: "99999999999",
      studentFullName: "Burak Çelik",
      periodId: "period-spring-2026",
      targetDepartmentId: "dept-civil-engineering",
      targetFacultyId: "faculty-engineering",
      targetSemester: 5,
      submittedGpa: 2.90,
      submittedYksScore: 455.0,
      yksExamYear: 2024,
      finishedSemester: 5,
      currentStatus: ApplicationStatus.IntakeVerified,
    });

    container.applications.put(application);
  });

  it("should auto-pass department conditions when none are defined", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-civil-engineering",
        periodId: "period-spring-2026",
        quota: 5,
      })
      .expect(200);

    expect(response.body.totalEvaluated).toBe(1);
    expect(response.body.eligible).toBe(1);
    expect(response.body.ineligible).toBe(0);

    // Verify the applicant passed and proceeded to score calculation
    const burak = container.applications.findById("app-burak-celik");
    expect(burak?.rankingCategory).toBe(RankingCategory.Asil);
    expect(burak?.transferScore).toBeGreaterThan(0);
  });

  it("should proceed to score calculation after auto-pass", async () => {
    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-civil-engineering",
        periodId: "period-spring-2026",
        quota: 5,
      })
      .expect(200);

    const burak = container.applications.findById("app-burak-celik");

    // Verify score was calculated: (455/500 * 0.90) + (2.90 * 0.10) = 0.819 + 0.29 = 1.109
    expect(burak?.transferScore).toBeCloseTo(1.109, 2);
  });
});
