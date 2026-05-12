import { Request, Response, NextFunction } from "express";
import { DocumentUploadService } from "./document-upload.service";
import { DocumentType } from "../../shared/types";
import { UnauthorizedError, ValidationError } from "../../shared/errors";

export class DocumentUploadController {
  constructor(private readonly service: DocumentUploadService) {}

  getChecklist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const studentId = this.requireUser(req);
      const { applicationId } = req.params;
      const checklist = await this.service.getChecklist(applicationId, studentId);
      res.json(checklist);
    } catch (e) {
      next(e);
    }
  };

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const studentId = this.requireUser(req);
      const { applicationId, documentType } = req.params;

      if (!Object.values(DocumentType).includes(documentType as DocumentType)) {
        throw new ValidationError(`Unknown document type: ${documentType}`);
      }

      if (!req.file) {
        throw new ValidationError("No file attached. Send the file as multipart form-data field 'file'.");
      }

      const slot = await this.service.upload(
        applicationId,
        documentType as DocumentType,
        req.file,
        studentId,
      );
      res.json(slot);
    } catch (e) {
      next(e);
    }
  };

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const studentId = this.requireUser(req);
      const { applicationId } = req.params;
      await this.service.submitApplication(applicationId, studentId);
      res.json({ message: "Application submitted successfully. Status: PENDING_OIDB_VERIFICATION." });
    } catch (e) {
      next(e);
    }
  };

  private requireUser(req: Request): string {
    if (!req.authUser) throw new UnauthorizedError();
    return req.authUser.userId;
  }
}
