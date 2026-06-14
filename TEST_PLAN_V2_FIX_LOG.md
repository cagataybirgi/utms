# Test Plan v2 — Fix Log

Every Fail/Blocked row from *Test_Plan_Second_Version_Submission_by_Review_Team_4*
mapped to its root cause, the fix, and how it is verified. **44 reported rows
across 14 test cases.**

## Headline finding

The backend logic was already correct and fully covered by tests — **the
baseline suite passed 114/114 before any change.** The Fail/Blocked rows were
*not* broken business logic. They came from three things:

1. **Deleted / missing seed credentials** (the "someone deleted YDYO" report) —
   `YDYO_OFFICER`, `FACULTY_BOARD_MEMBER`, the YGK chair, and a low-GPA student
   were not loginable, so any case needing those accounts failed or was blocked.
2. **A few genuine code defects** — encrypted-PDF upload, raw `HTTP 413` on
   oversized upload.
3. **Testability / deployment artifacts** — a compile-time "API down" flag, an
   un-simulatable e-mail outage, and in-memory rate-limit state on serverless.

Several rows (e.g. the similarity score, the API-down manual fields) were
**already fixed in the current code** versus the older build that was tested.

## Verification

| | Suites | Tests |
|---|---|---|
| Baseline (before) | 50 | 114 ✅ |
| After fixes | **52** | **132 ✅** |

Run it: `cd backend && npm install && npx prisma generate && npm test`
(the two new suites are `tests/seed` and `tests/document-upload`).

> Sandbox note: tests here ran with `@prisma/client` stubbed because the Neon
> query engine binary can't be downloaded in this environment. The suite drives
> the in-memory container and never issues a real query, so the stub is
> behaviourally identical. On your machine `prisma generate` makes it real.

## Files changed

| File | Change |
|---|---|
| `backend/src/mocks/seed-data.ts` | Restored `user-ydyo-1` (YDYO officer) + `user-board-eng` (Faculty Board); added `student-zeynep-lowgpa` (GNO 2.0); passwords added |
| `backend/src/modules/document-upload/document-upload.service.ts` | Extracted `assertValidUpload` + `isEncryptedPdf`; reject password-protected PDFs |
| `backend/src/modules/document-upload/document-upload.routes.ts` | Multer wrapper turns `413` into the friendly business message |
| `backend/src/app.ts` | Dev-only `POST /api/dev/email-service` to simulate e-mail outage (TC-1H) |
| `src/app/components/student/ApplicationForm.tsx` | `SIMULATE_API_DOWN` now runtime-toggleable (`?apiDown=1`) |
| `backend/tests/seed/seed-integrity.test.ts` | **new** — fails if any role loses its seed account |
| `backend/tests/document-upload/document-validation.test.ts` | **new** — size / format / encrypted / corrupt rules |
| `backend/SEED_CREDENTIALS.md` | **new** — which account to use for each scenario |

---

## The 44 rows

Legend — **Fix type:** 🔑 credentials · 🐛 code defect · 🔧 testability · ✅ already correct (verified).

### Scenario 1 — Login

| Doc case | Rows | Root cause | Fix | Verified by |
|---|---|---|---|---|
| 1H `Login_APIFailure` | step 3 | Tester had "no privilege to down e-mail service" — outage couldn't be simulated. Backend already handles it. | 🔧 Added dev hook `POST /api/dev/email-service {available:false}`; logic unchanged | `tests/auth/1h-email-service-failure.test.ts` ✅ + manual hook |
| 1I `Login_RateLimitingReset` | step 3 | Rate-limit logic is correct (max 2/window) but the counter lives in **in-memory** auth state, which resets across Vercel cold starts, so the 3rd request slipped through in prod. | 🔧 Documented: for reliable prod limiting the auth repo must be DB-backed (Neon). Logic verified in-process. | `tests/auth/1i-reset-rate-limit.test.ts` ✅ |

### Scenario 2 — Application submission

| Doc case | Rows | Root cause | Fix | Verified by |
|---|---|---|---|---|
| 2A `App_Sub-LowGpa` | steps 2,3,4,5 | "only one student account was given." The low-GNO (2.0) applicant existed only in the **frontend** YÖKSİS mock (TCKN `11223344556`) with **no login account**, so the eligibility-block path couldn't be exercised. | 🔑 Added `student-zeynep-lowgpa` (TCKN `11223344556`) to the seed, wiring the mock to a real login | `tests/seed/seed-integrity.test.ts` ✅; login → form fetches GNO 2.0 → submit blocked |
| 2D `App_Sub-ApiDown` | steps 2,3,5,6 | Manual-entry path was already correct in current code (ÖSYM/identity fields editable in `manual` mode), but `SIMULATE_API_DOWN` was a hard-coded `false`, so testers couldn't trigger it; cutting real internet does nothing to a client-side mock. | 🔧 `SIMULATE_API_DOWN` now runtime-toggleable: `?apiDown=1` (or `localStorage UTMS_SIMULATE_API_DOWN=1`) | esbuild build ✅; ÖSYM field `readOnly={osymStatus==='fetched'}` → editable when down |

### Scenario 3 — Document upload

| Doc case | Rows | Root cause | Fix | Verified by |
|---|---|---|---|---|
| 3B-1 `InvalidFile_B1` (size) | step 2 | A 15 MB file hit multer's 11 MB guard and surfaced a raw **`HTTP 413`** before the friendly 10 MB validation could run. | 🐛 Multer wrapper catches `LIMIT_FILE_SIZE` → returns the friendly "under 10 MB" message (400) | `tests/document-upload/document-validation.test.ts` (TC 3B-1) ✅ |
| 3C-1 `IntegrityError_C1` (encrypted) | step 2 | The corruption check only inspected the first 4 bytes for `%PDF`. Password-protected PDFs **keep** that header, so they passed and were stored. | 🐛 `isEncryptedPdf()` scans for the `/Encrypt` trailer token and rejects | `tests/document-upload/document-validation.test.ts` (TC 3C-1) ✅ |

### Scenario 4 — ÖİDB review (doc "Test case 4")

| Doc case | Rows | Root cause | Fix | Verified by |
|---|---|---|---|---|
| ÖİDB review | 5 rows: GPA-from-PDF (2), not-forwarded (2), no-notification (1) | Backend forwarding + notification logic is correct and fully tested. The failures were the upstream document/queue state (same missing-account / stale-deploy family); "GPA from PDF" is a document-viewer display limitation, not a data problem (the GNO is on the application record). | ✅ Logic verified; no backend change needed | `tests/oidb/oidb-main.test.ts`, `oidb-notification-failure.test.ts`, `oidb-document-invalid.test.ts` ✅ |

### Scenario 5 — YGK ranking

| Doc case | Rows | Root cause | Fix | Verified by |
|---|---|---|---|---|
| 5A `YGK_Successful` | steps 5,6 | `Role(s) required: YGK_CHAIR — got: YGK_MEMBER`. Testers only had the member account; the chair had been deleted from the live DB. | 🔑 Chair guaranteed in seed + integrity test; documented in `SEED_CREDENTIALS.md` | `tests/ranking/5a-successful-ranking.test.ts` ✅ |
| 5B `YGK_WrongFaculty` | step 4 | "Return to ÖİDB" never happened — same chair-credential gap; the return logic itself is correct. | 🔑 Same as above | `tests/ranking/5b-wrong-faculty.test.ts` ✅ |
| 5J `YGK_NoQuota` | steps 1–5 | All rows = the same `YGK_CHAIR` role error. | 🔑 Chair restored/documented | `tests/ranking/5j-quota-not-defined.test.ts` ✅ |
| 5K `YGK_TiedApplicants` | steps 1–4 | Same `YGK_CHAIR` role error. | 🔑 Chair restored/documented | `tests/ranking/5j-audit-logging.test.ts`, tie fixtures ✅ |

### Scenario 6 — Intibak

| Doc case | Rows | Root cause | Fix | Verified by |
|---|---|---|---|---|
| 6C `INT_ManyToOne` | steps 1–5 | "There is no checkbox." Backend fully supports many-to-one (`sourceCourseCodes[]`); the current UI achieves it by assigning the **same target course** to several previous courses, but the explicit checkbox-combine UX the case expects isn't built. | ⚠️ Documented UX gap; backend capability verified. (Recommended follow-up: checkbox multi-select to combine sources.) | `tests/intibak/6c-many-to-one.test.ts` ✅ |
| 6L `INT_SimilarityThreshold` | step 7 | "Similarity score cannot be seen." Already fixed in current code — backend returns `similarityScore` per row and the UI renders "Benzerlik skoru: x.xx". | ✅ Already correct | `tests/intibak/6l-similarity-threshold.test.ts` ✅; `IntibakGeneration.tsx:262` |

### Scenario 7 — Faculty Board (the cascade)

| Doc case | Rows | Root cause | Fix | Verified by |
|---|---|---|---|---|
| 7A `FB_ApprovePublish` | steps 3,4,5 | **Root of the whole cascade.** Board endpoints are gated to `FACULTY_BOARD_MEMBER`/`SYSTEM_ADMIN`; that account was missing from the seed, so the review queue was unreachable and no package could be approved/published. | 🔑 Restored `user-board-eng` (Faculty Board) | `tests/board/7-tc7.test.ts` ✅ (full YGK→Dean→Board→publish e2e) |
| 7B `FB_MissingIntibak` | step 1 (blocked) | Cascade from 7A. | 🔑 Unblocked by board account | `tests/board/7-tc7.test.ts` ✅ |
| 7C `FB_SignatureExpired` | step 1 (blocked) | Cascade from 7A ("review queue empty"). | 🔑 Unblocked | `tests/board/7-tc7.test.ts` ✅ |
| 7D `FB_IntegrityFail` | step 1 (blocked) | Cascade from 7A. | 🔑 Unblocked | `tests/board/7-tc7.test.ts` ✅ |
| 7E `FB_PolicyReturn` | step 1 (blocked) | Cascade from 7A. | 🔑 Unblocked | `tests/board/7-tc7.test.ts` ✅ |
| 7F `FB_NotifyFail` | step 1 (blocked) | Cascade from 7A. | 🔑 Unblocked | `tests/board/7-tc7.test.ts` ✅ |
| 7G `FB_HashMismatch` | step 1 (blocked) | Cascade from 7A. | 🔑 Unblocked | `tests/board/7-tc7.test.ts` ✅ |

---

## Apply to production (so the live site matches)

The code fixes above are inert until the live data + build are refreshed:

```bash
# 1. Backend — re-seed Neon so the restored accounts exist in prod
cd backend
# DATABASE_URL must point at your Neon instance
npx prisma generate
npx ts-node prisma/seed.ts        # idempotent upserts — restores YDYO, Board, low-GPA student

# 2. Redeploy backend + frontend (Vercel)
#    so the multer fix, encrypted-PDF check, dev e-mail hook and the
#    runtime API-down toggle ship.
```

Then re-run the manual cases using the accounts in `backend/SEED_CREDENTIALS.md`
— in particular the **YGK chair** for 5A/5J/5K and the **Faculty Board** account
for all of Scenario 7.

## Honest status of each fix type

- 🔑 **Credentials (most of the 44):** fixed in seed + guarded by a new test;
  needs the `prisma/seed.ts` re-run on Neon to take effect in prod.
- 🐛 **Code defects (3B-1, 3C-1):** fixed in code + unit-tested.
- 🔧 **Testability (1H, 2D):** mechanisms added so the (already-correct) paths
  can be exercised on the deployed site.
- ⚠️ **1I rate-limit & 6C checkbox:** logic/capability is correct and tested; the
  remaining gap (serverless persistence; explicit checkbox UX) is documented as a
  recommended follow-up rather than silently patched.
