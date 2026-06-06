import request from "supertest";
import { createApp } from "../../src/app";
import { AUTH_MESSAGES } from "../../src/modules/auth/auth.service";

// Scenario 1 — Test Case 1D: Forgot Password: Successful Reset
describe("Auth 1D: Forgot Password — Successful Reset", () => {
  it("requests a reset, sets a new password, and invalidates the old one", async () => {
    const { app } = createApp();

    // Step 1-4: request reset link.
    const reqRes = await request(app)
      .post("/api/auth/forgot-password")
      .send({ tckn: "12345678901", email: "ahmet.yilmaz@iyte.edu.tr" })
      .expect(200);
    expect(reqRes.body.message).toBe(AUTH_MESSAGES.forgotSuccess);
    const token = reqRes.body.resetToken as string;
    expect(token).toBeTruthy();

    // Step 5-7: set a new password.
    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "NewPass123!", confirmPassword: "NewPass123!" })
      .expect(200);
    expect(resetRes.body.message).toBe(AUTH_MESSAGES.resetSuccess);

    // Step 9: new password works.
    await request(app)
      .post("/api/auth/login")
      .send({ tckn: "12345678901", password: "NewPass123!" })
      .expect(200);

    // Step 10: old password no longer works.
    await request(app)
      .post("/api/auth/login")
      .send({ tckn: "12345678901", password: "ValidPass1!" })
      .expect(401);
  });

  it("records a simulated reset e-mail notification", async () => {
    const { app, container } = createApp();
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ tckn: "12345678901", email: "ahmet.yilmaz@iyte.edu.tr" })
      .expect(200);

    const sent = container.notifications
      .findAll()
      .filter((n) => n.eventType === "PASSWORD_RESET_REQUESTED");
    expect(sent.length).toBe(1);
    expect(sent[0].channel).toBe("EMAIL");
  });
});
