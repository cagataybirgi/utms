import { buildTestKit, TEST_USERS } from "../test-helpers";
import { ApplicationStatus } from "../../src/shared/types";

describe("Test Case YDYO-D: OIDB forward routes non-exempt apps to YDYO queue", () => {
  it("OIDB verify + forward (non-exempt) sets IN_REVIEW_YDYO and YDYO officer can see it", async () => {
    const kit = buildTestKit();
    const oidb = kit.asUser(TEST_USERS.oidb);
    const ydyo = kit.asUser(TEST_USERS.ydyo);
    const targetId = "app-1002";

    await oidb.post(`/api/oidb/applications/${targetId}/verify`).send({});
    const forwardRes = await oidb
      .post(`/api/oidb/applications/${targetId}/forward`)
      .send({ ydyoExempt: false });
    expect(forwardRes.status).toBe(200);
    expect(forwardRes.body.application.currentStatus).toBe(ApplicationStatus.InReviewYdyo);
    expect(forwardRes.body.application.routedToYdyo).toBe(true);

    const queueRes = await ydyo.get("/api/ydyo/queue");
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.items.map((i: { applicationId: string }) => i.applicationId)).toContain(targetId);
  });

  it("OIDB forward with ydyoExempt skips YDYO and goes to PENDING_YGK_FORWARDING", async () => {
    const kit = buildTestKit();
    const oidb = kit.asUser(TEST_USERS.oidb);
    const targetId = "app-1003";

    await oidb.post(`/api/oidb/applications/${targetId}/verify`).send({});
    const forwardRes = await oidb
      .post(`/api/oidb/applications/${targetId}/forward`)
      .send({ ydyoExempt: true });
    expect(forwardRes.status).toBe(200);
    expect(forwardRes.body.application.currentStatus).toBe(ApplicationStatus.PendingYgkForwarding);
    expect(forwardRes.body.application.routedToYdyo).toBe(false);
    expect(forwardRes.body.application.ydyoExempt).toBe(true);
  });
});
