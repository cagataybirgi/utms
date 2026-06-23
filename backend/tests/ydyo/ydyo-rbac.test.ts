import request from "supertest";
import { buildTestKit, TEST_USERS } from "../test-helpers";

describe("Test Case YDYO-E: RBAC and auth", () => {
  it("student role cannot access YDYO endpoints", async () => {
    const kit = buildTestKit();
    const student = kit.asUser(TEST_USERS.student);
    const res = await student.get("/api/ydyo/queue");
    expect(res.status).toBe(403);
  });

  it("missing auth header returns 401", async () => {
    const kit = buildTestKit();
    const res = await request(kit.app).get("/api/ydyo/queue");
    expect(res.status).toBe(401);
  });

  it("non-routed application returns 409 on decision", async () => {
    const kit = buildTestKit();
    const officer = kit.asUser(TEST_USERS.ydyo);
    const res = await officer
      .post("/api/ydyo/app-1001/decision")
      .send({ decision: "SUCCESSFUL" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("NOT_ROUTED_TO_YDYO");
  });
});
