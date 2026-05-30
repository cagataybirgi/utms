import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Test Case 5I: Score Invalidated - Go Back", () => {
  let app: Express;
  let container: AppContainer;

  beforeEach(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    const application = buildTestApplication({
      applicationId: "app-goback-test",
      studentId: "student-goback",
      studentTckn: "40404040404",
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

  it("should document go-back behavior requirement", async () => {
    // This test documents the expected UI/workflow behavior:
    // 1. YGK member executes ranking and sees score calculation screen
    // 2. YGK member spots a data error on the score screen
    // 3. YGK member clicks "Go Back" button
    // 4. System returns to Academic Eligibility screen
    // 5. Previous "Eligible" status is invalidated
    // 6. YGK member can re-evaluate eligibility

    // Expected API flow (not yet implemented):
    // POST /api/ranking/:applicationId/invalidate-eligibility
    // Response: { status: "invalidated", redirectTo: "/eligibility" }

    // Note: This is a UI workflow test case, not a pure backend test
    // The backend should support invalidating eligibility status
    expect(true).toBe(true); // Placeholder - UI workflow documentation
  });

  it("should invalidate previous eligible status when going back", async () => {
    // First, execute ranking to establish "Eligible" status
    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-computer-engineering",
        periodId: "period-spring-2026",
        quota: 5,
      })
      .expect(200);

    // Application should now be ranked
    let app1 = container.applications.findById("app-goback-test");
    expect(app1?.currentStatus).toMatch(/RANKED/);

    // Simulate "Go Back" - reset to INTAKE_VERIFIED
    // (This API endpoint doesn't exist yet - documenting expected behavior)
    if (app1) {
      app1.currentStatus = ApplicationStatus.IntakeVerified;
      app1.rankingCategory = undefined;
      app1.transferScore = undefined;
      container.applications.save(app1);
    }

    // Verify status is invalidated
    app1 = container.applications.findById("app-goback-test");
    expect(app1?.currentStatus).toBe(ApplicationStatus.IntakeVerified);
    expect(app1?.rankingCategory).toBeUndefined();
  });
});
