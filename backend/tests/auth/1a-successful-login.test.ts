import request from "supertest";
import { Express } from "express";
import { createApp } from "../../src/app";

// Scenario 1 — Test Case 1A: Main Flow: Successful Login
describe("Auth 1A: Successful Login", () => {
  let app: Express;

  beforeEach(() => {
    app = createApp().app;
  });

  it("logs in with valid credentials and returns the role-specific user", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ tckn: "12345678901", password: "ValidPass1!" })
      .expect(200);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.userId).toBe("student-ahmet-yilmaz");
    expect(res.body.user.tckn).toBe("12345678901");
    expect(res.body.user.roles).toContain("STUDENT");
    // Password material must never be returned to the client.
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("allows non-student roles to log in with their seeded credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ tckn: "11111111111", password: "oidb123" })
      .expect(200);
    expect(res.body.user.roles).toContain("OIDB_OFFICER");
  });

  it("resets the failed-attempt counter on a successful login", async () => {
    const { app: freshApp, container } = createApp();
    const user = container.users.findByTckn("12345678901")!;
    user.failedLoginAttempts = 3;
    container.users.put(user);

    await request(freshApp)
      .post("/api/auth/login")
      .send({ tckn: "12345678901", password: "ValidPass1!" })
      .expect(200);

    expect(container.users.findByTckn("12345678901")!.failedLoginAttempts).toBe(0);
  });
});
