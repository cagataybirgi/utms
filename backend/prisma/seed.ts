/**
 * Seeds Scenario 1 (auth users) and Scenario 5 (ranking) fixtures into Neon.
 *
 * Source of truth is src/mocks/seed-data — same builders the in-memory container
 * uses — so DB and test fixtures never drift. Idempotent upserts by primary key.
 *
 * Run: npx ts-node prisma/seed.ts   (DATABASE_URL must point at Neon)
 */
import { PrismaClient } from "@prisma/client";
import {
  buildSeedApplications,
  buildSeedDocuments,
  buildSeedQuotas,
  buildSeedUsers,
} from "../src/mocks/seed-data";
import { toPrismaCreate } from "../src/shared/mappers/application-mapper";

const prisma = new PrismaClient();

async function seedUsers(): Promise<void> {
  const users = buildSeedUsers();
  for (const u of users) {
    await prisma.user.upsert({
      where: { userId: u.userId },
      create: {
        userId: u.userId,
        tckn: u.tckn,
        fullName: u.fullName,
        email: u.email,
        phoneNum: [],
        roles: u.roles,
        departmentId: u.departmentId ?? null,
        facultyId: u.facultyId ?? null,
        failedLoginCount: 0,
        lockedUntil: null,
        password: {
          create: {
            passwordHash: u.passwordHash!,
            previousPasswordHashes: [],
          },
        },
      },
      update: {
        tckn: u.tckn,
        fullName: u.fullName,
        email: u.email,
        roles: u.roles,
        departmentId: u.departmentId ?? null,
        facultyId: u.facultyId ?? null,
        failedLoginCount: 0,
        lockedUntil: null,
        password: {
          upsert: {
            create: {
              passwordHash: u.passwordHash!,
              previousPasswordHashes: [],
            },
            update: {
              passwordHash: u.passwordHash!,
              lastChangedAt: new Date(),
            },
          },
        },
      },
    });
  }
  console.log(`Seeded ${users.length} users (Scenario 1 auth) into Neon.`);
}

async function seedApplicationsAndQuotas(): Promise<void> {
  const apps = buildSeedApplications();
  for (const app of apps) {
    const data = toPrismaCreate(app);
    await prisma.application.upsert({
      where: { applicationId: app.applicationId },
      create: data,
      update: data,
    });
  }

  const quotas = buildSeedQuotas();
  for (const q of quotas) {
    await prisma.departmentApplicationInformation.upsert({
      where: {
        departmentId_periodId: {
          departmentId: q.departmentId,
          periodId: q.periodId,
        },
      },
      create: {
        departmentId: q.departmentId,
        periodId: q.periodId,
        asilQuota: q.asilQuota,
        yedekQuota: q.yedekQuota,
      },
      update: { asilQuota: q.asilQuota, yedekQuota: q.yedekQuota },
    });
  }

  // Active application period — update directly in DB (Prisma Studio) to change dates/name.
  await prisma.period.upsert({
    where: { periodId: "period-spring-2026" },
    create: {
      periodId: "period-spring-2026",
      name: "Yaz 2025-2026",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-09-15"),
      isActive: true,
    },
    update: {
      name: "Yaz 2025-2026",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-09-15"),
      isActive: true,
    },
  });

  console.log(
    `Seeded ${apps.length} applications, ${quotas.length} quotas, and 1 active period into Neon.`
  );
}

async function seedDocuments(): Promise<void> {
  // Upsert the document slot + its first version so a live OIDB/YDYO officer sees
  // the same documents in Neon that the in-memory fixtures expose. Idempotent by
  // documentId / versionId.
  const docs = buildSeedDocuments();
  for (const doc of docs) {
    await prisma.document.upsert({
      where: {
        applicationId_documentType: {
          applicationId: doc.applicationId,
          documentType: doc.documentType,
        },
      },
      create: {
        documentId: doc.documentId,
        applicationId: doc.applicationId,
        documentType: doc.documentType,
        fileType: doc.documentType,
        status: "UPLOADED",
      },
      update: { status: "UPLOADED" },
    });
    for (const v of doc.versions) {
      await prisma.documentVersion.upsert({
        where: { versionId: v.versionId },
        create: {
          versionId: v.versionId,
          documentId: doc.documentId,
          standardizedFileName: v.standardizedFileName,
          storageKey: v.storageKey,
          versionNumber: v.versionNumber,
          isActive: true,
          uploadedBy: v.uploadedBy,
          hasBarcode: v.hasBarcode,
          isCorrupt: v.isCorrupt ?? false,
        },
        update: {
          hasBarcode: v.hasBarcode,
          isCorrupt: v.isCorrupt ?? false,
        },
      });
    }
  }
  console.log(`Seeded ${docs.length} documents (+versions) into Neon.`);
}

async function main(): Promise<void> {
  await seedUsers();
  await seedApplicationsAndQuotas();
  await seedDocuments();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
