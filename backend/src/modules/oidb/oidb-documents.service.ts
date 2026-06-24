import { get } from "@vercel/blob";
import { prisma } from "../../shared/prisma-client";
import { NotFoundError, ServiceUnavailableError } from "../../shared/errors";

// Streams the actual uploaded document file to the ÖİDB officer. Metadata (the
// document list) comes from OidbService.loadDetail; this exists only because the
// file body lives in a *private* Vercel Blob that the browser can't fetch
// directly — the request is proxied here with the read-write token.

export interface OidbDocumentFile {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

function contentTypeFor(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
}

export class OidbDocumentsService {
  async fetchFile(applicationId: string, documentType: string): Promise<OidbDocumentFile> {
    const doc = await prisma.document.findFirst({
      where: { applicationId, documentType },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });
    // The active version, falling back to the most recent one — matches the
    // version the detail view surfaces (latest by versionNumber).
    const version = doc?.versions.find((v) => v.isActive) ?? doc?.versions[0];
    if (!doc || !version) {
      throw new NotFoundError(
        `No uploaded document for slot ${documentType} on application ${applicationId}.`,
      );
    }

    let result;
    try {
      result = await get(version.storageKey, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch (e) {
      throw new ServiceUnavailableError(
        "DOCUMENT_STORE_UNREACHABLE",
        "The document store is unreachable. Please try again.",
      );
    }

    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new NotFoundError(`Document file could not be retrieved for slot ${documentType}.`);
    }

    const chunks: Buffer[] = [];
    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }

    return {
      buffer: Buffer.concat(chunks),
      contentType: result.blob.contentType ?? contentTypeFor(version.standardizedFileName),
      fileName: version.standardizedFileName,
    };
  }
}
