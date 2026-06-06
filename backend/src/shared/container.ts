import {
  InMemoryApplicationRepository,
  InMemoryAuditRepository,
  InMemoryAuthRepository,
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
  auth: InMemoryAuthRepository;
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
    auth: new InMemoryAuthRepository(),
    edevlet: new EDevletMockClient(),
    ocr: new OcrParserMockClient(),
  };
  seedAll(container);
  return container;
}
