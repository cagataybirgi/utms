import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus, RankingCategory } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Test Case 5D: Academic Eligibility Fails - Invalid Semester", () => {
  let app: Express;
  let container: AppContainer;

  beforeEach(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    // Deniz Arslan: GPA 3.10, semester 4 (INVALID - only 3 or 5 allowed)
    const application = buildTestApplication({
      applicationId: "app-deniz-arslan",
      studentId: "student-deniz",
      studentTckn: "88888888888",
      studentFullName: "Deniz Arslan",
      periodId: "period-spring-2026",
      targetDepartmentId: "dept-computer-engineering",
      targetFacultyId: "faculty-engineering",
      targetSemester: 3,
      submittedGpa: 3.10,
      submittedYksScore: 465.0,
      yksExamYear: 2024,
      finishedSemester: 4, // INVALID SEMESTER
      currentStatus: ApplicationStatus.IntakeVerified,
    });

    container.applications.put(application);
  });

  it("should flag applicant as not eligible due to invalid semester", async () => {
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
    expect(response.body.eligible).toBe(0);
    expect(response.body.ineligible).toBe(1);

    // Verify the applicant is marked as RED with proper reason
    const deniz = container.applications.findById("app-deniz-arslan");
    expect(deniz?.currentStatus).toBe(ApplicationStatus.RankedRed);
    expect(deniz?.rankingCategory).toBe(RankingCategory.Red);
    expect(deniz?.rejectionReason).toContain("Invalid semester");
    expect(deniz?.rejectionReason).toContain("3rd or 5th semester");
    expect(deniz?.transferScore).toBe(0);
  });

  it("should display warning message about semester eligibility", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-computer-engineering",
        periodId: "period-spring-2026",
        quota: 5,
      })
      .expect(200);

    // The rejection reason should contain the warning
    const deniz = container.applications.findById("app-deniz-arslan");
    expect(deniz?.rejectionReason).toMatch(/Only 3rd or 5th semester.*eligible/i);
  });

  it("should not proceed to department conditions check", async () => {
    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-computer-engineering",
        periodId: "period-spring-2026",
        quota: 5,
      })
      .expect(200);

    // Applicant should be rejected at eligibility phase, not proceed further
    const deniz = container.applications.findById("app-deniz-arslan");
    expect(deniz?.transferScore).toBe(0); // No score calculated
  });
});
