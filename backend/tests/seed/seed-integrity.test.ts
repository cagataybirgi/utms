/**
 * Seed integrity — guards against the "someone deleted the YDYO credentials"
 * class of regression. The deployed system resolves RBAC from the seeded Neon
 * rows (see mock-auth.ts), so a role that is missing from buildSeedUsers() is a
 * role nobody can log in as. Several Test Plan v2 cases were reported as
 * Fail/Blocked purely because the matching account did not exist:
 *   - YDYO_OFFICER        → IN_REVIEW_YDYO language step could not be cleared
 *   - FACULTY_BOARD_MEMBER→ Scenario 7 board queue unreachable (7A → 7B–7G cascade)
 *   - YGK_CHAIR           → ranking finalize / quota / tie-break decisions blocked
 */
import { buildSeedUsers } from "../../src/mocks/seed-data";
import { UserRole } from "../../src/shared/types";

describe("Seed integrity — every role has a usable account", () => {
  const users = buildSeedUsers();
  const rolesPresent = new Set(users.flatMap((u) => u.roles));

  it.each(Object.values(UserRole))("has at least one %s account", (role) => {
    expect(rolesPresent.has(role)).toBe(true);
  });

  it("restores the deleted YDYO officer credentials", () => {
    const ydyo = users.find((u) => u.roles.includes(UserRole.YdyoOfficer));
    expect(ydyo).toBeDefined();
    expect(ydyo?.passwordHash).toBeTruthy();
  });

  it("restores a Faculty Board member (unblocks Scenario 7 cascade)", () => {
    const board = users.find((u) => u.roles.includes(UserRole.FacultyBoardMember));
    expect(board).toBeDefined();
    expect(board?.passwordHash).toBeTruthy();
  });

  it("keeps a YGK chair distinct from the YGK member (TC-5A/5J/5K)", () => {
    const chair = users.find((u) => u.roles.includes(UserRole.YgkChair));
    const member = users.find(
      (u) => u.roles.includes(UserRole.YgkMember) && !u.roles.includes(UserRole.YgkChair),
    );
    expect(chair).toBeDefined();
    expect(member).toBeDefined();
  });

  it("gives every seed user a unique TCKN and a password hash", () => {
    const tckns = users.map((u) => u.tckn);
    expect(new Set(tckns).size).toBe(tckns.length);
    for (const u of users) expect(u.passwordHash).toBeTruthy();
  });
});
