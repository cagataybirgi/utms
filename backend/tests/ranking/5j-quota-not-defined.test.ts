import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Test Case 5J: Ranking Blocked - Quota Not Defined", () => {
  let app: Express;
  let container: AppContainer;

  beforeEach(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    const application = buildTestApplication({
      applicationId: "app-quota-test",
      studentId: "student-quota",
      studentTckn: "50505050505",
      studentFullName: "Test Applicant",
      periodId: "period-spring-2026",
      targetDepartmentId: "dept-computer-engineering",
      targetFacultyId: "faculty-engineering",
      targetSemester: 3,
      submittedGpa: 3.00,
      submittedYksScore: 460.0,
      yksExamYear: 2024,
      finishedSemester: 3,
      currentStatus: ApplicationStatus.IntakeVerified,
    });

    container.applications.put(application);
  });

  it("should block ranking when quota is not provided", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-computer-engineering",
        periodId: "period-spring-2026",
        // quota is missing
      })
      .expect(400);

    expect(response.body.message).toContain("quota");
  });

  it("should display error when quota is not configured", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-computer-engineering",
        periodId: "period-spring-2026",
        quota: undefined,
      })
      .expect(400);

    expect(response.body.message).toMatch(/quota.*required/i);
  });

  it("should reject zero or negative quota", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-computer-engineering",
        periodId: "period-spring-2026",
        quota: 0,
      })
      .expect(400);

    expect(response.body.message).toContain("positive number");
  });

  it("should prevent ranking execution without valid quota", async () => {
    // Attempt ranking with invalid quota
    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-computer-engineering",
        periodId: "period-spring-2026",
        quota: -5,
      })
      .expect(400);

    // Verify no ranking occurred
    const app1 = container.applications.findById("app-quota-test");
    expect(app1?.currentStatus).toBe(ApplicationStatus.IntakeVerified);
    expect(app1?.rankingCategory).toBeUndefined();
  });
});
