import request from "supertest";
import { createApp } from "../../src/app";
import { AUTH_MESSAGES } from "../../src/modules/auth/auth.service";

// Scenario 1 — Test Case 1E: TCKN / E-mail Mismatch on Reset
describe("Auth 1E: Reset TCKN/E-mail Mismatch", () => {
  it("rejects a TCKN with a non-matching e-mail using a generic message", async () => {
    const { app, container } = createApp();

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ tckn: "12345678901", email: "wrong@iyte.edu.tr" })
      .expect(400);
    expect(res.body.message).toBe(AUTH_MESSAGES.forgotMismatch);
    // Generic — must not reveal which field is wrong.
    expect(res.body.message).not.toMatch(/TCKN|e-?mail|e-?posta/i);

    // No reset e-mail is sent.
    const sent = container.notifications
      .findAll()
      .filter((n) => n.eventType === "PASSWORD_RESET_REQUESTED");
    expect(sent.length).toBe(0);
  });

  it("rejects an unknown TCKN with the same generic message", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ tckn: "00000000000", email: "ahmet.yilmaz@iyte.edu.tr" })
      .expect(400);
    expect(res.body.message).toBe(AUTH_MESSAGES.forgotMismatch);
  });
});
