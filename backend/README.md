# UTMS Backend — Senaryo 4, 5 & 6

> Owner: **Melih Macit (300201088)** · Branch: `melih`
>
> Bu klasör, Undergraduate Transfer Management System (UTMS) projesinin **Senaryo 4 (ÖİDB Review)**, **Senaryo 5 (YGK Ranking)** ve **Senaryo 6 (Intibak Preparation)** kullanım senaryolarına ait backend implementasyonudur. Diğer senaryoların backend'i ekibin diğer üyeleri tarafından eklenecektir.
>
> **Repo durumu**: Frontend (Vite + React + shadcn/ui) repo kökünde (`src/app/`); backend bu klasörde (`backend/`). pnpm workspace olarak iki paket bir arada yönetilir (root `pnpm-workspace.yaml`).

---

## 1. Mimari ve Teknolojiler

| Katman | Seçim | Gerekçe |
|---|---|---|
| Runtime | **Node.js 20 LTS** | SDD §1.3.1.1 ile uyumlu. |
| Web framework | **Express.js 4** | Sade, ekipte yaygın bilinen, hızlı kurulum. |
| Dil | **TypeScript 5** | Status state machine, RBAC, scoring formülü için tip güvenliği kritik. |
| Validation | **Zod** | Request body için type-safe schema validation. |
| Test | **Jest + Supertest** | Her test case için integration test (HTTP üzerinden). |
| Auth | **Mock JWT middleware** (`x-mock-user` header) | Emre'nin Senaryo 1 auth backend'i hazır olunca aynı interface ile değiştirilecek. |
| Persistence | **In-memory repository** (interface-based) | Veritabanı sorumlusu Prisma/Postgres schema kararını verince aynı `IApplicationRepository`, `IDocumentRepository`, ... interface'lerini implemente eden adapter yazılır; servis ve controller layer'ına dokunulmaz. |
| External APIs | **Mock client'lar** (`EDevletMockClient`, `OcrParserMockClient`) | e-Devlet doğrulama ve OCR/PDF Parser, gerçek API'ler bağlanana kadar test fixture'ı olarak çalışır. |

### Klasör Yapısı

```
backend/
├── src/
│   ├── app.ts                    # Express app factory (DI container'ı alır)
│   ├── server.ts                 # Production entry point
│   ├── modules/
│   │   ├── oidb/                 # Senaryo 4
│   │   │   ├── oidb.service.ts   # Domain mantığı (verify, return, reject, forward)
│   │   │   ├── oidb.controller.ts
│   │   │   └── oidb.routes.ts
│   │   ├── ranking/              # Senaryo 5
│   │   │   ├── ranking.service.ts        # eligibility, score calculation, ranking
│   │   │   └── ranking.routes.ts
│   │   └── intibak/              # Senaryo 6
│   │       ├── intibak.service.ts        # prepare, mappings, save, package send
│   │       ├── intibak.controller.ts
│   │       ├── intibak.routes.ts
│   │       └── suggestion-engine.ts      # Code+name+ECTS similarity matcher
│   ├── shared/
│   │   ├── audit/                        # AuditLogger, NotificationService
│   │   ├── container.ts                  # DI container
│   │   ├── errors.ts                     # AppError sınıfları
│   │   ├── external/                     # E-Devlet & OCR mock client
│   │   ├── middleware/                   # mockAuth, RBAC guard, errorHandler
│   │   ├── repositories/
│   │   │   ├── interfaces.ts             # IApplicationRepo, IDocumentRepo, ...
│   │   │   └── in-memory.ts              # InMemory* implementations
│   │   └── types/                        # Domain entity tipleri ve enum'lar
│   └── mocks/
│       └── seed-data.ts                  # Test fixture'ları
├── tests/
│   ├── oidb/                             # Senaryo 4 test case'leri
│   ├── ranking/                          # Senaryo 5 test case'leri (5A → 5J)
│   └── intibak/                          # Senaryo 6 test case'leri (6A → 6J)
├── package.json
├── tsconfig.json
├── jest.config.ts
└── README.md
```

### Mimari Diyagram

```
                         ┌──────────────────────────────┐
                         │        HTTP / Express        │
                         └──────────────┬───────────────┘
                                        │
      ┌─────────────────────────────────┼───────────────────────────────┐
      │                                 │                               │
┌─────▼──────┐                  ┌───────▼───────┐                ┌──────▼──────┐
│ mockAuth   │  ─── x-mock-user │  RBAC guard   │ ── role check  │ errorHandler│
└─────┬──────┘                  └───────┬───────┘                └─────────────┘
      │                                 │
      │                ┌────────────────┴────────────────┐
      │                │                                 │
      │       ┌────────▼─────────┐               ┌───────▼─────────┐
      │       │  /api/oidb/*     │               │  /api/ygk/*     │
      │       │  Senaryo 4       │               │  Senaryo 6      │
      │       └────────┬─────────┘               └───────┬─────────┘
      │                │                                 │
      │       ┌────────▼─────────┐               ┌───────▼──────────┐
      │       │ OidbController   │               │ IntibakController│
      │       └────────┬─────────┘               └───────┬──────────┘
      │                │                                 │
      │       ┌────────▼─────────┐               ┌───────▼──────────┐
      │       │ OidbService      │               │ IntibakService   │
      │       └────────┬─────────┘               └───────┬──────────┘
      │                │                                 │
      │   ┌────────────┴──────────────────────┬──────────┴───────────────┐
      │   │                                   │                          │
┌─────▼───▼──────────┐   ┌────────────────────▼──────┐    ┌──────────────▼──────┐
│ Repositories        │   │ External Mocks            │    │ Audit / Notification │
│ (in-memory adapters │   │ - EDevletMockClient       │    │ AuditLogger,         │
│  behind interfaces) │   │ - OcrParserMockClient     │    │ NotificationService  │
└─────────────────────┘   └───────────────────────────┘    └──────────────────────┘
```

DB sorumlusu hazır olduğunda yalnızca **Repositories** kutusu PostgreSQL adapter ile değiştirilir; üst katmanlara dokunulmaz.

---

## 2. Implemented Use Cases

### Senaryo 4 — ÖİDB Review (SRS UC-2.1)
ÖİDB officer'ın "Pending Verification (OIDB)" durumundaki başvuruları inceleyip, doğruladığı / düzeltme için geri gönderdiği / reddettiği akış.

**Endpoint'ler** (tümü `requireRoles(OidbOfficer, SystemAdmin)`):

| Method | Path | Test Case |
|---|---|---|
| `GET`  | `/api/oidb/applications` | OIDB-Main |
| `GET`  | `/api/oidb/applications/:id` | OIDB-Main, OIDB-Barcode, OIDB-Invalid, OIDB-DocStore |
| `POST` | `/api/oidb/applications/:id/verify` | OIDB-Main, OIDB-Barcode, OIDB-DocStore, OIDB-Notify |
| `POST` | `/api/oidb/applications/:id/return` | OIDB-Return |
| `POST` | `/api/oidb/applications/:id/reject` | OIDB-Invalid |
| `POST` | `/api/oidb/applications/:id/forward` | OIDB-Main |

**SDD Eşlemesi**: DC-03 (status state machine), DC-07 (e-Devlet adapter), DC-10 (audit + notification decoupling), DC-13 (security).

### Senaryo 5 — YGK Ranking (SRS UC-3.1)
YGK Chair'in INTAKE_VERIFIED durumundaki başvuruları akademik uygunluk kriterlerine göre değerlendirip, transfer puanı hesaplayarak sıraladığı ve ASIL/YEDEK/RED kategorilerine ayırdığı akış.

**Endpoint'ler** (`requireRoles(YgkChair, SystemAdmin)` for execute; `YgkMember+` for read):

| Method | Path | Test Case |
|---|---|---|
| `POST` | `/api/ranking/execute` | 5A, 5B, 5C, 5D, 5E, 5F, 5G, 5H, 5I, 5J |
| `GET`  | `/api/ranking/:departmentId/:periodId/results` | 5A |
| `GET`  | `/api/ranking/:departmentId/:periodId/overview` | 5A |

**Transfer Score Formula** (SRS): `Score = (YKS / 500 * 0.90) + (GPA * 0.10)`

**Eligibility Criteria**:
- Minimum GPA ≥ 2.5 / 4.0
- Valid semester: 3rd or 5th only
- YKS exam year ≥ 2022

**Ranking Categories**:
- **ASIL**: Top N (N = quota)
- **YEDEK**: Next 20% of quota
- **RED**: Below cutoff or ineligible

**Tie-breaking**: Earlier submission time wins for identical scores.

**SDD Eşlemesi**: DC-03 (status transitions), DC-10 (audit logging), DC-13 (role-based access).

### Senaryo 6 — Intibak Preparation (SRS UC-4.5, UC-4.8)
YGK Member'ın Asil-ranked öğrenciler için ders denkleştirme tablosu hazırladığı, YGK Chair'in paketi imzalayıp Dean's Office'e ilettiği akış.

**Endpoint'ler** (tümü `requireRoles(YgkMember, YgkChair, SystemAdmin)`):

| Method | Path | Test Case |
|---|---|---|
| `POST` | `/api/ygk/intibak/:id/prepare` | 6A, 6B, 6C, 6D, 6E, 6F, 6G, 6H |
| `POST` | `/api/ygk/intibak/:id/courses` | 6E (manual entry) |
| `POST` | `/api/ygk/intibak/:id/regenerate-suggestions` | 6E |
| `PATCH`| `/api/ygk/intibak/:id/mappings` | 6A, 6B, 6C, 6G, 6H |
| `POST` | `/api/ygk/intibak/:id/not-exempt` | 6D, 6G |
| `POST` | `/api/ygk/intibak/:id/save` | 6A, 6D, 6H |
| `GET`  | `/api/ygk/department-overview` | 6I, 6J |
| `POST` | `/api/ygk/package/send` | 6I, 6J (chair only) |

**SDD Eşlemesi**: DC-09 (course equivalence mapping & SuggestionEngine), DC-08 (immutable EvaluationPackage), DC-07 (OCR adapter graceful degradation).

---

## 3. Çalıştırma

```bash
cd backend
npm install
npm test            # 23/23 geçer
npm run dev         # ts-node-dev: http://localhost:3001
npm run build       # tsc → dist/
npm start           # node dist/server.js
```

### Manuel Test
Her isteğe `x-mock-user` header'ı ekleyin (Emre'nin auth backend'i bağlanınca JWT'ye geçilecek):

```bash
# OIDB pool listele
curl -H "x-mock-user: user-oidb-1" http://localhost:3001/api/oidb/applications

# Başvuruyu onayla
curl -X POST -H "x-mock-user: user-oidb-1" \
     http://localhost:3001/api/oidb/applications/app-1001/verify

# Intibak hazırla
curl -X POST -H "x-mock-user: user-ygk-cmpe-1" \
     http://localhost:3001/api/ygk/intibak/app-asil-ahmet-kaya/prepare

# Paketi imzalayıp gönder (chair only)
curl -X POST -H "x-mock-user: user-ygk-chair-cmpe" \
     -H "Content-Type: application/json" \
     -d '{"signaturePassword":"ygk-chair-signature","departmentId":"dept-computer-engineering","periodId":"period-spring-2026"}' \
     http://localhost:3001/api/ygk/package/send
```

### Seed Edilmiş Test Kullanıcıları

| Rol | userId | Açıklama |
|---|---|---|
| OIDB Officer | `user-oidb-1` | Senaryo 4 endpoint'leri |
| YGK Member (CMPE) | `user-ygk-cmpe-1` | Senaryo 6 hazırlık adımları |
| YGK Chair (CMPE) | `user-ygk-chair-cmpe` | Paket imzalama yetkisi |
| Dean's Office (Eng) | `user-deans-eng` | (Senaryo 7'de kullanılacak) |
| Student | `student-ahmet-yilmaz` | RBAC negatif testleri |

Test senaryolarındaki tüm öğrenciler (Ahmet Kaya, Zeynep Demir, Berk Yılmaz, Duru Çelik, Sude Arslan, Mert Koç, Elif Yıldız, Can Aydın) ve başvuruları seed edilmiştir.

---

## 4. Test Plan & Sonuçlar

Testler `npm test` ile çalıştırılır; her test SRS / Test Report'taki bir test case'ine bire bir karşılık gelir.

### Senaryo 4 — ÖİDB Review
| Test Case | Test Dosyası | Test Sonucu |
|---|---|---|
| OIDB-Main (Happy Path) | `tests/oidb/oidb-main.test.ts` | ✅ Pass |
| OIDB-Document Store Unreachable | `tests/oidb/oidb-document-store-down.test.ts` | ✅ Pass |
| OIDB-Barcode Not Readable | `tests/oidb/oidb-barcode-not-readable.test.ts` | ✅ Pass |
| OIDB-Document Invalid | `tests/oidb/oidb-document-invalid.test.ts` | ✅ Pass |
| OIDB-Return Without Reason | `tests/oidb/oidb-return-without-reason.test.ts` | ✅ Pass |
| OIDB-Notification Service Failure | `tests/oidb/oidb-notification-failure.test.ts` | ✅ Pass |

### Senaryo 5 — YGK Ranking
| Test Case | Test Dosyası | Test Sonucu |
|---|---|---|
| 5A — Happy Path (Full Ranking) | `tests/ranking/5a-happy-path.test.ts` | ✅ Pass |
| 5B — Ineligible: Low GPA | `tests/ranking/5b-ineligible-low-gpa.test.ts` | ✅ Pass |
| 5C — Ineligible: Invalid Semester | `tests/ranking/5c-ineligible-invalid-semester.test.ts` | ✅ Pass |
| 5D — Ineligible: Expired YKS | `tests/ranking/5d-ineligible-expired-yks.test.ts` | ✅ Pass |
| 5E — Tie-Breaking Logic | `tests/ranking/5e-tie-breaking.test.ts` | ✅ Pass |
| 5F — Zero Eligible Applicants | `tests/ranking/5f-zero-eligible.test.ts` | ✅ Pass |
| 5G — Applicants Less Than Quota | `tests/ranking/5g-less-than-quota.test.ts` | ✅ Pass |
| 5H — Unauthorized Access | `tests/ranking/5h-unauthorized-access.test.ts` | ✅ Pass |
| 5I — Validation Errors | `tests/ranking/5i-validation-errors.test.ts` | ✅ Pass |
| 5J — Audit Logging | `tests/ranking/5j-audit-logging.test.ts` | ✅ Pass |

### Senaryo 6 — Intibak Preparation
| Test Case | Test Dosyası | Test Sonucu |
|---|---|---|
| 6A — Successful Intibak | `tests/intibak/6a-successful-intibak.test.ts` | ✅ Pass |
| 6B — Manual Override | `tests/intibak/6b-manual-override.test.ts` | ✅ Pass |
| 6C — Many-to-One Mapping | `tests/intibak/6c-many-to-one.test.ts` | ✅ Pass |
| 6D — Course Marked Not Exempt | `tests/intibak/6d-not-exempt.test.ts` | ✅ Pass |
| 6E — OCR Failure → Manual Entry | `tests/intibak/6e-manual-entry-fallback.test.ts` | ✅ Pass |
| 6F — Curriculum Not Defined | `tests/intibak/6f-no-curriculum.test.ts` | ✅ Pass |
| 6G — No Smart Suggestions | `tests/intibak/6g-no-suggestions.test.ts` | ✅ Pass |
| 6H — Incomplete Mapping (Save Blocked) | `tests/intibak/6h-incomplete-mapping.test.ts` | ✅ Pass |
| 6I — Successful Package Export | `tests/intibak/6i-package-export-success.test.ts` | ✅ Pass |
| 6J — Package Export Blocked | `tests/intibak/6j-package-export-blocked.test.ts` | ✅ Pass |

**Toplam**: 33 test (6 OIDB + 10 Ranking + 17 Intibak), 33 pass.

---

## 5. Work Breakdown — Bu Klasördeki Tüm Çalışma

> Bu backend modülünün tamamı **Melih Macit (300201088)** tarafından implemente edildi. Diğer senaryolar (1, 2, 3, 5, 7) ekibin diğer üyeleri tarafından ayrı modüllerde geliştirilecektir.

| Bileşen | Açıklama |
|---|---|
| Foundation | TypeScript + Express + Jest setup, klasör yapısı |
| Domain types | Application, Document, IntibakTable, EvaluationPackage, AuditLog enum & interface'leri |
| Repository pattern | DB sorumlusunun ileride Prisma/SQL adapter ile değiştireceği interface katmanı |
| Mock external clients | e-Devlet (3 outcome), OCR Parser (3 outcome) |
| Senaryo 4 endpoints | 6 endpoint + 6 test case |
| Senaryo 6 endpoints | 8 endpoint + 10 test case |
| SuggestionEngine | Code/name/ECTS-based similarity matcher |
| RBAC + audit + notification | Tüm kritik aksiyonlar audit log'a yazılıyor; notification service offline iken status update bloklanmıyor |

---

## 6. Frontend Entegrasyon Notları

Frontend (`src/app/`) şu an `localStorage` ve `lib/mock-data.ts` ile çalışıyor; gerçek backend bağlantısı henüz yapılmamış. Backend response shape'leri SDD'ye sadık UPPER_SNAKE enum'lar kullanırken frontend `src/app/types/index.ts` lowercase basit enum'lar kullanıyor. Bu kasıtlı bir farktır — entegrasyon sırasında bir **adapter layer** yazılacak.

### Önerilen API Client Mapper (frontend tarafına)

| Frontend Beklediği | Backend Döndüren | Eşleme |
|---|---|---|
| `UserRole = 'oidb'` | `UserRole = 'OIDB_OFFICER'` | `roles.map(r => r.toLowerCase().split('_')[0])` |
| `ApplicationStatus = 'intake_verification'` | `ApplicationStatus = 'PENDING_OIDB_VERIFICATION'` | tablo eşleme |
| `Application.id` | `Application.applicationId` | rename |
| `Application.gpa` | `Application.submittedGpa` | rename |
| `Application.osymScore` | `Application.submittedYksScore` | rename |
| `ApplicationDocument.fileName` | `DocumentVersion.standardizedFileName` | flatten son version |
| `IntibakEntry` (flat) | `IntibakTable + MappingEntry` (nested) | flatten transformation |

Mapper `src/app/lib/api-client.ts` altına yazılacak (henüz yok). Backend hâlihazırda doğru, audit-friendly bir API; frontend tarafında shape adaptasyonu daha az iş.

### Auth Köprüsü
Frontend `localStorage.currentUser` kullanıyor; backend `x-mock-user` header bekliyor. Geçiş için iki seçenek:
1. **Kısa vade**: Frontend her API isteğinde `localStorage.currentUser.id`'yi `x-mock-user` header'ına ekler.
2. **Uzun vade**: Emre'nin auth backend'i hazır olunca login response JWT döndürür, frontend `Authorization: Bearer ...` ile gönderir, backend mockAuth → jwtAuth ile değiştirilir.

## 7. Bilinen Açıklar / Sonraki Adımlar (Diğer Ekip Üyeleri İçin)

- **Persistence**: `InMemory*Repository` sınıfları, `Prisma*Repository` adapter'ı yazılınca `container.ts` içinde tek satır değiştirilerek production'a alınır.
- **Auth**: Emre'nin `/api/auth/login` endpoint'i hazır olunca `mockAuthMiddleware` yerine JWT verify middleware'i takılır; payload formatı `{ userId, roles, departmentId?, facultyId? }` olarak ortaktır.
- **External API'ler**: `EDevletMockClient` ve `OcrParserMockClient` aynı public method imzalarıyla gerçek HTTP client'lara yer değiştirir.
- **Senaryo 5 (YGK Ranking) entegrasyonu**: Senaryo 6 başlamadan önce `Application.rankingCategory` set edilmiş olmalı; bu alan hazır olduğu için Senaryo 5 backend'i sadece bu alanı yazmakla sorumlu.
- **Senaryo 7 (Faculty Board)**: `EvaluationPackage.status = SENT` durumundaki paketleri Faculty Board kuyruğundan okur; package immutability burada garantilenmiştir.
- **Frontend bağlantısı**: `src/app/components/oidb/IntakeVerification.tsx` → `/api/oidb/applications/:id` ; `src/app/components/ygk/IntibakGeneration.tsx` → `/api/ygk/intibak/:id/prepare`.
