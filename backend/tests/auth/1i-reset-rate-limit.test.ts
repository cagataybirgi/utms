import request from "supertest";
import { createApp } from "../../src/app";
import { AUTH_MESSAGES } from "../../src/modules/auth/auth.service";

// Scenario 1 — Test Case 1I: Rate Limiting on Password Reset Request
describe("Auth 1I: Reset Request Rate Limiting", () => {
  it("blocks repeated reset requests for the same TCKN/e-mail within the window", async () => {
    const { app, container } = createApp();
    const payload = { tckn: "12345678901", email: "ahmet.yilmaz@iyte.edu.tr" };

    // 1st and 2nd requests succeed.
    await request(app).post("/api/auth/forgot-password").send(payload).expect(200);
    await request(app).post("/api/auth/forgot-password").send(payload).expect(200);

    // 3rd request is rate-limited.
    const res = await request(app).post("/api/auth/forgot-password").send(payload).expect(429);
    expect(res.body.message).toBe(AUTH_MESSAGES.rateLimited);

    // No extra reset e-mail beyond the two allowed.
    const sent = container.notifications
      .findAll()
      .filter((n) => n.eventType === "PASSWORD_RESET_REQUESTED");
    expect(sent.length).toBe(2);
  });
});
