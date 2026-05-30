import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";
import { AppContainer } from "../../src/shared/container";
import { ApplicationStatus, RankingCategory } from "../../src/shared/types";
import { buildTestApplication } from "./ranking-test-helpers";

describe("Ranking 5J: Audit Logging", () => {
  let app: Express;
  let container: AppContainer;

  beforeAll(() => {
    const created = createApp();
    app = created.app;
    container = created.container;

    const applications = [
      buildTestApplication({
        applicationId: "audit-app-01",
        studentId: "student-audit-01",
        studentTckn: "10234567890",
        studentFullName: "Eligible Student",
        periodId: "period-audit-test",
        targetDepartmentId: "dept-audit",
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
        applicationId: "audit-app-02",
        studentId: "student-audit-02",
        studentTckn: "10234567891",
        studentFullName: "Ineligible Student",
        periodId: "period-audit-test",
        targetDepartmentId: "dept-audit",
        targetFacultyId: "faculty-engineering",
        transferType: "HORIZONTAL",
        targetSemester: 3,
        submittedGpa: 2.2, // Below minimum
        submittedYksScore: 470.0,
        yksExamYear: 2024,
        finishedSemester: 3,
        currentStatus: ApplicationStatus.IntakeVerified,
      }),
    ];

    applications.forEach((app) => container.applications.put(app));
  });

  it("should create audit logs for ranking execution", async () => {
    const initialAuditCount = container.audit.findAll().length;

    await request(app)
      .post("/api/ranking/execute")
      .set("x-mock-user", "user-ygk-chair-cmpe")
      .send({
        departmentId: "dept-audit",
        periodId: "period-audit-test",
        quota: 1,
      })
      .expect(200);

    const auditLogs = container.audit.findAll();
    const newLogs = auditLogs.slice(initialAuditCount);

    // Should have 2 audit logs (1 for eligible, 1 for ineligible)
    expect(newLogs.length).toBe(2);

    // Check eligible student audit log
    const eligibleLog = newLogs.find(
      (log) => log.affectedEntityId === "audit-app-01"
    );
    expect(eligibleLog).toBeDefined();
    expect(eligibleLog?.actorUserId).toBe("user-ygk-chair-cmpe");
    expect(eligibleLog?.actorRole).toBe("YGK_CHAIR");
    expect(eligibleLog?.actionType).toBe("RANKING_ASSIGNED");
    expect(eligibleLog?.affectedEntityType).toBe("Application");

    const eligibleNewValue = JSON.parse(eligibleLog!.newValue || "{}");
    expect(eligibleNewValue.category).toBe(RankingCategory.Asil);
    expect(eligibleNewValue.status).toBe(ApplicationStatus.RankedAsil);
    expect(eligibleNewValue.rank).toBe(1);
    expect(parseFloat(eligibleNewValue.score)).toBeCloseTo(1.214, 2);

    const eligiblePrevValue = JSON.parse(eligibleLog!.previousValue || "{}");
    expect(eligiblePrevValue.status).toBe(ApplicationStatus.IntakeVerified);

    // Check ineligible student audit log
    const ineligibleLog = newLogs.find(
      (log) => log.affectedEntityId === "audit-app-02"
    );
    expect(ineligibleLog).toBeDefined();
    expect(ineligibleLog?.actionType).toBe("RANKING_INELIGIBLE");

    const ineligibleNewValue = JSON.parse(ineligibleLog!.newValue || "{}");
    expect(ineligibleNewValue.category).toBe(RankingCategory.Red);
    expect(ineligibleNewValue.reason).toContain("Minimum GPA");
  });
});
