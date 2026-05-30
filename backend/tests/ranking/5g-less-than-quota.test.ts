import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus, RankingCategory } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Ranking 5G: Eligible Applicants Less Than Quota", () => {
  let app: Express;
  let container: AppContainer;

  beforeAll(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    // Only 3 eligible applicants for a quota of 8
    const applications = [
      buildTestApplication({
        applicationId: "quota-app-01",
        studentId: "student-quota-01",
        studentTckn: "72345678901",
        studentFullName: "Top Student",
        periodId: "period-quota-test",
        targetDepartmentId: "dept-quota",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.8,
        submittedYksScore: 490.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "quota-app-02",
        studentId: "student-quota-02",
        studentTckn: "72345678902",
        studentFullName: "Middle Student",
        periodId: "period-quota-test",
        targetDepartmentId: "dept-quota",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.2,
        submittedYksScore: 470.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "quota-app-03",
        studentId: "student-quota-03",
        studentTckn: "72345678903",
        studentFullName: "Lower Student",
        periodId: "period-quota-test",
        targetDepartmentId: "dept-quota",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 2.8,
        submittedYksScore: 455.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
    ];

    applications.forEach((app) => container.applications.put(app));
  });

  it("should mark all eligible as ASIL when below quota (no YEDEK)", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-quota",
        periodId: "period-quota-test",
        quota: 8,
      })
      .expect(200);

    expect(response.body.totalEvaluated).toBe(3);
    expect(response.body.eligible).toBe(3);
    expect(response.body.ineligible).toBe(0);
    expect(response.body.asilCount).toBe(3); // All 3 marked as ASIL
    expect(response.body.yedekCount).toBe(0); // No YEDEK since all fit in quota
    expect(response.body.redCount).toBe(0); // No RED

    const rankings = response.body.rankings;
    expect(rankings).toHaveLength(3);

    // All should be ASIL
    expect(rankings[0].category).toBe(RankingCategory.Asil);
    expect(rankings[1].category).toBe(RankingCategory.Asil);
    expect(rankings[2].category).toBe(RankingCategory.Asil);

    // Verify database state
    const app1 = container.applications.findById("quota-app-01");
    expect(app1?.rankingCategory).toBe(RankingCategory.Asil);
    expect(app1?.currentStatus).toBe(ApplicationStatus.RankedAsil);

    const app3 = container.applications.findById("quota-app-03");
    expect(app3?.rankingCategory).toBe(RankingCategory.Asil);
  });
});
