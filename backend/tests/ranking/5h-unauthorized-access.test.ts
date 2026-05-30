import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Ranking 5H: Unauthorized Access Control", () => {
  let app: Express;
  let container: AppContainer;

  beforeAll(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    const application = buildTestApplication({
        applicationId: "auth-app-01",
      studentId: "student-auth-01",
      studentTckn: "82345678901",
      studentFullName: "Test Student",
      periodId: "period-auth-test",
      targetDepartmentId: "dept-auth",
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

  it("should reject ranking execution from non-YGK users", async () => {
    // Student trying to execute ranking
    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "student-ahmet-yilmaz")
      .send({
        departmentId: "dept-auth",
        periodId: "period-auth-test",
        quota: 5,
      })
      .expect(403); // Forbidden

    // OIDB Officer trying to execute ranking
    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-oidb-1")
      .send({
        departmentId: "dept-auth",
        periodId: "period-auth-test",
        quota: 5,
      })
      .expect(403);

    // YGK Member (not Chair) trying to execute ranking
    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-cmpe-1")
      .send({
        departmentId: "dept-auth",
        periodId: "period-auth-test",
        quota: 5,
      })
      .expect(403);
  });

  it("should allow YGK Chair to execute ranking", async () => {
    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-auth",
        periodId: "period-auth-test",
        quota: 5,
      })
      .expect(200);
  });

  it("should allow SystemAdmin to execute ranking", async () => {
    // Reset application status first
    const application = container.applications.findById("auth-app-01");
    if (application) {
      application.currentStatus = ApplicationStatus.IntakeVerified;
      application.rankingCategory = undefined;
      container.applications.save(application);
    }

    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-admin")
      .send({
        departmentId: "dept-auth",
        periodId: "period-auth-test",
        quota: 5,
      })
      .expect(200);
  });

  it("should allow YGK Member to view results (read-only)", async () => {
    await request(app)
      .get("/api/ranking/dept-auth/period-auth-test/results")
      .set("x-mock-user", "user-ygk-cmpe-1")
      .expect(200);
  });

  it("should reject students from viewing ranking results", async () => {
    await request(app)
      .get("/api/ranking/dept-auth/period-auth-test/results")
      .set("x-mock-user", "student-ahmet-yilmaz")
      .expect(403);
  });
});
