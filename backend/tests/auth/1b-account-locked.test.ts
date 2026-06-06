import request from "supertest";
import { createApp } from "../../src/app";
import { AUTH_MESSAGES } from "../../src/modules/auth/auth.service";

// Scenario 1 — Test Case 1B: Account Locked (>= 5 failed attempts)
describe("Auth 1B: Account Locked", () => {
  it("locks the account on the 5th consecutive failed attempt", async () => {
    const { app, container } = createApp();
    // Pre-requisite: failed attempt counter is exactly 4.
    const user = container.users.findByTckn("12345678901")!;
    user.failedLoginAttempts = 4;
    container.users.put(user);

    // 5th attempt → lockout.
    const res = await request(app)
      .post("/api/auth/login")
      .send({ tckn: "12345678901", password: "WrongPass!" })
      .expect(423);
    expect(res.body.message).toBe(AUTH_MESSAGES.accountLocked);

    expect(container.users.findByTckn("12345678901")!.lockedUntil).toBeTruthy();
  });

  it("blocks even the correct password while locked", async () => {
    const { app, container } = createApp();
    const user = container.users.findByTckn("12345678901")!;
    user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    container.users.put(user);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ tckn: "12345678901", password: "ValidPass1!" })
      .expect(423);
    expect(res.body.message).toBe(AUTH_MESSAGES.accountLocked);
  });

  it("allows login again once the lock window has expired", async () => {
    const { app, container } = createApp();
    const user = container.users.findByTckn("12345678901")!;
    user.lockedUntil = new Date(Date.now() - 1000).toISOString(); // already expired
    user.failedLoginAttempts = 5;
    container.users.put(user);

    await request(app)
      .post("/api/auth/login")
      .send({ tckn: "12345678901", password: "ValidPass1!" })
      .expect(200);
  });
});
