import { Request, Response } from "express";
import { z } from "zod";
import { OidbService } from "./oidb.service";
import { OidbDocumentsService } from "./oidb-documents.service";
import { DocumentType } from "../../shared/types";
import { ServiceUnavailableError, UnauthorizedError } from "../../shared/errors";

const ReturnSchema = z.object({
  reasons: z
    .array(
      z.object({
        slot: z.nativeEnum(DocumentType),
        reason: z.string().min(1),
      }),
    )
    .min(1),
});

const RejectSchema = z.object({
  justification: z.string().min(1),
});

const ForwardSchema = z.object({
  ydyoExempt: z.boolean().default(false),
});

export class OidbController {
  constructor(
    private readonly service: OidbService,
    private readonly documents: OidbDocumentsService,
  ) {}

  listPool = async (_req: Request, res: Response): Promise<void> => {
    const pool = await this.service.listPool();
    res.json({ items: pool, count: pool.length });
  };

  getDetail = async (req: Request, res: Response): Promise<void> => {
    this.assertDocumentStoreUp(req, "Belge bulunamadı. İşlem engellendi, inceleme durduruldu.");
    const { applicationId } = req.params;
    const detail = await this.service.loadDetail(applicationId);
    res.json(detail);
  };

  getDocumentFile = async (req: Request, res: Response): Promise<void> => {
    const { applicationId, documentType } = req.params;
    const file = await this.documents.fetchFile(applicationId, documentType);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${file.fileName}"`);
    res.send(file.buffer);
  };

  verify = async (req: Request, res: Response): Promise<void> => {
    this.assertDocumentStoreUp(req, "İşlem engellendi, inceleme durduruldu.");
    const userId = this.requireUser(req);
    const { applicationId } = req.params;
    const updated = await this.service.verify(applicationId, userId);
    res.json({ application: updated, message: "Başvuru durumu güncellendi: ÖİDB Onaylı" });
  };

  returnForCorrection = async (req: Request, res: Response): Promise<void> => {
    this.assertDocumentStoreUp(req, "İşlem engellendi, inceleme durduruldu.");
    const userId = this.requireUser(req);
    const { applicationId } = req.params;
    const body = ReturnSchema.parse(req.body);
    const updated = await this.service.returnForCorrection(applicationId, userId, body);
    res.json({
      application: updated,
      message: "Başvuru düzeltme için öğrenciye iade edildi.",
    });
  };

  reject = async (req: Request, res: Response): Promise<void> => {
    this.assertDocumentStoreUp(req, "İşlem engellendi, inceleme durduruldu.");
    const userId = this.requireUser(req);
    const { applicationId } = req.params;
    const body = RejectSchema.parse(req.body);
    const updated = await this.service.reject(applicationId, userId, body);
    res.json({ application: updated, message: "Başvuru kalıcı olarak reddedildi." });
  };

  forward = async (req: Request, res: Response): Promise<void> => {
    this.assertDocumentStoreUp(req, "İşlem engellendi, inceleme durduruldu.");
    const userId = this.requireUser(req);
    const { applicationId } = req.params;
    const body = ForwardSchema.parse(req.body ?? {});
    const updated = await this.service.forward(applicationId, userId, body);
    res.json({
      application: updated,
      message: "Başvuru iletildi. Durum: YGK İletimi Bekliyor.",
    });
  };

  private requireUser(req: Request): string {
    if (!req.authUser) throw new UnauthorizedError();
    return req.authUser.userId;
  }

  // Demo/test hook: the ÖİDB panel can simulate the document store being offline
  // (Test Case 4 — DocumentStoreUnreachable) by sending this header. The review
  // is halted before any read or mutation runs, so application status is left
  // untouched — the same 503 the in-memory store produces under test.
  private assertDocumentStoreUp(req: Request, message: string): void {
    if (req.header("x-simulate-docstore-down") === "1") {
      throw new ServiceUnavailableError("DOCUMENT_STORE_UNREACHABLE", message);
    }
  }
}
