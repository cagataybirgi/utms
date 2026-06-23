/**
 * Scenario 3 — Document upload validation (Test Plan v2).
 * Pure-function coverage for the rules that were reported Fail/Blocked:
 *   TC 3B-1  file > 10 MB                 → rejected
 *   TC 3B-2  unsupported format (.docx)   → rejected
 *   TC 3C-1  password-protected PDF       → rejected  (regression: used to pass)
 *   TC 3C-2  corrupt PDF (no %PDF header) → rejected
 */
import {
  assertValidUpload,
  isEncryptedPdf,
} from "../../src/modules/document-upload/document-upload.service";
import { DocumentType } from "../../src/shared/types";

function pdf(body = "1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF"): Buffer {
  return Buffer.from(`%PDF-${body}`, "latin1");
}

function file(over: Partial<{ originalname: string; mimetype: string; size: number; buffer: Buffer }> = {}) {
  const buffer = over.buffer ?? pdf();
  return {
    originalname: over.originalname ?? "transcript.pdf",
    mimetype: over.mimetype ?? "application/pdf",
    size: over.size ?? buffer.length,
    buffer,
  };
}

describe("assertValidUpload", () => {
  it("accepts a well-formed PDF under the size limit", () => {
    expect(() => assertValidUpload(file(), DocumentType.Transcript)).not.toThrow();
  });

  it("TC 3B-1: rejects a file larger than 10 MB", () => {
    expect(() =>
      assertValidUpload(file({ size: 15 * 1024 * 1024 }), DocumentType.Curriculum),
    ).toThrow(/10 MB/i);
  });

  it("TC 3B-2: rejects an unsupported format (.docx)", () => {
    expect(() =>
      assertValidUpload(
        file({
          originalname: "curriculum.docx",
          mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: Buffer.from("PK docx zip"),
        }),
        DocumentType.Curriculum,
      ),
    ).toThrow(/Invalid format/i);
  });

  it("TC 3C-1: rejects a password-protected (encrypted) PDF", () => {
    const encrypted = Buffer.from(
      "%PDF-1.6\n1 0 obj<<>>endobj\ntrailer<< /Root 1 0 R /Encrypt 9 0 R /ID[<a><b>] >>\n%%EOF",
      "latin1",
    );
    expect(isEncryptedPdf(encrypted)).toBe(true);
    expect(() => assertValidUpload(file({ buffer: encrypted }), DocumentType.Transcript)).toThrow(
      /password-protected/i,
    );
  });

  it("TC 3C-2: rejects a corrupt PDF with no %PDF header", () => {
    expect(() =>
      assertValidUpload(file({ buffer: Buffer.from("not really a pdf at all") }), DocumentType.Transcript),
    ).toThrow(/corrupt/i);
  });

  it("does not false-positive on a normal PDF", () => {
    expect(isEncryptedPdf(pdf())).toBe(false);
  });
});
