# UTMS — Seed Account Credentials

Single source of truth: `backend/src/mocks/seed-data.ts` (`buildSeedUsers`). The
deployed system resolves login + RBAC from these rows after they are written to
Neon with `npx ts-node prisma/seed.ts`. **If an account is missing here, nobody
can log in as it** — that is exactly what produced the Fail/Blocked rows in Test
Plan v2.

Login is by **TCKN + password**.

## Staff / role accounts

| Role | userId | TCKN | Password | Use it for |
|------|--------|------|----------|------------|
| ÖİDB Officer | `user-oidb-1` | `11111111111` | `oidb123` | Scenario 4 — intake verification, routing |
| **YDYO Officer** 🔁 restored | `user-ydyo-1` | `55555555555` | `ydyo123` | YDYO language review (`IN_REVIEW_YDYO`) |
| YGK Member | `user-ygk-cmpe-1` | `22222222222` | `ygk123` | Scenario 5/6 — view queue, prepare intibak |
| **YGK Chair** ⚠️ use for decisions | `user-ygk-chair-cmpe` | `33333333333` | `ygkchair123` | Scenario 5 — finalize ranking, quota, tie-break, **send package** |
| Dean's Office | `user-deans-eng` | `44444444444` | `dean123` | Scenario 7 — issue/verify dean signature |
| **Faculty Board** 🔁 restored | `user-board-eng` | `66666666666` | `board123` | Scenario 7 — board decision, confirm-for-publication |
| System Admin | `user-admin` | `99999999999` | `admin123` | Everything (bypasses all role gates) |

## Student accounts

| Student | userId | TCKN | Password | Use it for |
|---------|--------|------|----------|------------|
| Ahmet Yılmaz (eligible, GNO 3.45) | `student-ahmet-yilmaz` | `12345678901` | `ValidPass1!` | Scenario 1–3 happy path |
| **Zeynep Yılmaz (low GNO 2.0)** 🔁 new | `student-zeynep-lowgpa` | `11223344556` | `ValidPass1!` | TC 2A/2C — GPA-below-2.50 block |

The ranking-scenario students (`student-ahmet-kaya`, `student-baris-tan`, …) use
the fallback password `Ogrenci123!` and exist only as ranking/intibak fixtures.

## Why three of these were the headline bug

`YDYO_OFFICER`, `FACULTY_BOARD_MEMBER`, and the low-GPA student were **absent**
from the seed, and the live DB had also lost the YGK chair. Because `mock-auth`
resolves roles from the seeded Neon rows, those roles were un-loginable:

- no **Faculty Board** account → the Scenario 7 review queue was unreachable
  (TC-7A failed → 7B–7G blocked by cascade);
- no **YGK chair** available to testers → TC-5A/5J/5K returned
  `Role(s) required: YGK_CHAIR — got: YGK_MEMBER`;
- no **YDYO officer** → the language-review step could never be cleared;
- no **low-GPA student** → the eligibility-block case (TC-2A/2C) couldn't run.

`tests/seed/seed-integrity.test.ts` now fails CI if any role loses its account
again.
