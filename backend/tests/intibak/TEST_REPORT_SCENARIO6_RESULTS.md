# Scenario 6 (Intibak) — Test Execution Results

> Fills the test report's **Actual Output / Test Environment / Test Result / Test Comments**
> columns for Test Cases 6A–6L. Execution date: 2026-06-06.

## Test Environment

- **Backend API**: Express 4 on `http://localhost:3001`, `NODE_ENV=development`.
- **Persistence (runtime)**: `applications` read/written in **Neon Postgres** (Prisma);
  documents, curriculum, intibak tables, OCR via the in-memory container seeded from
  `src/mocks/seed-data.ts`. Auth via `x-mock-user` header.
- **Automated regression**: Jest + Supertest integration tests, `NODE_ENV=test`
  (fully in-memory), `tests/intibak/*`. **49 suites / 106 tests pass.**
- Cases marked **(live)** were additionally executed end-to-end against the running
  server backed by Neon; the rest are covered by the integration suite.

## Summary

| Test ID | Title | Test File | Environment | Result |
|---|---|---|---|---|
| 6A | Successful Intibak Preparation & Save | `6a-successful-intibak.test.ts` | Jest + **live** | ✅ Pass |
| 6B | Manual Override of a Smart Suggestion | `6b-manual-override.test.ts` | Jest | ✅ Pass |
| 6C | Many-to-One Mapping | `6c-many-to-one.test.ts` | Jest | ✅ Pass |
| 6D | Course Marked as Not Exempt | `6d-not-exempt.test.ts` | Jest | ✅ Pass |
| 6E | OCR Failure → Manual Entry Fallback | `6e-manual-entry-fallback.test.ts` | Jest | ✅ Pass |
| 6F | Target Curriculum Not Defined — Blocked | `6f-no-curriculum.test.ts` | Jest + **live** | ✅ Pass |
| 6G | No Smart Suggestions → Fully Manual | `6g-no-suggestions.test.ts` | Jest | ✅ Pass |
| 6H | Save Blocked — No Decision for a Target | `6h-incomplete-mapping.test.ts` | Jest | ✅ Pass |
| 6I | Successful Package Export to Dean's Office | `6i-package-export-success.test.ts` | Jest | ✅ Pass |
| 6J | Package Export Blocked — Not Finalised | `6j-package-export-blocked.test.ts` | Jest | ✅ Pass |
| 6K | Successful Transcript OCR/PDF Parsing | `6k-ocr-success.test.ts` | Jest + **live** | ✅ Pass |
| 6L | Smart Suggestion Similarity Threshold | `6l-similarity-threshold.test.ts` | Jest + **live** | ✅ Pass |

---

## Per-Case Actual Output & Comments

### 6A — INT_Successful (Ahmet Kaya, `app-asil-ahmet-kaya`) — ✅ Pass *(live)*
- **Actual Output**: `prepare` → 4 previous courses, 9 target curriculum rows,
  `manualEntryRequired=false`, 4 `SUGGESTED_MATCH` rows (CMPE101→CMPE101,
  Calculus I→MATH101, PHYS101→PHYS101, ENG101→ENG101). After Approve-All +
  deciding remaining targets, `save` → HTTP 200 `"Intibak table saved."`,
  `table.isLocked=true`. Application `currentStatus` in **Neon = INTIBAK_COMPLETED**.
- **Test Comments**: Verifies the Neon-backed application read/write path end-to-end.

### 6B — INT_ManualOverride (Zeynep Demir, `app-asil-zeynep-demir`) — ✅ Pass
- **Actual Output**: Suggested target for the Calculus row is overridden to MATH102;
  the row's status becomes `MANUAL_OVERRIDE`; remaining suggestions approved; `save` succeeds.
- **Test Comments**: Override badge persists across reopen (re-`prepare` returns the saved table).

### 6C — INT_ManyToOne (Berk Yilmaz, `app-asil-berk-yilmaz`) — ✅ Pass
- **Actual Output**: CALC1 + CALC2 mapped to the integrated MATH100 in a single mutation;
  both source codes grouped under one entry; `save` succeeds.
- **Test Comments**: Many-to-one mapping stored as one entry with two `sourceCourseCodes`.

### 6D — INT_NotExempt (Duru Celik, `app-asil-duru-celik`) — ✅ Pass
- **Actual Output**: HIST200 (no equivalent) marked `NOT_EXEMPT`; remaining courses approved;
  `save` → application `currentStatus=INTIBAK_COMPLETED`.
- **Test Comments**: Not-Exempt row carries no target and does not block save.

### 6E — INT_ManualEntryFallback (Elif Yildiz, `app-asil-elif-yildiz`) — ✅ Pass
- **Actual Output**: OCR returns `ok=false` → `prepare` sets `manualEntryRequired=true`,
  empty Column A. Manual `courses` added, `regenerate-suggestions` produces matches,
  `save` succeeds.
- **Test Comments**: Graceful degradation when the transcript cannot be parsed (SDD DC-07).

### 6F — INT_NoCurriculum (Can Aydin, `app-asil-can-aydin`, Electrical Eng.) — ✅ Pass *(live)*
- **Actual Output**: `prepare` → **HTTP 409 `CURRICULUM_NOT_DEFINED`**, message
  "Curriculum for department dept-electrical-engineering is not defined…". No intibak
  table created; application stays `RANKED_ASIL`.
- **Test Comments**: Process blocked before any state change.

### 6G — INT_NoSuggestions (Sude Arslan, `app-asil-sude-arslan`, Fine Arts) — ✅ Pass
- **Actual Output**: No automatic matches (all rows `PENDING_REVIEW`). FA240 manually
  mapped to ENG111 (`MANUAL_OVERRIDE`); FA210/FA230/FA250 marked `NOT_EXEMPT`; `save` succeeds.
- **Test Comments**: Fully manual mapping path; engine correctly returns zero suggestions.

### 6H — INT_IncompleteMapping (Mert Koc, `app-asil-mert-koc`) — ✅ Pass
- **Actual Output**: Leaving CMPE112 undecided → `save` **HTTP 400 `VALIDATION_ERROR`**,
  `details.incompleteTargets` contains `CMPE112`; status unchanged. After deciding CMPE112
  as `NO_PREVIOUS_EQUIVALENT`, `save` → 200 `"Intibak table saved."`.
- **Test Comments**: Save gate requires a decision for every target curriculum course.

### 6I — INT_PackageExportSuccess (CMPE, Spring 2026, Chair) — ✅ Pass
- **Actual Output**: With all Asil applicants at `INTIBAK_COMPLETED`, Chair `package/send`
  with valid signature → `"Package forwarded to Dean's Office."`; applicant statuses →
  `PENDING_DEANS_OFFICE_REVIEW`.
- **Test Comments**: Chair-only (RBAC); package immutable once `SENT` (SDD DC-08).

### 6J — INT_PackageExportBlocked (CMPE, Spring 2026, Chair) — ✅ Pass
- **Actual Output**: With ≥1 Asil applicant not finalised, `package/send` →
  **HTTP 409 `PACKAGE_INCOMPLETE`** listing the pending applicant; no state change.
  Invalid signature password → blocked before any state change.
- **Test Comments**: Two guards verified — completeness gate and signature validation.

### 6K — INT_OCRSuccess (Selin Aksoy, `app-asil-selin-aksoy`) — ✅ Pass *(live)*
- **Actual Output**: `prepare` on a machine-readable transcript → exactly 4 parsed
  courses in Column A (CMPE101/Introduction to Programming/AA/6, MATH151/Calculus I/BA/7,
  PHYS101/Physics I/CB/6, ENG101/English I/AA/3), `manualEntryRequired=false`. No save →
  status stays `RANKED_ASIL`.
- **Test Comments**: Confirms the fully-automated parse path (no manual-entry banner).

### 6L — INT_SimilarityThreshold (Cem Polat, `app-asil-cem-polat`) — ✅ Pass *(live)*
- **Actual Output**: `prepare` suggestions —
  (a) CMP101 → **CMPE101** `SUGGESTED_MATCH`,
  (b) MAT150 → **MATH101** (Calculus I) `SUGGESTED_MATCH`,
  (c) CSE220 → **CMPE213** (Data Structures) `SUGGESTED_MATCH`,
  (d) HIST200 → `PENDING_REVIEW` (no suggestion),
  (e) CMPE999 → `PENDING_REVIEW` (no suggestion). No save → status `RANKED_ASIL`.
- **Test Comments**: Required a `SuggestionEngine` fix — see below. Confirms name-similarity
  + ECTS overlap can cross the threshold, and code-prefix alone (CMPE999) cannot when
  ECTS is far off.

---

## Defect Found & Fixed — SuggestionEngine (surfaced by 6L)

**Symptom**: rows (a) CMP101→CMPE101 and (c) CSE220→CMPE213 received **no suggestion**
(combined score 0.40 < 0.45 threshold), contradicting the test report.

**Root cause** (`src/modules/intibak/suggestion-engine.ts`):
- `codeSimilarity` gave 0 unless the alphabetic prefixes were *identical* — "CMP" vs
  "CMPE" scored 0 despite being the same subject.
- `nameSimilarity` used Jaccard only, so an extended title
  ("Data Structures" ⊆ "Data Structures and Algorithms") scored just 0.5.

**Fix**:
- `codeSimilarity`: partial credit (0.6) when one prefix contains the other.
- `nameSimilarity`: `max(Jaccard, overlap coefficient)` to reward containment.

**Regression check**: all 6A–6J intibak tests and the full suite stay green
(49 suites / 106 tests). (d)/(e) still correctly yield no suggestion.
