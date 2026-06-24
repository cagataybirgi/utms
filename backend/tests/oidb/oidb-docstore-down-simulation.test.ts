import { buildTestKit, TEST_USERS } from "../test-helpers";
import { ApplicationStatus } from "../../src/shared/types";

// Test Case 4 — the ÖİDB panel's "Belge Sunucusu: ARIZALI" toggle sends the
// x-simulate-docstore-down header. Detail and every action must return the
// document-store 503 and leave the application untouched, even though the real
// store is reachable.
describe("Test Case 4-DocumentStoreUnreachable (simulation header)", () => {
  it("blocks detail + actions and leaves status unchanged when the header is set", async () => {
    const kit = buildTestKit();
    const officer = kit.asUser(TEST_USERS.oidb);
    const targetId = "app-1002";

    const detailRes = await officer
      .get(`/api/oidb/applications/${targetId}`)
      .set("x-simulate-docstore-down", "1");
    expect(detailRes.status).toBe(503);
    expect(detailRes.body.error).toBe("DOCUMENT_STORE_UNREACHABLE");
    expect(detailRes.body.message).toBe("Belge bulunamadı. İşlem engellendi, inceleme durduruldu.");

    const verifyRes = await officer
      .post(`/api/oidb/applications/${targetId}/verify`)
      .set("x-simulate-docstore-down", "1")
      .send({});
    expect(verifyRes.status).toBe(503);
    expect(verifyRes.body.message).toBe("İşlem engellendi, inceleme durduruldu.");

    // Status is unchanged — the review was halted before any mutation.
    const stored = kit.container.applications.findById(targetId);
    expect(stored?.currentStatus).toBe(ApplicationStatus.PendingOidbVerification);

    // The pool still loads (the queue ignores the simulation header) and the
    // application is still waiting in it.
    const poolRes = await officer.get("/api/oidb/applications");
    expect(poolRes.status).toBe(200);
    expect(
      poolRes.body.items.find((a: { applicationId: string }) => a.applicationId === targetId),
    ).toBeDefined();
  });
});
