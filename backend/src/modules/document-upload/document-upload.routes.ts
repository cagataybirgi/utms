import { Router } from "express";
import multer from "multer";
import { requireRoles } from "../../shared/middleware/rbac";
import { UserRole } from "../../shared/types";
import { DocumentUploadService } from "./document-upload.service";
import { DocumentUploadController } from "./document-upload.controller";

// Files are validated and stored as metadata in Postgres; buffer held in memory only during the request
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 11 * 1024 * 1024 }, // 11 MB hard limit (service validates the 10 MB business rule)
});

export function buildDocumentUploadRouter(): Router {
  const service = new DocumentUploadService();
  const controller = new DocumentUploadController(service);

  const r = Router();
  r.use(requireRoles(UserRole.Student, UserRole.SystemAdmin));

  r.get("/:applicationId/checklist", controller.getChecklist);
  r.post("/:applicationId/upload/:documentType", upload.single("file"), controller.upload);
  r.post("/:applicationId/submit", controller.submit);

  return r;
}
