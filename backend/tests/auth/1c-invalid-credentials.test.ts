import request from "supertest";
import { createApp } from "../../src/app";
import { AUTH_MESSAGES } from "../../src/modules/auth/auth.service";

// Scenario 1 — Test Case 1C: Invalid Credentials
describe("Auth 1C: Invalid Credentials", () => {
  it("returns a generic error for a wrong password and increments the counter", async () => {
    const { app, container } = createApp();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ tckn: "12345678901", password: "WrongPass!" })
      .expect(401);
    expect(res.body.message).toBe(AUTH_MESSAGES.invalidCredentials);

    expect(container.users.findByTckn("12345678901")!.failedLoginAttempts).toBe(1);
  });

  it("returns the same generic error for an unknown TCKN (no enumeration)", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ tckn: "00000000000", password: "whatever1!" })
      .expect(401);
    expect(res.body.message).toBe(AUTH_MESSAGES.invalidCredentials);
  });

  it("permits retry: the user can log in after a failed attempt", async () => {
    const { app } = createApp();
    await request(app)
      .post("/api/auth/login")
      .send({ tckn: "12345678901", password: "WrongPass!" })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ tckn: "12345678901", password: "ValidPass1!" })
      .expect(200);
  });
});
