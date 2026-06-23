import { put } from "@vercel/blob";
import { prisma } from "../../shared/prisma-client";
import { ApplicationStatus, DocumentType, UserRole } from "../../shared/types";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface DocumentVersionDto {
  versionId: string;
  versionNumber: number;
  standardizedFileName: string;
  storageUrl: string;
  uploadedAt: string;
  uploadedBy: string;
  isActive: boolean;
}

export interface DocumentSlotDto {
  documentType: string;
  name: string;
  description: string;
  required: boolean;
  currentStatus: string;
  activeVersion: DocumentVersionDto | null;
  versionCount: number;
  acceptedFormats: string[];
  maxSizeMb: number;
}

export interface ChecklistDto {
  applicationId: string;
  applicationStatus: string;
  slots: DocumentSlotDto[];
  mandatoryCount: number;
  uploadedMandatoryCount: number;
  canSubmit: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_META: Record<DocumentType, { name: string; description: string; required: boolean }> = {
  [DocumentType.Transcript]: {
    name: "Resmi Transkript",
    description: "Mevcut üniversitenizden alınan güncel transkript",
    required: true,
  },
  [DocumentType.YksResult]: {
    name: "ÖSYM Sonuç Belgesi",
    description: "Resmi ÖSYM puan belgesi",
    required: true,
  },
  [DocumentType.StudentCertificate]: {
    name: "Öğrenci Belgesi",
    description: "Aktif öğrencilik durumunu gösteren belge",
    required: true,
  },
  [DocumentType.LanguageProof]: {
    name: "Dil Yeterlilik Belgesi",
    description: "Varsa TOEFL, IELTS veya YDS belgesi",
    required: false,
  },
  [DocumentType.Curriculum]: {
    name: "Ders Planı (Müfredat)",
    description: "Mevcut üniversitenizdeki program müfredatı",
    required: true,
  },
  [DocumentType.CourseContents]: {
    name: "Ders İçerikleri",
    description: "Tamamlanan derslerin detaylı içerikleri/syllabusları",
    required: true,
  },
  [DocumentType.Portfolio]: {
    name: "Portfolyo",
    description: "Mimarlık/Sanat programları için tasarım portfolyosu",
    required: true,
  },
};

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ACCEPTED_FORMATS: Record<DocumentType, string[]> = {
  [DocumentType.Transcript]: ["PDF", "JPG", "PNG"],
  [DocumentType.YksResult]: ["PDF", "JPG", "PNG"],
  [DocumentType.StudentCertificate]: ["PDF", "JPG", "PNG"],
  [DocumentType.LanguageProof]: ["PDF", "JPG", "PNG"],
  [DocumentType.Curriculum]: ["PDF"],
  [DocumentType.CourseContents]: ["PDF"],
  [DocumentType.Portfolio]: ["PDF"],
};

// ─── File validation (pure, unit-testable) ──────────────────────────────────────

/**
 * Password-protected / encrypted PDFs keep the "%PDF" header but declare an
 * /Encrypt entry in the trailer dictionary. The previous corruption check only
 * inspected the first 4 bytes, so encrypted files passed validation and were
 * stored anyway — the defect reported in Test Plan v2, TC 3C-1. Scanning for the
 * /Encrypt token rejects them before they reach the document store / OCR.
 */
export function isEncryptedPdf(buffer: Buffer): boolean {
  return buffer.includes(Buffer.from("/Encrypt"));
}

/**
 * Validates an uploaded document. Throws ValidationError on the first problem.
 * Exported (and pure) so the size / format / integrity rules can be unit-tested
 * without a database or blob store.
 *   - TC 3B-1: file exceeds 10 MB              → rejected
 *   - TC 3B-2: unsupported format (e.g. .docx) → rejected
 *   - TC 3C-1: password-protected PDF          → rejected (was the bug)
 *   - TC 3C-2: corrupt PDF (no %PDF header)    → rejected
 */
export function assertValidUpload(
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  documentType: DocumentType,
): void {
  if (file.size > MAX_SIZE_BYTES) {
    throw new ValidationError(
      "Invalid format or file size. Please upload PDF/JPG/PNG under 10 MB.",
      { code: "FILE_TOO_LARGE", sizeMb: Number((file.size / 1024 / 1024).toFixed(1)) },
    );
  }

  const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";
  const allowed = ACCEPTED_FORMATS[documentType].map((f) => f.toLowerCase());
  if (!ALLOWED_EXTENSIONS.has(ext) || !allowed.includes(ext)) {
    throw new ValidationError(
      "Invalid format or file size. Please upload PDF/JPG/PNG under 10 MB.",
      { code: "INVALID_FORMAT", ext, accepted: allowed },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new ValidationError("Invalid format or file size. Please upload PDF/JPG/PNG under 10 MB.", {
      code: "INVALID_MIME",
      mimetype: file.mimetype,
    });
  }

  if (ext === "pdf") {
    const header = file.buffer.subarray(0, 5).toString("latin1");
    if (!header.startsWith("%PDF")) {
      throw new ValidationError("The file appears to be corrupt and could not be read.", {
        code: "FILE_CORRUPT",
      });
    }
    if (isEncryptedPdf(file.buffer)) {
      throw new ValidationError(
        "The PDF is password-protected. Please upload an unprotected copy.",
        { code: "FILE_ENCRYPTED" },
      );
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isArchitectureDepartment(departmentId: string): boolean {
  return departmentId.toLowerCase().includes("arch");
}

function requiredSlotsFor(departmentId: string): DocumentType[] {
  const base = [
    DocumentType.Transcript,
    DocumentType.YksResult,
    DocumentType.StudentCertificate,
    DocumentType.LanguageProof,
    DocumentType.Curriculum,
    DocumentType.CourseContents,
  ];
  if (isArchitectureDepartment(departmentId)) {
    base.push(DocumentType.Portfolio);
  }
  return base;
}

function standardizedFileName(
  applicationId: string,
  documentType: DocumentType,
  tckn: string,
  originalName: string,
): string {
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "pdf";
  return `${applicationId}_${documentType}_${tckn}.${ext}`;
}

async function uploadToBlob(
  applicationId: string,
  documentType: DocumentType,
  versionNumber: number,
  standardizedName: string,
  file: UploadedFile,
): Promise<string> {
  const blobPath = `documents/${applicationId}/${documentType}/v${versionNumber}/${standardizedName}`;
  // @ts-ignore -- @vercel/blob v2+ supports "private"; run pnpm install to update local types
  const blob = await put(blobPath, file.buffer, {
    access: "private",
    contentType: file.mimetype,
  });
  return blob.url;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class DocumentUploadService {
  async getChecklist(applicationId: string, studentId: string): Promise<ChecklistDto> {
    const application = await this.requireApplication(applicationId, studentId);

    const slots = requiredSlotsFor(application.targetDepartmentId);
    const existingDocs = await prisma.document.findMany({
      where: { applicationId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
    });

    const docMap = new Map(existingDocs.map((d) => [d.documentType, d]));

    const slotDtos: DocumentSlotDto[] = slots.map((type) => {
      const meta = SLOT_META[type];
      const doc = docMap.get(type);
      const activeVersion = doc?.versions.find((v) => v.isActive) ?? null;

      return {
        documentType: type,
        name: meta.name,
        description: meta.description,
        required: meta.required,
        currentStatus: doc?.status ?? "PENDING",
        activeVersion: activeVersion
          ? {
              versionId: activeVersion.versionId,
              versionNumber: activeVersion.versionNumber,
              standardizedFileName: activeVersion.standardizedFileName,
              storageUrl: activeVersion.storageKey,
              uploadedAt: activeVersion.uploadedAt.toISOString(),
              uploadedBy: activeVersion.uploadedBy,
              isActive: true,
            }
          : null,
        versionCount: doc?.versions.length ?? 0,
        acceptedFormats: ACCEPTED_FORMATS[type],
        maxSizeMb: 10,
      };
    });

    const mandatorySlots = slotDtos.filter((s) => s.required);
    const uploadedMandatory = mandatorySlots.filter((s) => s.activeVersion !== null).length;

    return {
      applicationId,
      applicationStatus: application.currentStatus,
      slots: slotDtos,
      mandatoryCount: mandatorySlots.length,
      uploadedMandatoryCount: uploadedMandatory,
      canSubmit:
        uploadedMandatory === mandatorySlots.length &&
        (application.currentStatus === ApplicationStatus.PendingDocumentUpload ||
          application.currentStatus === ApplicationStatus.ReturnedForCorrection),
    };
  }

  async upload(
    applicationId: string,
    documentType: DocumentType,
    file: UploadedFile,
    studentId: string,
  ): Promise<DocumentSlotDto> {
    const application = await this.requireApplication(applicationId, studentId);

    if (
      application.currentStatus !== ApplicationStatus.PendingDocumentUpload &&
      application.currentStatus !== ApplicationStatus.ReturnedForCorrection
    ) {
      throw new ConflictError(
        "UPLOAD_NOT_ALLOWED",
        `Cannot upload documents when application is in status ${application.currentStatus}.`,
      );
    }

    // Validate document type is allowed for this application
    const allowedTypes = requiredSlotsFor(application.targetDepartmentId);
    if (!allowedTypes.includes(documentType)) {
      throw new ValidationError(`Document type ${documentType} is not required for this application.`);
    }

    // Validate file
    this.validateFile(file, documentType);

    const fileName = standardizedFileName(
      applicationId,
      documentType,
      application.studentTckn,
      file.originalname,
    );

    // Determine next version number before blob upload
    const existingDoc = await prisma.document.findFirst({
      where: { applicationId, documentType },
    });
    const existingVersionCount = existingDoc
      ? await prisma.documentVersion.count({ where: { documentId: existingDoc.documentId } })
      : 0;
    const nextVersion = existingVersionCount + 1;

    // Upload to private Vercel Blob store first (outside transaction — blob uploads can't be rolled back)
    const blobUrl = await uploadToBlob(applicationId, documentType, nextVersion, fileName, file);

    // Upsert Document slot, then add a new active DocumentVersion
    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.findFirst({ where: { applicationId, documentType } });

      let documentId: string;
      if (!doc) {
        const created = await tx.document.create({
          data: { applicationId, documentType, status: "UPLOADED" },
        });
        documentId = created.documentId;
      } else {
        await tx.documentVersion.updateMany({
          where: { documentId: doc.documentId, isActive: true },
          data: { isActive: false },
        });
        await tx.document.update({
          where: { documentId: doc.documentId },
          data: { status: "UPLOADED" },
        });
        documentId = doc.documentId;
      }

      const newVersion = await tx.documentVersion.create({
        data: {
          documentId,
          standardizedFileName: fileName,
          storageKey: blobUrl,
          versionNumber: nextVersion,
          isActive: true,
          uploadedBy: studentId,
          hasBarcode: false,
          isCorrupt: false,
        },
      });

      return { newVersion, totalVersions: nextVersion };
    });

    const meta = SLOT_META[documentType];
    return {
      documentType,
      name: meta.name,
      description: meta.description,
      required: meta.required,
      currentStatus: "UPLOADED",
      activeVersion: {
        versionId: result.newVersion.versionId,
        versionNumber: result.newVersion.versionNumber,
        standardizedFileName: result.newVersion.standardizedFileName,
        storageUrl: result.newVersion.storageKey,
        uploadedAt: result.newVersion.uploadedAt.toISOString(),
        uploadedBy: result.newVersion.uploadedBy,
        isActive: true,
      },
      versionCount: result.totalVersions,
      acceptedFormats: ACCEPTED_FORMATS[documentType],
      maxSizeMb: 10,
    };
  }

  async submitApplication(applicationId: string, studentId: string): Promise<void> {
    const application = await this.requireApplication(applicationId, studentId);

    if (
      application.currentStatus !== ApplicationStatus.PendingDocumentUpload &&
      application.currentStatus !== ApplicationStatus.ReturnedForCorrection
    ) {
      throw new ConflictError(
        "SUBMIT_NOT_ALLOWED",
        `Cannot submit application in status ${application.currentStatus}.`,
      );
    }

    const uploadedDocs = await prisma.document.findMany({
      where: { applicationId },
      include: { versions: { where: { isActive: true } } },
    });

    const uploadedTypes = new Set(
      uploadedDocs
        .filter((d) => d.versions.length > 0)
        .map((d) => d.documentType as DocumentType),
    );

    const required = requiredSlotsFor(application.targetDepartmentId).filter(
      (t) => SLOT_META[t].required,
    );
    const missing = required.filter((t) => !uploadedTypes.has(t));

    if (missing.length > 0) {
      throw new ValidationError("Mandatory documents are missing.", { missingSlots: missing });
    }

    await prisma.$transaction([
      prisma.application.update({
        where: { applicationId },
        data: {
          currentStatus: ApplicationStatus.PendingOidbVerification,
          lastModifiedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: studentId,
          actorRole: UserRole.Student,
          actionType: "DOCUMENT_UPLOAD_SUBMIT",
          affectedEntityId: applicationId,
          affectedEntityType: "Application",
          previousValue: JSON.stringify({ status: application.currentStatus }),
          newValue: JSON.stringify({ status: ApplicationStatus.PendingOidbVerification }),
        },
      }),
    ]);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async requireApplication(applicationId: string, studentId: string) {
    const application = await prisma.application.findUnique({
      where: { applicationId },
    });
    if (!application) {
      throw new NotFoundError(`Application not found: ${applicationId}`);
    }
    if (application.studentId !== studentId) {
      throw new ForbiddenError("You do not have access to this application.");
    }
    return application;
  }

  private validateFile(file: UploadedFile, documentType: DocumentType): void {
    assertValidUpload(file, documentType);
  }
}
