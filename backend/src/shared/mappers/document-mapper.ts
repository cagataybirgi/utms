import { Prisma } from "@prisma/client";
import { Document, DocumentType, DocumentVersion } from "../types";

// A documents row joined with its version rows, ordered oldest → newest so the
// OIDB review reads `versions[versions.length - 1]` as the latest upload.
export type PrismaDocumentRow = Prisma.DocumentGetPayload<{
  include: { versions: true };
}>;

export function documentToDomain(row: PrismaDocumentRow): Document {
  const versions: DocumentVersion[] = [...row.versions]
    .sort((a, b) => a.versionNumber - b.versionNumber)
    .map((v) => ({
      versionId: v.versionId,
      versionNumber: v.versionNumber,
      standardizedFileName: v.standardizedFileName,
      storageKey: v.storageKey,
      uploadedAt: v.uploadedAt.toISOString(),
      uploadedBy: v.uploadedBy,
      hasBarcode: v.hasBarcode,
      isCorrupt: v.isCorrupt,
    }));

  return {
    documentId: row.documentId,
    applicationId: row.applicationId,
    documentType: (row.documentType ?? row.fileType ?? "") as DocumentType,
    versions,
  };
}
