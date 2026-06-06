import {
  InMemoryApplicationRepository,
  InMemoryAuditRepository,
  InMemoryAuthTokenRepository,
  InMemoryCurriculumRepository,
  InMemoryDocumentRepository,
  InMemoryIntibakRepository,
  InMemoryNotificationRepository,
  InMemoryPackageRepository,
  InMemoryQuotaRepository,
  InMemoryUserRepository,
} from "./repositories";
import { seedAll } from "../mocks/seed-data";
import { EDevletMockClient } from "./external/edevlet-client";
import { OcrParserMockClient } from "./external/ocr-parser-client";

export interface AppContainer {
  users: InMemoryUserRepository;
  applications: InMemoryApplicationRepository;
  documents: InMemoryDocumentRepository;
  intibakTables: InMemoryIntibakRepository;
  curriculum: InMemoryCurriculumRepository;
  packages: InMemoryPackageRepository;
  quotas: InMemoryQuotaRepository;
  audit: InMemoryAuditRepository;
  notifications: InMemoryNotificationRepository;
  auth: InMemoryAuthTokenRepository;
  edevlet: EDevletMockClient;
  ocr: OcrParserMockClient;
}

export function createContainer(): AppContainer {
  const container: AppContainer = {
    users: new InMemoryUserRepository(),
    applications: new InMemoryApplicationRepository(),
    documents: new InMemoryDocumentRepository(),
    intibakTables: new InMemoryIntibakRepository(),
    curriculum: new InMemoryCurriculumRepository(),
    packages: new InMemoryPackageRepository(),
    quotas: new InMemoryQuotaRepository(),
    audit: new InMemoryAuditRepository(),
    notifications: new InMemoryNotificationRepository(),
    auth: new InMemoryAuthTokenRepository(),
    edevlet: new EDevletMockClient(),
    ocr: new OcrParserMockClient(),
  };
  seedAll(container);
  return container;
}

/**
 * DEV-ONLY: restore the in-memory container to its seeded baseline.
 * Clears auth state (account locks, password-reset tokens, reset rate-limit
 * counters), restores seed passwords, and re-seeds users/documents/curriculum/
 * intibak. Neon-backed data (applications/ranking/dean) is NOT touched — reset
 * that with `npx ts-node prisma/seed.ts`. Used by POST /api/dev/reset.
 */
export function resetContainer(container: AppContainer): void {
  container.users.clear();
  container.applications.clear();
  container.documents.clear();
  container.intibakTables.clear();
  container.curriculum.clear();
  container.packages.clear();
  container.quotas.clear();
  container.audit.clear();
  container.notifications.clear();
  container.auth.clear();
  container.auth.setEmailServiceAvailable(true);
  seedAll(container);
}
