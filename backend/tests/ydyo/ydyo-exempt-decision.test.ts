import { buildTestKit, TEST_USERS } from "../test-helpers";

describe("Test Case YDYO-B: Exempt decision for high TOEFL score", () => {
  it("records EXEMPT and sets ydyoExempt flag for app-ydyo-4 (score 92)", async () => {
    const kit = buildTestKit();
    const officer = kit.asUser(TEST_USERS.ydyo);
    const targetId = "app-ydyo-4";

    const detailRes = await officer.get(`/api/ydyo/${targetId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.evaluation.qualifiesForExemption).toBe(true);
    expect(detailRes.body.evaluation.suggestedDecision).toBe("EXEMPT");

    const decideRes = await officer
      .post(`/api/ydyo/${targetId}/decision`)
      .send({ decision: "EXEMPT" });
    expect(decideRes.status).toBe(200);
    expect(decideRes.body.application.ydyoDecision).toBe("EXEMPT");
    expect(decideRes.body.application.ydyoExempt).toBe(true);
  });
});
