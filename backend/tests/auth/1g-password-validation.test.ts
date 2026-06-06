import request from "supertest";
import { createApp } from "../../src/app";
import { AUTH_MESSAGES } from "../../src/modules/auth/auth.service";

// Scenario 1 — Test Case 1G: Password Validation Failure on Reset
describe("Auth 1G: Reset Password Validation", () => {
  async function requestToken(app: ReturnType<typeof createApp>["app"]): Promise<string> {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ tckn: "12345678901", email: "ahmet.yilmaz@iyte.edu.tr" })
      .expect(200);
    return res.body.resetToken;
  }

  const weakCases: Array<[string, string]> = [
    ["too short", "abc"],
    ["no uppercase", "newpass1!"],
    ["no number", "NewPass!!"],
    ["no special char", "NewPass123"],
  ];

  it.each(weakCases)("rejects a weak password (%s) without consuming the token", async (_label, pw) => {
    const { app } = createApp();
    const token = await requestToken(app);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: pw, confirmPassword: pw })
      .expect(400);

    // Token is still valid — a correct password now succeeds.
    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "NewPass123!", confirmPassword: "NewPass123!" })
      .expect(200);
  });

  it("rejects a mismatched confirmation without consuming the token", async () => {
    const { app } = createApp();
    const token = await requestToken(app);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "NewPass123!", confirmPassword: "Different1!" })
      .expect(400);
    expect(res.body.message).toBe(AUTH_MESSAGES.passwordsDoNotMatch);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "NewPass123!", confirmPassword: "NewPass123!" })
      .expect(200);
  });
});
