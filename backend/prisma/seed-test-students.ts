/**
 * Seeds manual-test fixtures into Neon for two workflows:
 *   1. Dean → ÖİDB return (wrong-faculty students sitting in the Dean queue)
 *   2. YDYO language review (students sitting in the YDYO queue)
 *
 * Idempotent: upserts by applicationId, so it is safe to re-run. To remove the
 * fixtures afterwards run `npx ts-node prisma/seed-test-students.ts --clean`.
 *
 * Run: npx ts-node prisma/seed-test-students.ts   (DATABASE_URL must point at Neon)
 */
import { PrismaClient } from "@prisma/client";
import { Application, ApplicationStatus } from "../src/shared/types";
import { toPrismaCreate } from "../src/shared/mappers/application-mapper";

const prisma = new PrismaClient();

const PERIOD_ID = "period-spring-2026";

function base(
  partial: Partial<Application> & { applicationId: string; studentFullName: string; studentTckn: string },
): Application {
  const now = new Date().toISOString();
  return {
    applicationId: partial.applicationId,
    studentId: partial.studentId ?? partial.applicationId,
    studentTckn: partial.studentTckn,
    studentFullName: partial.studentFullName,
    periodId: PERIOD_ID,
    targetDepartmentId: partial.targetDepartmentId ?? "dept-computer-engineering",
    targetFacultyId: partial.targetFacultyId ?? "faculty-engineering",
    transferType: "Kurumlar Arasi Yatay Gecis",
    targetSemester: 3,
    submittedGpa: partial.submittedGpa ?? 3.2,
    submittedYksScore: 470,
    yksExamYear: 2024,
    language: "100% English",
    finishedSemester: 2,
    finishedYear: 1,
    currentInstitution: "Istanbul Technical University",
    currentDepartment: "Industrial Engineering",
    currentStatus: partial.currentStatus ?? ApplicationStatus.PendingOidbVerification,
    preScreening: { isPassed: true, failedRules: [] },
    correctionReasons: [],
    rejectionReason: undefined,
    intakeVerifiedBy: undefined,
    intakeVerifiedAt: undefined,
    routedToYdyo: partial.routedToYdyo ?? false,
    routedToDeansOffice: partial.routedToDeansOffice ?? false,
    ydyoExempt: false,
    languageProof: partial.languageProof,
    ydyoDecision: undefined,
    ydyoReviewNotes: undefined,
    ydyoReviewedBy: undefined,
    ydyoReviewedAt: undefined,
    rankingCategory: undefined,
    submittedAt: now,
    lastModifiedAt: now,
  };
}

const FIXTURES: Application[] = [
  // ── Test 1: wrong-faculty students waiting in the Dean queue ────────────────
  // They target Architecture but land in the (Engineering) Dean's queue → the
  // dean recognises the wrong faculty and returns them to ÖİDB.
  base({
    applicationId: "test-deanreturn-1",
    studentFullName: "Test DekanIade Bir",
    studentTckn: "90000000001",
    targetDepartmentId: "dept-architecture",
    targetFacultyId: "faculty-architecture",
    currentStatus: ApplicationStatus.PendingDeansOfficeReview,
  }),
  base({
    applicationId: "test-deanreturn-2",
    studentFullName: "Test DekanIade Iki",
    studentTckn: "90000000002",
    targetDepartmentId: "dept-architecture",
    targetFacultyId: "faculty-architecture",
    currentStatus: ApplicationStatus.PendingDeansOfficeReview,
  }),

  // ── Test 2: students waiting in the YDYO language-review queue ───────────────
  base({
    applicationId: "test-ydyo-1",
    studentFullName: "Test YDYO Bir",
    studentTckn: "90000000003",
    currentStatus: ApplicationStatus.InReviewYdyo,
    routedToYdyo: true,
    // IELTS 7.5 ≥ 7.0 exempt threshold → suggested decision EXEMPT
    languageProof: {
      examType: "IELTS",
      score: 7.5,
      examDate: "2025-08-15",
      validUntil: "2027-08-15",
      certificateNumber: "IELTS-77777",
    },
  }),
  base({
    applicationId: "test-ydyo-2",
    studentFullName: "Test YDYO Iki",
    studentTckn: "90000000004",
    currentStatus: ApplicationStatus.InReviewYdyo,
    routedToYdyo: true,
    // TOEFL 65 < 79 minimum → suggested decision UNSUCCESSFUL
    languageProof: {
      examType: "TOEFL_IBT",
      score: 65,
      examDate: "2025-08-15",
      validUntil: "2027-08-15",
      certificateNumber: "TOEFL-65000",
    },
  }),
];

async function clean(): Promise<void> {
  const ids = FIXTURES.map((f) => f.applicationId);
  const { count } = await prisma.application.deleteMany({
    where: { applicationId: { in: ids } },
  });
  console.log(`Removed ${count} test fixtures from Neon.`);
}

async function seed(): Promise<void> {
  for (const app of FIXTURES) {
    const data = toPrismaCreate(app);
    await prisma.application.upsert({
      where: { applicationId: app.applicationId },
      create: data,
      update: data,
    });
    console.log(`  upserted ${app.applicationId} (${app.studentFullName}) → ${app.currentStatus}`);
  }
  console.log(`Seeded ${FIXTURES.length} test students into Neon.`);
}

(async () => {
  if (process.argv.includes("--clean")) {
    await clean();
  } else {
    await seed();
  }
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
