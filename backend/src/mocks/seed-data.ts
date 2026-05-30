import {
  Application,
  ApplicationStatus,
  Document,
  DocumentType,
  PreviousCourse,
  RankingCategory,
  TargetCourse,
  User,
  UserRole,
} from "../shared/types";
import type { AppContainer } from "../shared/container";

const PERIOD_ID = "period-spring-2026";
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

function seedUsers(c: AppContainer): void {
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
  ];
  for (const u of users) c.users.put(u);
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

function seedApplications(c: AppContainer): void {
  const apps: Application[] = [
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
  ];
  for (const a of apps) c.applications.put(a);
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
  ];
  for (const appId of intibakApps) {
    c.documents.put(makeDoc(appId, DocumentType.Transcript, true));
  }
}

function seedCurriculum(c: AppContainer): void {
  const cmpeCurriculum: TargetCourse[] = [
    { code: "CMPE101", name: "Introduction to Programming", ects: 6 },
    { code: "CMPE112", name: "Discrete Mathematics", ects: 6 },
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
}

export function seedAll(c: AppContainer): void {
  seedUsers(c);
  seedApplications(c);
  seedDocuments(c);
  seedCurriculum(c);
  seedOcrFor(c);
}
