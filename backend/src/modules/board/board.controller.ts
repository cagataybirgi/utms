import { Request, Response } from "express";
import { z } from "zod";
import { BoardService } from "./board.service";
import { UnauthorizedError } from "../../shared/errors";

const SignatureIssueSchema = z.object({
  signatoryId: z.string().min(1),
});

const SignatureVerifySchema = z.object({
  token: z.string().regex(/^SIG-[A-Z]{3}-\d{8}-[A-Z0-9]+$/, {
    message: "Token must match format SIG-XXX-YYYYMMDD-NNNN",
  }),
  signatoryId: z.string().min(1),
});

const ClearHashLockSchema = z.object({
  newSignatureToken: z.string().min(1),
  signatoryId: z.string().min(1),
});

const BoardDecisionSchema = z.object({
  resolutionText: z.string().min(1, "Resolution text is required."),
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
  loopbackTarget: z.enum(["oidb", "ydyo", "ygk", "dean"]).optional(),
});

const PublishSchema = z.object({
  publishedBy: z.string().optional(),    // falls back to authUser.userId
});

const ReturnForClarificationSchema = z.object({
  note: z.string().min(1, "Clarification note is required."),
});

export class BoardController {
  constructor(private readonly service: BoardService) {}

  // ─── Queue / detail ────────────────────────────────────────────────────────

  listQueue = (req: Request, res: Response): void => {
    this.requireUser(req);
    const items = this.service.listBoardQueue();
    res.json({ items, count: items.length });
  };

  getDetail = (req: Request, res: Response): void => {
    this.requireUser(req);
    const { packageId } = req.params;
    const detail = this.service.getBoardPackage(packageId);
    res.json(detail);
  };

  // ─── TC-7B ─────────────────────────────────────────────────────────────────

  intibakCompleteness = async (req: Request, res: Response): Promise<void> => {
    this.requireUser(req);
    const { packageId } = req.params;
    const result = await this.service.checkIntibakCompleteness(packageId);
    res.json(result);
  };

  // ─── 702-HASH ──────────────────────────────────────────────────────────────

  hashCheck = (req: Request, res: Response): void => {
    this.requireUser(req);
    const { packageId } = req.params;
    const result = this.service.checkHashIntegrity(packageId);
    if (!result.isMatch) {
      res.status(409).json({
        error: "702-HASH",
        message: "Document integrity violation detected.",
        details: result,
      });
      return;
    }
    res.json(result);
  };

  clearHashLock = (req: Request, res: Response): void => {
    this.requireUser(req);
    const { packageId } = req.params;
    const body = ClearHashLockSchema.parse(req.body);
    this.service.clearHashLock(packageId, body.newSignatureToken, body.signatoryId);
    res.json({ packageId, cleared: true });
  };

  // ─── TC-7C ─────────────────────────────────────────────────────────────────

  issueSignatureToken = (req: Request, res: Response): void => {
    this.requireUser(req);
    const body = SignatureIssueSchema.parse(req.body);
    const result = this.service.issueDeanSignatureToken(body.signatoryId);
    res.json(result);
  };

  verifySignature = async (req: Request, res: Response): Promise<void> => {
    this.requireUser(req);
    const { packageId } = req.params;
    const body = SignatureVerifySchema.parse(req.body);
    const result = await this.service.verifyDeanSignature({
      packageId,
      token: body.token,
      signatoryId: body.signatoryId,
    });
    if (result.errorCode) {
      const status = result.errorCode === "7C-EXPIRED" ? 401 : 403;
      res.status(status).json({
        error: result.errorCode,
        message: result.message,
        details: result,
      });
      return;
    }
    res.json(result);
  };

  // ─── TC-7B  —  Return to YGK with clarification note ───────────────────────

  returnToYgkForClarification = (req: Request, res: Response): void => {
    const userId = this.requireUser(req);
    const { packageId } = req.params;
    const body = ReturnForClarificationSchema.parse(req.body);
    const result = this.service.returnToYgkForClarification({
      packageId,
      requestedBy: userId,
      note: body.note,
    });
    res.json(result);
  };

  // ─── TC-7A Step 4  —  Confirm for Publication ──────────────────────────────

  confirmForPublication = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    const { packageId } = req.params;
    const result = await this.service.confirmForPublication({
      packageId,
      confirmedBy: userId,
    });
    res.json(result);
  };

  // ─── TC-7A / TC-7E ─────────────────────────────────────────────────────────

  boardDecision = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    const { packageId } = req.params;
    const body = BoardDecisionSchema.parse(req.body);
    const result = await this.service.boardDecide({
      packageId,
      decidedBy: userId,
      resolutionText: body.resolutionText,
      approved: body.approved,
      rejectionReason: body.rejectionReason,
      loopbackTarget: body.loopbackTarget,
    });
    res.json(result);
  };

  // ─── TC-571-NOTIFY ─────────────────────────────────────────────────────────

  publish = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    const { packageId } = req.params;
    const body = PublishSchema.parse(req.body ?? {});
    const result = await this.service.publish({
      packageId,
      publishedBy: body.publishedBy ?? userId,
    });
    // Always HTTP 200 — notification errors live INSIDE the response body.
    res.json(result);
  };

  private requireUser(req: Request): string {
    if (!req.authUser) throw new UnauthorizedError();
    return req.authUser.userId;
  }
}
