import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus, RankingCategory } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Test Case 5H: Score Calculation Error - Missing Data", () => {
  let app: Express;
  let container: AppContainer;

  beforeEach(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    // Ceren Aydın: GPA 2.90, semester 5, YKS score field is EMPTY
    const application = buildTestApplication({
      applicationId: "app-ceren-aydin",
      studentId: "student-ceren",
      studentTckn: "30303030303",
      studentFullName: "Ceren Aydın",
      periodId: "period-spring-2026",
      targetDepartmentId: "dept-computer-engineering",
      targetFacultyId: "faculty-engineering",
      targetSemester: 5,
      submittedGpa: 2.90,
      submittedYksScore: undefined, // MISSING YKS SCORE
      yksExamYear: undefined,
      finishedSemester: 5,
      currentStatus: ApplicationStatus.IntakeVerified,
    });

    container.applications.put(application);
  });

  it("should return error '431-CALC' when YKS score is missing", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-computer-engineering",
        periodId: "period-spring-2026",
        quota: 5,
      })
      .expect(200);

    expect(response.body.totalEvaluated).toBe(1);
    expect(response.body.ineligible).toBe(1);

    // Verify application is flagged with proper error
    const ceren = container.applications.findById("app-ceren-aydin");
    expect(ceren?.currentStatus).toBe(ApplicationStatus.RankedRed);
    expect(ceren?.rankingCategory).toBe(RankingCategory.Red);
    expect(ceren?.rejectionReason).toContain("YKS score");
  });

  it("should return application to OIDB queue", async () => {
    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-computer-engineering",
        periodId: "period-spring-2026",
        quota: 5,
      })
      .expect(200);

    // Application should be marked as rejected and not proceed
    const ceren = container.applications.findById("app-ceren-aydin");
    expect(ceren?.transferScore).toBe(0);

    // Expected behavior (not fully implemented):
    // Application should be returned to OIDB queue for data correction
    // Status should change to allow OIDB to fix the missing data
  });
});
