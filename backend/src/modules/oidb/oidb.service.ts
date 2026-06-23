import {
  Application,
  ApplicationStatus,
  CorrectionReason,
  Document,
  DocumentVerificationBadge,
  DocumentVerificationOutcome,
  DocumentType,
  UserRole,
} from "../../shared/types";
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../shared/errors";
import {
  IAsyncApplicationRepository,
  IDocumentRepository,
  IUserRepository,
} from "../../shared/repositories";
import { EDevletMockClient } from "../../shared/external/edevlet-client";
import { AuditLogger, NotificationService } from "../../shared/audit";

export interface OidbServiceDeps {
  applications: IAsyncApplicationRepository;
  documents: IDocumentRepository;
  users: IUserRepository;
  edevlet: EDevletMockClient;
  audit: AuditLogger;
  notifications: NotificationService;
}

export interface ApplicationDetailDto {
  application: Application;
  documents: Document[];
  verifications: DocumentVerificationOutcome[];
}

export interface ReturnInput {
  reasons: CorrectionReason[];
}

export interface RejectInput {
  justification: string;
}

export interface ForwardInput {
  ydyoExempt: boolean;
}

const POOL_STATUSES = new Set([
  ApplicationStatus.PendingOidbVerification,
  ApplicationStatus.ReturnedForCorrection,
]);

export class OidbService {
  constructor(private readonly deps: OidbServiceDeps) {}

  async listPool(): Promise<Application[]> {
    const all = await this.deps.applications.findAll();
    return all
      .filter((a) => POOL_STATUSES.has(a.currentStatus))
      .sort((a, b) => a.applicationId.localeCompare(b.applicationId));
  }

  async loadDetail(applicationId: string): Promise<ApplicationDetailDto> {
    const application = await this.requireApp(applicationId);
    if (!this.deps.documents.isStoreReachable()) {
      throw new ServiceUnavailableError(
        "DOCUMENT_STORE_UNREACHABLE",
        "Document can not find. Action blocked, review halted.",
      );
    }
    const documents = this.deps.documents.findByApplicationId(applicationId);
    const verifications = documents.map<DocumentVerificationOutcome>((d) => {
      const v = d.versions[d.versions.length - 1];
      try {
        const outcome = this.deps.edevlet.verify(d.documentId, v.hasBarcode);
        return {
          documentId: d.documentId,
          documentType: d.documentType,
          badge: outcome.badge,
          message: outcome.message,
        };
      } catch (e) {
        return {
          documentId: d.documentId,
          documentType: d.documentType,
          badge: DocumentVerificationBadge.ManualCheckRequired,
          message: "e-Devlet unreachable; falling back to manual",
        };
      }
    });
    return { application, documents, verifications };
  }

  async verify(applicationId: string, actorUserId: string): Promise<Application> {
    const application = await this.requireApp(applicationId);
    if (!this.deps.documents.isStoreReachable()) {
      throw new ServiceUnavailableError(
        "DOCUMENT_STORE_UNREACHABLE",
        "Action blocked, review halted.",
      );
    }
    if (
      application.currentStatus !== ApplicationStatus.PendingOidbVerification &&
      application.currentStatus !== ApplicationStatus.ReturnedForCorrection
    ) {
      throw new ConflictError(
        "INVALID_STATUS",
        `Cannot verify application in status ${application.currentStatus}`,
      );
    }
    const previous = application.currentStatus;
    application.currentStatus = ApplicationStatus.IntakeVerified;
    application.intakeVerifiedBy = actorUserId;
    application.intakeVerifiedAt = new Date().toISOString();
    await this.deps.applications.save(application);
    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.OidbOfficer,
      actionType: "OIDB_VERIFY",
      affectedEntityId: application.applicationId,
      affectedEntityType: "Application",
      previousValue: previous,
      newValue: application.currentStatus,
    });
    this.deps.notifications.send({
      recipientUserId: application.studentId,
      eventType: "OIDB_VERIFIED",
      channel: "EMAIL",
      subject: "Application verified by OIDB",
      body: "Your application has been verified by ÖİDB and will move to YGK review.",
    });
    return application;
  }

  async returnForCorrection(
    applicationId: string,
    actorUserId: string,
    input: ReturnInput,
  ): Promise<Application> {
    if (!input.reasons || input.reasons.length === 0) {
      throw new ValidationError("Invalid/empty reason/slot. At least one reason is required.");
    }
    for (const r of input.reasons) {
      if (!r.slot || !Object.values(DocumentType).includes(r.slot)) {
        throw new ValidationError(`Unknown slot: ${String(r.slot)}`);
      }
      if (!r.reason || r.reason.trim().length === 0) {
        throw new ValidationError("Reason text must be non-empty for every slot.");
      }
    }
    const application = await this.requireApp(applicationId);
    if (
      application.currentStatus !== ApplicationStatus.PendingOidbVerification &&
      application.currentStatus !== ApplicationStatus.ReturnedForCorrection
    ) {
      throw new ConflictError(
        "INVALID_STATUS",
        `Cannot return application in status ${application.currentStatus}`,
      );
    }
    const previous = application.currentStatus;
    application.currentStatus = ApplicationStatus.ReturnedForCorrection;
    application.correctionReasons = input.reasons;
    await this.deps.applications.save(application);
    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.OidbOfficer,
      actionType: "OIDB_RETURN_FOR_CORRECTION",
      affectedEntityId: application.applicationId,
      affectedEntityType: "Application",
      previousValue: previous,
      newValue: { status: application.currentStatus, reasons: input.reasons },
    });
    this.deps.notifications.send({
      recipientUserId: application.studentId,
      eventType: "OIDB_RETURN_FOR_CORRECTION",
      channel: "EMAIL",
      subject: "Application returned for correction",
      body: `Slots requiring action: ${input.reasons.map((r) => r.slot).join(", ")}`,
    });
    return application;
  }

  async reject(
    applicationId: string,
    actorUserId: string,
    input: RejectInput,
  ): Promise<Application> {
    const justification = (input.justification ?? "").trim();
    if (justification.length === 0) {
      throw new ValidationError("Justification is required to reject an application.");
    }
    const application = await this.requireApp(applicationId);
    if (
      application.currentStatus !== ApplicationStatus.PendingOidbVerification &&
      application.currentStatus !== ApplicationStatus.ReturnedForCorrection
    ) {
      throw new ConflictError(
        "INVALID_STATUS",
        `Cannot reject application in status ${application.currentStatus}`,
      );
    }
    const previous = application.currentStatus;
    application.currentStatus = ApplicationStatus.RejectedAtIntake;
    application.rejectionReason = justification;
    await this.deps.applications.save(application);
    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.OidbOfficer,
      actionType: "OIDB_REJECT",
      affectedEntityId: application.applicationId,
      affectedEntityType: "Application",
      previousValue: previous,
      newValue: { status: application.currentStatus, justification },
    });
    this.deps.notifications.send({
      recipientUserId: application.studentId,
      eventType: "OIDB_REJECTED",
      channel: "EMAIL",
      subject: "Application rejected",
      body: `Reason: ${justification}`,
    });
    return application;
  }

  async forward(
    applicationId: string,
    actorUserId: string,
    input: ForwardInput,
  ): Promise<Application> {
    const application = await this.requireApp(applicationId);
    if (application.currentStatus !== ApplicationStatus.IntakeVerified) {
      throw new ConflictError(
        "INVALID_STATUS",
        "Application must be in INTAKE_VERIFIED status before forwarding.",
      );
    }
    const previous = application.currentStatus;
    application.routedToYdyo = !input.ydyoExempt;
    application.ydyoExempt = input.ydyoExempt;
    if (input.ydyoExempt) {
      application.routedToDeansOffice = true;
      application.currentStatus = ApplicationStatus.PendingYgkForwarding;
    } else {
      application.routedToDeansOffice = false;
      application.currentStatus = ApplicationStatus.InReviewYdyo;
    }
    await this.deps.applications.save(application);
    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.OidbOfficer,
      actionType: "OIDB_FORWARD",
      affectedEntityId: application.applicationId,
      affectedEntityType: "Application",
      previousValue: previous,
      newValue: {
        status: application.currentStatus,
        routedToYdyo: application.routedToYdyo,
        ydyoExempt: application.ydyoExempt,
        routedToDeansOffice: application.routedToDeansOffice,
      },
    });
    return application;
  }

  private async requireApp(applicationId: string): Promise<Application> {
    const a = await this.deps.applications.findById(applicationId);
    if (!a) throw new NotFoundError(`Application not found: ${applicationId}`);
    return a;
  }
}
