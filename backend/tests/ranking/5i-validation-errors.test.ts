import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Ranking 5I: Validation Errors", () => {
  let app: Express;
  let container: AppContainer;

  beforeAll(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    const application = buildTestApplication({
        applicationId: "val-app-01",
      studentId: "student-val-01",
      studentTckn: "92345678901",
      studentFullName: "Test Student",
      periodId: "period-val-test",
      targetDepartmentId: "dept-val",
      targetFacultyId: "faculty-engineering",
      transferType: "HORIZONTAL",
      targetSemester: 3,
      submittedGpa: 3.5,
      submittedYksScore: 480.0,
      yksExamYear: 2024,
      finishedSemester: 3,
      currentStatus: ApplicationStatus.IntakeVerified,
      });

    container.applications.put(application);
  });

  it("should reject ranking with missing departmentId", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        periodId: "period-val-test",
        quota: 5,
      })
      .expect(400);

    expect(response.body.message).toContain("departmentId");
  });

  it("should reject ranking with missing periodId", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-val",
        quota: 5,
      })
      .expect(400);

    expect(response.body.message).toContain("periodId");
  });

  it("should reject ranking with missing quota", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-val",
        periodId: "period-val-test",
      })
      .expect(400);

    expect(response.body.message).toContain("quota");
  });

  it("should reject ranking with zero or negative quota", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-val",
        periodId: "period-val-test",
        quota: 0,
      })
      .expect(400);

    expect(response.body.message).toContain("Quota must be a positive number");

    const response2 = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-val",
        periodId: "period-val-test",
        quota: -5,
      })
      .expect(400);

    expect(response2.body.message).toContain("Quota must be a positive number");
  });

  it("should return 404 when no applications found for department/period", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-nonexistent",
        periodId: "period-nonexistent",
        quota: 5,
      })
      .expect(404);

    expect(response.body.message).toContain("No applications found");
    expect(response.body.message).toContain("INTAKE_VERIFIED");
  });
});
