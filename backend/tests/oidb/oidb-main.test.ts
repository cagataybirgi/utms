import { buildTestKit, TEST_USERS } from "../test-helpers";
import { ApplicationStatus, DocumentType, DocumentVerificationBadge } from "../../src/shared/types";

describe("Test Case 4 (Main): OIDB-Main — successful verify and forward", () => {
  it("loads pool, opens detail with auto-verified badges, verifies, and forwards", async () => {
    const kit = buildTestKit();
    const officer = kit.asUser(TEST_USERS.oidb);

    const poolRes = await officer.get("/api/oidb/applications");
    expect(poolRes.status).toBe(200);
    expect(poolRes.body.count).toBeGreaterThan(0);
    const targetId = "app-1001";
    expect(poolRes.body.items.map((a: { applicationId: string }) => a.applicationId)).toContain(
      targetId,
    );

    const detailRes = await officer.get(`/api/oidb/applications/${targetId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.application.applicationId).toBe(targetId);
    const verifiedBadges = detailRes.body.verifications.filter(
      (v: { badge: string }) => v.badge === DocumentVerificationBadge.Verified,
    );
    expect(verifiedBadges.length).toBeGreaterThan(0);

    const verifyRes = await officer.post(`/api/oidb/applications/${targetId}/verify`).send({});
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.application.currentStatus).toBe(ApplicationStatus.IntakeVerified);
    expect(verifyRes.body.application.intakeVerifiedBy).toBe(TEST_USERS.oidb);

    const forwardRes = await officer
      .post(`/api/oidb/applications/${targetId}/forward`)
      .send({ ydyoExempt: false });
    expect(forwardRes.status).toBe(200);
    expect(forwardRes.body.application.currentStatus).toBe(ApplicationStatus.InReviewYdyo);
    expect(forwardRes.body.application.routedToYdyo).toBe(true);
    expect(forwardRes.body.application.routedToDeansOffice).toBe(false);

    const audit = kit.container.audit.findByEntity("Application", targetId);
    expect(audit.find((e) => e.actionType === "OIDB_VERIFY")).toBeDefined();
    expect(audit.find((e) => e.actionType === "OIDB_FORWARD")).toBeDefined();

    const notifs = kit.container.notifications.findByRecipient("student-ahmet-yilmaz");
    expect(notifs.find((n) => n.eventType === "OIDB_VERIFIED")).toBeDefined();
  });

  it("YDYO exempt flag flips routedToYdyo to false on forward", async () => {
    const kit = buildTestKit();
    const officer = kit.asUser(TEST_USERS.oidb);
    const targetId = "app-1001";
    await officer.post(`/api/oidb/applications/${targetId}/verify`).send({});
    const res = await officer
      .post(`/api/oidb/applications/${targetId}/forward`)
      .send({ ydyoExempt: true });
    expect(res.status).toBe(200);
    expect(res.body.application.routedToYdyo).toBe(false);
    expect(res.body.application.ydyoExempt).toBe(true);
  });

  it("only OIDB officer role may access endpoints (RBAC)", async () => {
    const kit = buildTestKit();
    const student = kit.asUser(TEST_USERS.student);
    const res = await student.get("/api/oidb/applications");
    expect(res.status).toBe(403);
  });

  it("missing auth header returns 401", async () => {
    const kit = buildTestKit();
    const res = await (await import("supertest")).default(kit.app).get("/api/oidb/applications");
    expect(res.status).toBe(401);
  });
});
