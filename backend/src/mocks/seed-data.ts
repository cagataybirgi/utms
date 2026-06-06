import {
  Application,
  ApplicationStatus,
  DepartmentQuota,
  Document,
  DocumentType,
  PreviousCourse,
  RankingCategory,
  TargetCourse,
  User,
  UserRole,
} from "../shared/types";
import type { AppContainer } from "../shared/container";
import { hashPassword } from "../modules/auth/password";

const PERIOD_ID = "period-spring-2026";
const PERIOD_SCENARIOS = "period-ygk-scenarios-2026";
const DEPT_ME = "dept-mechanical-engineering";
const FACULTY_ENG = "faculty-engineering";
const FACULTY_ARCH = "faculty-architecture";
const DEPT_CMPE = "dept-computer-engineering";
const DEPT_EE = "dept-electrical-engineering";
const DEPT_ARCH = "dept-architecture";

export const SEED_IDS = {
  PERIOD_ID,
  FACULTY_ENG,
  FACULTY_ARCH,
  DEPT_CMPE,
  DEPT_EE,
  DEPT_ARCH,
};

function nowIso(): string {
  return new Date("2026-04-25T10:00:00.000Z").toISOString();
}

const SEED_PASSWORDS: Record<string, string> = {
  "user-oidb-1": "oidb123",
  "user-ygk-cmpe-1": "ygk123",
  "user-ygk-chair-cmpe": "ygkchair123",
  "user-deans-eng": "dean123",
  "user-admin": "admin123",
  "student-ahmet-yilmaz": "ValidPass1!",
};

/** Scenario 1 + Neon seed — same users/passwords as the in-memory container. */
export function buildSeedUsers(): User[] {
  const users: User[] = [
    {
      userId: "user-oidb-1",
      tckn: "11111111111",
      fullName: "Ahmet Mete Yazici (OIDB Officer)",
      email: "oidb1@iyte.edu.tr",
      roles: [UserRole.OidbOfficer],
    },
    {
      userId: "user-ygk-cmpe-1",
      tckn: "22222222222",
      fullName: "Melih Macit (YGK Member, CMPE)",
      email: "ygk-cmpe@iyte.edu.tr",
      roles: [UserRole.YgkMember],
      departmentId: DEPT_CMPE,
    },
    {
      userId: "user-ygk-chair-cmpe",
      tckn: "33333333333",
      fullName: "YGK Chair CMPE",
      email: "ygk-chair-cmpe@iyte.edu.tr",
      roles: [UserRole.YgkChair, UserRole.YgkMember],
      departmentId: DEPT_CMPE,
    },
    {
      userId: "user-deans-eng",
      tckn: "44444444444",
      fullName: "Deans Office Engineering",
      email: "deans-eng@iyte.edu.tr",
      roles: [UserRole.DeansOfficeStaff],
      facultyId: FACULTY_ENG,
    },
    {
      userId: "user-admin",
      tckn: "99999999999",
      fullName: "System Administrator",
      email: "admin@iyte.edu.tr",
      roles: [UserRole.SystemAdmin],
    },
    {
      userId: "student-ahmet-yilmaz",
      tckn: "12345678901",
      fullName: "Ahmet Yilmaz",
      email: "ahmet.yilmaz@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-ahmet-kaya",
      tckn: "20190501034",
      fullName: "Ahmet Kaya",
      email: "ahmet.kaya@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-baris-tan",
      tckn: "20190501035",
      fullName: "Baris Tan",
      email: "baris.tan@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-ela-oz",
      tckn: "20190501036",
      fullName: "Ela Oz",
      email: "ela.oz@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-zeynep-demir",
      tckn: "20190501042",
      fullName: "Zeynep Demir",
      email: "zeynep.demir@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-can-aydin",
      tckn: "20190501050",
      fullName: "Can Aydin",
      email: "can.aydin@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-berk-yilmaz",
      tckn: "20190501055",
      fullName: "Berk Yilmaz",
      email: "berk.yilmaz@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-duru-celik",
      tckn: "20190501061",
      fullName: "Duru Celik",
      email: "duru.celik@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-sude-arslan",
      tckn: "20190501070",
      fullName: "Sude Arslan",
      email: "sude.arslan@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-mert-koc",
      tckn: "20190501078",
      fullName: "Mert Koc",
      email: "mert.koc@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-elif-yildiz",
      tckn: "20190501099",
      fullName: "Elif Yildiz",
      email: "elif.yildiz@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-selin-aksoy",
      tckn: "20190501088",
      fullName: "Selin Aksoy",
      email: "selin.aksoy@iyte.edu.tr",
      roles: [UserRole.Student],
    },
    {
      userId: "student-cem-polat",
      tckn: "20190501091",
      fullName: "Cem Polat",
      email: "cem.polat@iyte.edu.tr",
      roles: [UserRole.Student],
    },
  ];

  return users.map((u) => ({
    ...u,
    passwordHash: hashPassword(SEED_PASSWORDS[u.userId] ?? "Ogrenci123!"),
    failedLoginAttempts: 0,
    lockedUntil: null,
  }));
}

function seedUsers(c: AppContainer): void {
  for (const u of buildSeedUsers()) {
    c.users.put(u);
  }
}

function buildApplication(partial: Partial<Application> & { applicationId: string; studentId: string }): Application {
  const fallbackTcknMap: Record<string, string> = {
    "student-ahmet-yilmaz": "12345678901",
  };
  return {
    applicationId: partial.applicationId,
    studentId: partial.studentId,
    studentTckn: partial.studentTckn ?? fallbackTcknMap[partial.studentId] ?? "",
    studentFullName: partial.studentFullName ?? "",
    periodId: partial.periodId ?? PERIOD_ID,
    targetDepartmentId: partial.targetDepartmentId ?? DEPT_CMPE,
    targetFacultyId: partial.targetFacultyId ?? FACULTY_ENG,
    transferType: partial.transferType ?? "Kurumlar Arasi Yatay Gecis",
    targetSemester: partial.targetSemester ?? 3,
    submittedGpa: partial.submittedGpa ?? 3.45,
    submittedYksScore: partial.submittedYksScore ?? 485.5,
    yksExamYear: partial.yksExamYear ?? 2024,
    language: partial.language ?? "100% English",
    finishedSemester: partial.finishedSemester ?? 2,
    finishedYear: partial.finishedYear ?? 1,
    currentInstitution: partial.currentInstitution ?? "Istanbul Technical University",
    currentDepartment: partial.currentDepartment ?? "Industrial Engineering",
    currentStatus: partial.currentStatus ?? ApplicationStatus.PendingOidbVerification,
    preScreening: partial.preScreening ?? { isPassed: true, failedRules: [] },
    correctionReasons: partial.correctionReasons ?? [],
    rejectionReason: partial.rejectionReason,
    intakeVerifiedBy: partial.intakeVerifiedBy,
    intakeVerifiedAt: partial.intakeVerifiedAt,
    routedToYdyo: partial.routedToYdyo ?? false,
    routedToDeansOffice: partial.routedToDeansOffice ?? false,
    ydyoExempt: partial.ydyoExempt ?? false,
    rankingCategory: partial.rankingCategory,
    intibakTableId: partial.intibakTableId,
    submittedAt: partial.submittedAt ?? nowIso(),
    lastModifiedAt: partial.lastModifiedAt ?? nowIso(),
  };
}

export function buildSeedApplications(): Application[] {
  return [
    buildApplication({
      applicationId: "app-1001",
      studentId: "student-ahmet-yilmaz",
      studentTckn: "12345678901",
      studentFullName: "Ahmet Yilmaz",
      currentStatus: ApplicationStatus.PendingOidbVerification,
    }),
    buildApplication({
      applicationId: "app-1002",
      studentId: "student-baris-tan",
      studentFullName: "Baris Tan",
      currentStatus: ApplicationStatus.PendingOidbVerification,
    }),
    buildApplication({
      applicationId: "app-1003",
      studentId: "student-ela-oz",
      studentFullName: "Ela Oz",
      currentStatus: ApplicationStatus.PendingOidbVerification,
    }),
    buildApplication({
      applicationId: "app-1004",
      studentId: "student-zeynep-demir",
      studentFullName: "Zeynep Demir",
      currentStatus: ApplicationStatus.PendingOidbVerification,
    }),
    buildApplication({
      applicationId: "app-asil-ahmet-kaya",
      studentId: "student-ahmet-kaya",
      studentFullName: "Ahmet Kaya",
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    buildApplication({
      applicationId: "app-asil-baris-tan",
      studentId: "student-baris-tan",
      studentFullName: "Baris Tan",
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    buildApplication({
      applicationId: "app-asil-ela-oz",
      studentId: "student-ela-oz",
      studentFullName: "Ela Oz",
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    buildApplication({
      applicationId: "app-asil-zeynep-demir",
      studentId: "student-zeynep-demir",
      studentFullName: "Zeynep Demir",
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    buildApplication({
      applicationId: "app-asil-berk-yilmaz",
      studentId: "student-berk-yilmaz",
      studentFullName: "Berk Yilmaz",
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    buildApplication({
      applicationId: "app-asil-duru-celik",
      studentId: "student-duru-celik",
      studentFullName: "Duru Celik",
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    buildApplication({
      applicationId: "app-asil-elif-yildiz",
      studentId: "student-elif-yildiz",
      studentFullName: "Elif Yildiz",
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    buildApplication({
      applicationId: "app-asil-can-aydin",
      studentId: "student-can-aydin",
      studentFullName: "Can Aydin",
      targetDepartmentId: DEPT_EE,
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    buildApplication({
      applicationId: "app-asil-sude-arslan",
      studentId: "student-sude-arslan",
      studentFullName: "Sude Arslan",
      currentInstitution: "Mimar Sinan University",
      currentDepartment: "Fine Arts",
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    buildApplication({
      applicationId: "app-asil-mert-koc",
      studentId: "student-mert-koc",
      studentFullName: "Mert Koc",
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    // ── Test Case 6K: Selin Aksoy — başarılı OCR ile transkript okuma ───────
    buildApplication({
      applicationId: "app-asil-selin-aksoy",
      studentId: "student-selin-aksoy",
      studentFullName: "Selin Aksoy",
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    // ── Test Case 6L: Cem Polat — akıllı öneri benzerlik eşiği doğrulama ────
    buildApplication({
      applicationId: "app-asil-cem-polat",
      studentId: "student-cem-polat",
      studentFullName: "Cem Polat",
      currentStatus: ApplicationStatus.RankedAsil,
      rankingCategory: RankingCategory.Asil,
    }),
    buildApplication({
      applicationId: "app-yedek-1",
      studentId: "student-mert-koc",
      studentFullName: "Yedek Student 1",
      currentStatus: ApplicationStatus.RankedYedek,
      rankingCategory: RankingCategory.Yedek,
    }),
    buildApplication({
      applicationId: "app-red-1",
      studentId: "student-mert-koc",
      studentFullName: "Red Student 1",
      currentStatus: ApplicationStatus.RankedRed,
      rankingCategory: RankingCategory.Red,
      rejectionReason: "Below quota",
    }),

    // ── Test Case 5A0: Dean kuyruğundan YGK'ya iletme ───────────────────────
    buildApplication({
      applicationId: "app-sevda-birkan-dean",
      studentId: "student-sevda-birkan",
      studentTckn: "11122233344",
      studentFullName: "Sevda Birkan",
      periodId: PERIOD_SCENARIOS,
      targetDepartmentId: DEPT_CMPE,
      targetFacultyId: FACULTY_ENG,
      targetSemester: 3,
      submittedGpa: 3.80,
      submittedYksScore: 450,
      yksExamYear: 2024,
      finishedSemester: 3,
      currentInstitution: "Istanbul Technical University",
      currentDepartment: "Industrial Engineering",
      ydyoExempt: true,
      currentStatus: ApplicationStatus.PendingDeansOfficeReview,
      preScreening: { isPassed: true, failedRules: [] },
    }),

    // ── Test Case 5B: Kerem Doğan — yanlış fakülte (Mimarlık → Mühendislik) ─
    buildApplication({
      applicationId: "app-kerem-dogan",
      studentId: "student-kerem-dogan",
      studentTckn: "99988877766",
      studentFullName: "Kerem Dogan",
      periodId: PERIOD_SCENARIOS,
      targetDepartmentId: DEPT_ARCH,
      targetFacultyId: FACULTY_ARCH,
      targetSemester: 3,
      submittedGpa: 3.20,
      submittedYksScore: 410,
      yksExamYear: 2024,
      finishedSemester: 3,
      currentInstitution: "Dokuz Eylul University",
      currentDepartment: "Architecture",
      ydyoExempt: false,
      currentStatus: ApplicationStatus.PendingDeansOfficeReview,
      preScreening: { isPassed: true, failedRules: [] },
    }),

    // ── Test Case 5D: Deniz Arslan — geçersiz dönem (4. dönem) ─────────────
    buildApplication({
      applicationId: "app-deniz-arslan",
      studentId: "student-deniz-arslan",
      studentTckn: "22233344455",
      studentFullName: "Deniz Arslan",
      periodId: PERIOD_SCENARIOS,
      targetDepartmentId: DEPT_CMPE,
      targetFacultyId: FACULTY_ENG,
      targetSemester: 3,
      submittedGpa: 3.10,
      submittedYksScore: 420,
      yksExamYear: 2024,
      finishedSemester: 4,
      currentInstitution: "Bogazici University",
      currentDepartment: "Computer Engineering",
      ydyoExempt: false,
      currentStatus: ApplicationStatus.IntakeVerified,
      preScreening: { isPassed: false, failedRules: ["INVALID_SEMESTER"] },
    }),

    // ── Test Case 5E: Burak Çelik — İnşaat Müh., koşul yok ────────────────
    buildApplication({
      applicationId: "app-burak-celik",
      studentId: "student-burak-celik",
      studentTckn: "33344455566",
      studentFullName: "Burak Celik",
      periodId: PERIOD_SCENARIOS,
      targetDepartmentId: "dept-civil",
      targetFacultyId: FACULTY_ENG,
      targetSemester: 5,
      submittedGpa: 2.90,
      submittedYksScore: 380,
      yksExamYear: 2024,
      finishedSemester: 5,
      currentInstitution: "Dokuz Eylul University",
      currentDepartment: "Civil Engineering",
      ydyoExempt: false,
      currentStatus: ApplicationStatus.IntakeVerified,
      preScreening: { isPassed: true, failedRules: [] },
    }),

    // ── Test Case 5F: Selin Kaya — Mimarlık, koşullar karşılanmıyor ────────
    buildApplication({
      applicationId: "app-selin-kaya",
      studentId: "student-selin-kaya",
      studentTckn: "44455566677",
      studentFullName: "Selin Kaya",
      periodId: PERIOD_SCENARIOS,
      targetDepartmentId: DEPT_ARCH,
      targetFacultyId: FACULTY_ARCH,
      targetSemester: 3,
      submittedGpa: 2.80,
      submittedYksScore: 360,
      yksExamYear: 2024,
      finishedSemester: 3,
      currentInstitution: "Mimar Sinan University",
      currentDepartment: "Architecture",
      ydyoExempt: false,
      currentStatus: ApplicationStatus.IntakeVerified,
      preScreening: {
        isPassed: false,
        failedRules: ["DEPT_CONDITION_FAILED"],
        conditionChecks: [
          { name: "Tasarım Stüdyosu", requirement: "AA", studentValue: "BB", met: false },
          { name: "Portfolyo", requirement: "Yüklenmeli", studentValue: "Yüklenmemiş", met: false },
        ],
      },
    }),

    // ── Test Case 5G: Mert Şahin — Mimarlık, koşullar karşılanıyor ─────────
    buildApplication({
      applicationId: "app-mert-sahin",
      studentId: "student-mert-sahin",
      studentTckn: "55566677788",
      studentFullName: "Mert Sahin",
      periodId: PERIOD_SCENARIOS,
      targetDepartmentId: DEPT_ARCH,
      targetFacultyId: FACULTY_ARCH,
      targetSemester: 3,
      submittedGpa: 3.20,
      submittedYksScore: 400,
      yksExamYear: 2024,
      finishedSemester: 3,
      currentInstitution: "Istanbul University",
      currentDepartment: "Interior Architecture",
      ydyoExempt: false,
      currentStatus: ApplicationStatus.IntakeVerified,
      preScreening: {
        isPassed: true,
        failedRules: [],
        conditionChecks: [
          { name: "Tasarım Stüdyosu", requirement: "AA", studentValue: "AA", met: true },
          { name: "Portfolyo", requirement: "Yüklenmeli", studentValue: "Yüklendi", met: true },
        ],
      },
    }),

    // ── Test Case 5K: Tie-breaking — Makine Müh. ────────────────────────────
    // Emre Yılmaz: daha yüksek puan, açıkça Asil#1
    buildApplication({
      applicationId: "app-emre-yilmaz-me",
      studentId: "student-emre-yilmaz-me",
      studentTckn: "77788899900",
      studentFullName: "Emre Yilmaz",
      periodId: PERIOD_SCENARIOS,
      targetDepartmentId: DEPT_ME,
      targetFacultyId: FACULTY_ENG,
      targetSemester: 3,
      submittedGpa: 3.80,
      submittedYksScore: 450,
      yksExamYear: 2024,
      finishedSemester: 3,
      currentInstitution: "Ankara University",
      currentDepartment: "Mechanical Engineering",
      ydyoExempt: false,
      // score = (450/500*0.9)+(3.80*0.1) = 0.81+0.38 = 1.19
      currentStatus: ApplicationStatus.InReviewYgk,
      preScreening: { isPassed: true, failedRules: [] },
    }),
    // Seda Soyman: aynı puan → eşitlik
    buildApplication({
      applicationId: "app-seda-soyman",
      studentId: "student-seda-soyman",
      studentTckn: "88899900011",
      studentFullName: "Seda Soyman",
      periodId: PERIOD_SCENARIOS,
      targetDepartmentId: DEPT_ME,
      targetFacultyId: FACULTY_ENG,
      targetSemester: 3,
      submittedGpa: 3.50,
      submittedYksScore: 400,
      yksExamYear: 2024,
      finishedSemester: 3,
      currentInstitution: "Ege University",
      currentDepartment: "Mechanical Engineering",
      ydyoExempt: false,
      // score = (400/500*0.9)+(3.50*0.1) = 0.72+0.35 = 1.07 (tie ile Safiye)
      currentStatus: ApplicationStatus.InReviewYgk,
      preScreening: { isPassed: true, failedRules: [] },
    }),
    // Safiye Sayan: aynı puan → eşitlik
    buildApplication({
      applicationId: "app-safiye-sayan",
      studentId: "student-safiye-sayan",
      studentTckn: "99900011122",
      studentFullName: "Safiye Sayan",
      periodId: PERIOD_SCENARIOS,
      targetDepartmentId: DEPT_ME,
      targetFacultyId: FACULTY_ENG,
      targetSemester: 3,
      submittedGpa: 3.50,
      submittedYksScore: 400,
      yksExamYear: 2024,
      finishedSemester: 3,
      currentInstitution: "Dokuz Eylul University",
      currentDepartment: "Industrial Engineering",
      ydyoExempt: false,
      // score = 1.07 (aynı Seda ile)
      currentStatus: ApplicationStatus.InReviewYgk,
      preScreening: { isPassed: true, failedRules: [] },
    }),

    // ── Test Case 5L: Caner Ak — zorunlu not girilmeden karar engellendi ────
    buildApplication({
      applicationId: "app-caner-ak",
      studentId: "student-caner-ak",
      studentTckn: "10011022033",
      studentFullName: "Caner Ak",
      periodId: PERIOD_SCENARIOS,
      targetDepartmentId: DEPT_CMPE,
      targetFacultyId: FACULTY_ENG,
      targetSemester: 3,
      submittedGpa: 3.00,
      submittedYksScore: 410,
      yksExamYear: 2024,
      finishedSemester: 3,
      currentInstitution: "Hacettepe University",
      currentDepartment: "Computer Engineering",
      ydyoExempt: false,
      currentStatus: ApplicationStatus.IntakeVerified,
      preScreening: { isPassed: true, failedRules: [] },
    }),

    // ── Test Case 5H: Ceren Aydın — YKS puanı eksik ────────────────────────
    buildApplication({
      applicationId: "app-ceren-aydin",
      studentId: "student-ceren-aydin",
      studentTckn: "66677788899",
      studentFullName: "Ceren Aydin",
      periodId: PERIOD_SCENARIOS,
      targetDepartmentId: DEPT_CMPE,
      targetFacultyId: FACULTY_ENG,
      targetSemester: 5,
      submittedGpa: 2.90,
      submittedYksScore: undefined,
      finishedSemester: 5,
      currentInstitution: "Ankara University",
      currentDepartment: "Computer Science",
      ydyoExempt: false,
      currentStatus: ApplicationStatus.IntakeVerified,
      preScreening: { isPassed: true, failedRules: [] },
    }),
  ];
}

function seedApplications(c: AppContainer): void {
  for (const a of buildSeedApplications()) c.applications.put(a);
}

function makeDoc(applicationId: string, type: DocumentType, hasBarcode: boolean, suffix = ""): Document {
  const slot = type.toLowerCase();
  const id = `doc-${applicationId}-${slot}${suffix}`;
  return {
    documentId: id,
    applicationId,
    documentType: type,
    versions: [
      {
        versionId: `${id}-v1`,
        versionNumber: 1,
        standardizedFileName: `${applicationId}_${type}_TCKN.pdf`,
        storageKey: `s3://utms/${applicationId}/${type}-v1.pdf`,
        uploadedAt: nowIso(),
        uploadedBy: "seed",
        hasBarcode,
      },
    ],
  };
}

function seedDocuments(c: AppContainer): void {
  const oidbApps = ["app-1001", "app-1002", "app-1003", "app-1004"];
  for (const appId of oidbApps) {
    c.documents.put(makeDoc(appId, DocumentType.Transcript, true));
    c.documents.put(makeDoc(appId, DocumentType.YksResult, true));
    c.documents.put(makeDoc(appId, DocumentType.StudentCertificate, true));
    c.documents.put(makeDoc(appId, DocumentType.LanguageProof, false));
    c.documents.put(makeDoc(appId, DocumentType.Curriculum, false));
    c.documents.put(makeDoc(appId, DocumentType.CourseContents, false));
  }

  const intibakApps = [
    "app-asil-ahmet-kaya",
    "app-asil-baris-tan",
    "app-asil-ela-oz",
    "app-asil-zeynep-demir",
    "app-asil-berk-yilmaz",
    "app-asil-duru-celik",
    "app-asil-elif-yildiz",
    "app-asil-can-aydin",
    "app-asil-sude-arslan",
    "app-asil-mert-koc",
    "app-asil-selin-aksoy",
    "app-asil-cem-polat",
  ];
  for (const appId of intibakApps) {
    c.documents.put(makeDoc(appId, DocumentType.Transcript, true));
  }
}

function seedCurriculum(c: AppContainer): void {
  const cmpeCurriculum: TargetCourse[] = [
    { code: "CMPE101", name: "Introduction to Programming", ects: 6 },
    { code: "CMPE112", name: "Discrete Mathematics", ects: 6 },
    { code: "CMPE213", name: "Data Structures", ects: 6 },
    { code: "MATH101", name: "Calculus I", ects: 7 },
    { code: "MATH102", name: "Calculus II", ects: 7 },
    { code: "MATH100", name: "Calculus I+II Combined", ects: 8 },
    { code: "PHYS101", name: "Physics I", ects: 6 },
    { code: "ENG101", name: "English I", ects: 3 },
    { code: "ENG111", name: "English Elective", ects: 3 },
  ];
  c.curriculum.put({ departmentId: DEPT_CMPE, courses: cmpeCurriculum, isDefined: true });
  c.curriculum.put({ departmentId: DEPT_ARCH, courses: [], isDefined: true });
  c.curriculum.put({ departmentId: DEPT_EE, courses: [], isDefined: false });
}

function seedOcrFor(c: AppContainer): void {
  const ahmetTranscript: PreviousCourse[] = [
    { code: "CMPE101", name: "Intro to Programming", letterGrade: "AA", ects: 6 },
    { code: "MATH151", name: "Calculus I", letterGrade: "BA", ects: 7 },
    { code: "PHYS101", name: "Physics I", letterGrade: "CB", ects: 6 },
    { code: "ENG101", name: "English I", letterGrade: "AA", ects: 3 },
  ];
  c.ocr.setTranscriptFor("doc-app-asil-ahmet-kaya-transcript", { ok: true, courses: ahmetTranscript });

  const zeynepTranscript: PreviousCourse[] = [
    { code: "MATH151", name: "Calculus I", letterGrade: "BA", ects: 7 },
    { code: "CMPE101", name: "Intro to Programming", letterGrade: "AA", ects: 6 },
  ];
  c.ocr.setTranscriptFor("doc-app-asil-zeynep-demir-transcript", { ok: true, courses: zeynepTranscript });

  const berkTranscript: PreviousCourse[] = [
    { code: "CALC1", name: "Calculus I", letterGrade: "AA", ects: 4 },
    { code: "CALC2", name: "Calculus II", letterGrade: "BA", ects: 4 },
  ];
  c.ocr.setTranscriptFor("doc-app-asil-berk-yilmaz-transcript", { ok: true, courses: berkTranscript });

  const duruTranscript: PreviousCourse[] = [
    { code: "CMPE101", name: "Intro to Programming", letterGrade: "AA", ects: 6 },
    { code: "HIST200", name: "Ottoman History", letterGrade: "AA", ects: 3 },
  ];
  c.ocr.setTranscriptFor("doc-app-asil-duru-celik-transcript", { ok: true, courses: duruTranscript });

  c.ocr.setTranscriptFor("doc-app-asil-elif-yildiz-transcript", { ok: false, reason: "LOW_QUALITY_SCAN" });

  const sudeTranscript: PreviousCourse[] = [
    { code: "FA210", name: "Sculpture", letterGrade: "AA", ects: 6 },
    { code: "FA230", name: "Painting", letterGrade: "BA", ects: 5 },
    { code: "FA240", name: "Art History", letterGrade: "CB", ects: 4 },
    { code: "FA250", name: "Drawing", letterGrade: "AA", ects: 5 },
  ];
  c.ocr.setTranscriptFor("doc-app-asil-sude-arslan-transcript", { ok: true, courses: sudeTranscript });

  const mertTranscript: PreviousCourse[] = [
    { code: "CMPE101", name: "Intro to Programming", letterGrade: "AA", ects: 6 },
    { code: "MATH151", name: "Calculus I", letterGrade: "BA", ects: 7 },
  ];
  c.ocr.setTranscriptFor("doc-app-asil-mert-koc-transcript", { ok: true, courses: mertTranscript });

  c.ocr.setTranscriptFor("doc-app-asil-can-aydin-transcript", { ok: true, courses: [] });

  // Test Case 6K: high-quality, machine-readable transcript — exactly 4 courses.
  const selinTranscript: PreviousCourse[] = [
    { code: "CMPE101", name: "Introduction to Programming", letterGrade: "AA", ects: 6 },
    { code: "MATH151", name: "Calculus I", letterGrade: "BA", ects: 7 },
    { code: "PHYS101", name: "Physics I", letterGrade: "CB", ects: 6 },
    { code: "ENG101", name: "English I", letterGrade: "AA", ects: 3 },
  ];
  c.ocr.setTranscriptFor("doc-app-asil-selin-aksoy-transcript", { ok: true, courses: selinTranscript });

  // Test Case 6L: similarity-threshold fixtures.
  //  (a) high code+name similarity, exact ECTS → match CMPE101
  //  (b) partial code, high name, exact ECTS    → match MATH101 (Calculus I)
  //  (c) low code, high name, exact ECTS        → match CMPE213 (Data Structures)
  //  (d) no similarity, ECTS out of range       → no suggestion
  //  (e) code-prefix match but ECTS far off     → no suggestion
  const cemTranscript: PreviousCourse[] = [
    { code: "CMP101", name: "Intro to Programming", letterGrade: "AA", ects: 6 },
    { code: "MAT150", name: "Calculus", letterGrade: "BA", ects: 7 },
    { code: "CSE220", name: "Data Structures and Algorithms", letterGrade: "BB", ects: 6 },
    { code: "HIST200", name: "Ottoman History", letterGrade: "AA", ects: 3 },
    { code: "CMPE999", name: "Senior Project", letterGrade: "AA", ects: 12 },
  ];
  c.ocr.setTranscriptFor("doc-app-asil-cem-polat-transcript", { ok: true, courses: cemTranscript });
}

export function buildSeedQuotas(): DepartmentQuota[] {
  return [
    // Test Case 5A: Bilgisayar Müh. — Asil:2, Yedek:3
    { departmentId: DEPT_CMPE, periodId: PERIOD_SCENARIOS, asilQuota: 2, yedekQuota: 3 },
    // Test Case 5K: Makine Müh. — Asil:2, Yedek:1
    { departmentId: DEPT_ME, periodId: PERIOD_SCENARIOS, asilQuota: 2, yedekQuota: 1 },
    // Mimarlık — Asil:2, Yedek:1
    { departmentId: DEPT_ARCH, periodId: PERIOD_SCENARIOS, asilQuota: 2, yedekQuota: 1 },
    // Bahar 2026 dönem kotaları
    { departmentId: DEPT_CMPE, periodId: PERIOD_ID, asilQuota: 8, yedekQuota: 4 },
    { departmentId: DEPT_EE, periodId: PERIOD_ID, asilQuota: 4, yedekQuota: 2 },
  ];
}

function seedQuotas(c: AppContainer): void {
  for (const q of buildSeedQuotas()) c.quotas.put(q);
}

export function seedAll(c: AppContainer): void {
  seedUsers(c);
  seedApplications(c);
  seedDocuments(c);
  seedCurriculum(c);
  seedOcrFor(c);
  seedQuotas(c);
}
