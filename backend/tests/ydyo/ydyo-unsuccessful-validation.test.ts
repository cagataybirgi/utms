import { buildTestKit, TEST_USERS } from "../test-helpers";

describe("Test Case YDYO-C: UNSUCCESSFUL decision requires notes", () => {
  it("rejects UNSUCCESSFUL without notes for low-score app-ydyo-3", async () => {
    const kit = buildTestKit();
    const officer = kit.asUser(TEST_USERS.ydyo);
    const targetId = "app-ydyo-3";

    const detailRes = await officer.get(`/api/ydyo/${targetId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.evaluation.suggestedDecision).toBe("UNSUCCESSFUL");

    const rejectRes = await officer
      .post(`/api/ydyo/${targetId}/decision`)
      .send({ decision: "UNSUCCESSFUL" });
    expect(rejectRes.status).toBe(400);
    expect(rejectRes.body.message).toMatch(/notes are required/i);

    const okRes = await officer
      .post(`/api/ydyo/${targetId}/decision`)
      .send({ decision: "UNSUCCESSFUL", notes: "YDS score below minimum threshold." });
    expect(okRes.status).toBe(200);
    expect(okRes.body.application.ydyoDecision).toBe("UNSUCCESSFUL");
    expect(okRes.body.application.ydyoReviewNotes).toBe("YDS score below minimum threshold.");
  });
});
