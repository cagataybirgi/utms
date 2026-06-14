import { buildTestKit, TEST_USERS } from "../test-helpers";
import { ApplicationStatus } from "../../src/shared/types";

describe("Test Case YDYO-A: Main flow — queue, detail, successful decision", () => {
  it("lists YDYO queue, opens detail with evaluation, records SUCCESSFUL decision", async () => {
    const kit = buildTestKit();
    const officer = kit.asUser(TEST_USERS.ydyo);

    const queueRes = await officer.get("/api/ydyo/queue");
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.items.length).toBeGreaterThanOrEqual(4);
    const targetId = "app-ydyo-1";
    expect(queueRes.body.items.map((i: { applicationId: string }) => i.applicationId)).toContain(targetId);

    const pending = queueRes.body.items.find((i: { applicationId: string }) => i.applicationId === targetId);
    expect(pending.decision).toBeNull();
    expect(pending.examType).toBe("TOEFL_IBT");
    expect(pending.score).toBe(88);

    const detailRes = await officer.get(`/api/ydyo/${targetId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.application.applicationId).toBe(targetId);
    expect(detailRes.body.languageProof.score).toBe(88);
    expect(detailRes.body.evaluation.meetsMinimum).toBe(true);
    expect(detailRes.body.evaluation.suggestedDecision).toBe("SUCCESSFUL");

    const decideRes = await officer
      .post(`/api/ydyo/${targetId}/decision`)
      .send({ decision: "SUCCESSFUL", notes: "TOEFL score meets minimum requirement." });
    expect(decideRes.status).toBe(200);
    expect(decideRes.body.application.ydyoDecision).toBe("SUCCESSFUL");
    expect(decideRes.body.application.ydyoReviewedBy).toBe(TEST_USERS.ydyo);
    expect(decideRes.body.application.currentStatus).toBe(ApplicationStatus.PendingYgkForwarding);
    expect(decideRes.body.application.routedToDeansOffice).toBe(true);

    const audit = kit.container.audit.findByEntity("Application", targetId);
    expect(audit.find((e) => e.actionType === "YDYO_LANGUAGE_DECISION")).toBeDefined();

    const notifs = kit.container.notifications.findByRecipient("student-ahmet-yilmaz");
    expect(notifs.find((n) => n.eventType === "YDYO_DECISION")).toBeDefined();
  });
});
