import request from "supertest";
import { createApp } from "../../src/app";
import { AUTH_MESSAGES } from "../../src/modules/auth/auth.service";

// Scenario 1 — Test Case 1F: Token Expired or Already Used
describe("Auth 1F: Reset Token Expired or Already Used", () => {
  async function requestToken(app: ReturnType<typeof createApp>["app"]): Promise<string> {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ tckn: "12345678901", email: "ahmet.yilmaz@iyte.edu.tr" })
      .expect(200);
    return res.body.resetToken;
  }

  it("blocks a token that has already been used once", async () => {
    const { app } = createApp();
    const token = await requestToken(app);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "NewPass123!", confirmPassword: "NewPass123!" })
      .expect(200);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "Another123!", confirmPassword: "Another123!" })
      .expect(400);
    expect(res.body.message).toBe(AUTH_MESSAGES.tokenInvalid);
  });

  it("blocks an expired token and leaves the password unchanged", async () => {
    const { app, container } = createApp();
    const token = await requestToken(app);

    // Force expiry.
    const record = container.auth.findToken(token)!;
    record.expiresAt = Date.now() - 1000;

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "NewPass123!", confirmPassword: "NewPass123!" })
      .expect(400);
    expect(res.body.message).toBe(AUTH_MESSAGES.tokenInvalid);

    // Original password still works.
    await request(app)
      .post("/api/auth/login")
      .send({ tckn: "12345678901", password: "ValidPass1!" })
      .expect(200);
  });

  it("blocks an unknown token", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "does-not-exist", newPassword: "NewPass123!", confirmPassword: "NewPass123!" })
      .expect(400);
    expect(res.body.message).toBe(AUTH_MESSAGES.tokenInvalid);
  });
});
