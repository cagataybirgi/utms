import request from "supertest";
import { createApp } from "../../src/app";
import { AUTH_MESSAGES } from "../../src/modules/auth/auth.service";

// Scenario 1 — Test Case 1H: E-mail API Failure on Reset
describe("Auth 1H: Reset E-mail Service Failure", () => {
  it("reports an error when the e-mail gateway is down and sends nothing", async () => {
    const { app, container } = createApp();
    container.auth.setEmailServiceAvailable(false);

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ tckn: "12345678901", email: "ahmet.yilmaz@iyte.edu.tr" })
      .expect(503);
    expect(res.body.message).toBe(AUTH_MESSAGES.emailServiceDown);

    const sent = container.notifications
      .findAll()
      .filter((n) => n.eventType === "PASSWORD_RESET_REQUESTED");
    expect(sent.length).toBe(0);
  });

  it("succeeds on retry once the e-mail service is restored", async () => {
    const { app, container } = createApp();
    container.auth.setEmailServiceAvailable(false);
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ tckn: "12345678901", email: "ahmet.yilmaz@iyte.edu.tr" })
      .expect(503);

    container.auth.setEmailServiceAvailable(true);
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ tckn: "12345678901", email: "ahmet.yilmaz@iyte.edu.tr" })
      .expect(200);
    expect(res.body.message).toBe(AUTH_MESSAGES.forgotSuccess);
  });
});
