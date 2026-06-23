import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { requireRoles } from "../../shared/middleware/rbac";
import { UserRole } from "../../shared/types";
import { ValidationError } from "../../shared/errors";
import { DocumentUploadService } from "./document-upload.service";
import { DocumentUploadController } from "./document-upload.controller";

// Files are validated and stored as metadata in Postgres; buffer held in memory only during the request
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 11 * 1024 * 1024 }, // 11 MB hard limit (service validates the 10 MB business rule)
});

/**
 * Wraps multer so a rejected upload returns the same friendly business message
 * the service uses, instead of a raw "HTTP 413 Payload Too Large" (the defect
 * reported in Test Plan v2, TC 3B-1). Files of 10–11 MB still reach the service
 * and are rejected there; anything above multer's 11 MB guard is caught here and
 * converted to a 400 ValidationError that the error handler renders cleanly.
 */
function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new ValidationError(
            "Invalid format or file size. Please upload PDF/JPG/PNG under 10 MB.",
            { code: "FILE_TOO_LARGE" },
          ),
        );
      }
      return next(new ValidationError(`Upload failed: ${err.message}`, { code: err.code }));
    }
    if (err) return next(err);
    next();
  });
}

export function buildDocumentUploadRouter(): Router {
  const service = new DocumentUploadService();
  const controller = new DocumentUploadController(service);

  const r = Router();
  r.use(requireRoles(UserRole.Student, UserRole.SystemAdmin));

  r.get("/:applicationId/checklist", controller.getChecklist);
  r.post("/:applicationId/upload/:documentType", uploadSingleFile, controller.upload);
  r.post("/:applicationId/submit", controller.submit);

  return r;
}
