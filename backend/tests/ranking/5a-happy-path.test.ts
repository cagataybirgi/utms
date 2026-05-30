import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus, RankingCategory } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Ranking 5A: Happy Path - Full Ranking Workflow", () => {
  let app: Express;
  let container: AppContainer;

  beforeAll(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    // Seed test data: 10 applications, all INTAKE_VERIFIED
    const applications = [
      buildTestApplication({
        applicationId: "rank-app-01",
        studentId: "student-01",
        studentTckn: "12345678901",
        studentFullName: "Ali Yılmaz",
        periodId: "period-spring-2026",
        targetDepartmentId: "dept-computer-engineering",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.5,
        submittedYksScore: 480.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "rank-app-02",
        studentId: "student-02",
        studentTckn: "12345678902",
        studentFullName: "Ayşe Demir",
        periodId: "period-spring-2026",
        targetDepartmentId: "dept-computer-engineering",
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
        applicationId: "rank-app-03",
        studentId: "student-03",
        studentTckn: "12345678903",
        studentFullName: "Mehmet Kaya",
        periodId: "period-spring-2026",
        targetDepartmentId: "dept-computer-engineering",
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
        applicationId: "rank-app-04",
        studentId: "student-04",
        studentTckn: "12345678904",
        studentFullName: "Fatma Özkan",
        periodId: "period-spring-2026",
        targetDepartmentId: "dept-computer-engineering",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.0,
        submittedYksScore: 460.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "rank-app-05",
        studentId: "student-05",
        studentTckn: "12345678905",
        studentFullName: "Can Arslan",
        periodId: "period-spring-2026",
        targetDepartmentId: "dept-computer-engineering",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.6,
        submittedYksScore: 485.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "rank-app-06",
        studentId: "student-06",
        studentTckn: "12345678906",
        studentFullName: "Zeynep Çelik",
        periodId: "period-spring-2026",
        targetDepartmentId: "dept-computer-engineering",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.3,
        submittedYksScore: 475.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "rank-app-07",
        studentId: "student-07",
        studentTckn: "12345678907",
        studentFullName: "Burak Yıldız",
        periodId: "period-spring-2026",
        targetDepartmentId: "dept-computer-engineering",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 2.9,
        submittedYksScore: 455.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "rank-app-08",
        studentId: "student-08",
        studentTckn: "12345678908",
        studentFullName: "Elif Koç",
        periodId: "period-spring-2026",
        targetDepartmentId: "dept-computer-engineering",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.4,
        submittedYksScore: 478.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "rank-app-09",
        studentId: "student-09",
        studentTckn: "12345678909",
        studentFullName: "Emre Aydın",
        periodId: "period-spring-2026",
        targetDepartmentId: "dept-computer-engineering",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 3.1,
        submittedYksScore: 465.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
      buildTestApplication({
        applicationId: "rank-app-10",
        studentId: "student-10",
        studentTckn: "12345678910",
        studentFullName: "Selin Öztürk",
        periodId: "period-spring-2026",
        targetDepartmentId: "dept-computer-engineering",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 2.8,
        submittedYksScore: 450.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
    ];

    applications.forEach((app) => container.applications.put(app));
  });

  it("should execute ranking successfully with quota 5 (5 ASIL, 1 YEDEK, 4 RED)", async () => {
    const response = await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-computer-engineering",
        periodId: "period-spring-2026",
        quota: 5,
      })
      .expect(200);

    expect(response.body.totalEvaluated).toBe(10);
    expect(response.body.eligible).toBe(10); // All eligible
    expect(response.body.ineligible).toBe(0);
    expect(response.body.asilCount).toBe(5);
    expect(response.body.yedekCount).toBe(1); // 20% of quota = 1
    expect(response.body.redCount).toBe(4);

    const rankings = response.body.rankings;
    expect(rankings).toHaveLength(10);

    // Verify rank 1: Best score (GPA 3.8, YKS 490)
    // Score = (490 / 500 * 0.90) + (3.8 * 0.10) = 0.882 + 0.38 = 1.262
    expect(rankings[0].studentFullName).toBe("Mehmet Kaya");
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].category).toBe(RankingCategory.Asil);
    expect(rankings[0].transferScore).toBeCloseTo(1.262, 3);

    // Verify rank 5: Last ASIL
    expect(rankings[4].category).toBe(RankingCategory.Asil);

    // Verify rank 6: First YEDEK
    expect(rankings[5].category).toBe(RankingCategory.Yedek);

    // Verify rank 7+: RED
    expect(rankings[6].category).toBe(RankingCategory.Red);

    // Verify database updates
    const app1 = container.applications.findById("rank-app-03");
    expect(app1?.currentStatus).toBe(ApplicationStatus.RankedAsil);
    expect(app1?.rankingCategory).toBe(RankingCategory.Asil);
    expect(app1?.transferScore).toBeCloseTo(1.262, 3);
  });

  it("should retrieve ranking results after execution", async () => {
    const response = await request(app)
      .get("/api/ranking/dept-computer-engineering/period-spring-2026/results")
      .set("x-mock-user", "user-ygk-cmpe-1")
      .expect(200);

    // Filter to only our test applications
    const testResults = response.body.results.filter((r: any) =>
      r.applicationId.startsWith("rank-app-")
    );

    expect(testResults).toHaveLength(10);
    expect(testResults[0].rank).toBe(1);
    expect(testResults[0].studentFullName).toBe("Mehmet Kaya");
  });

  it("should retrieve department overview", async () => {
    const response = await request(app)
      .get("/api/ranking/dept-computer-engineering/period-spring-2026/overview")
      .set("x-mock-user", "user-ygk-cmpe-1")
      .expect(200);

    // Just verify our test applications are included
    expect(response.body.overview.totalApplications).toBeGreaterThanOrEqual(10);
    expect(response.body.overview.asilList.filter((id: string) => id.startsWith("rank-app-"))).toHaveLength(5);
    expect(response.body.overview.yedekList.filter((id: string) => id.startsWith("rank-app-"))).toHaveLength(1);
    expect(response.body.overview.redList.filter((id: string) => id.startsWith("rank-app-"))).toHaveLength(4);
  });
});
