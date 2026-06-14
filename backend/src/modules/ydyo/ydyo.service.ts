import {
  Application,
  ApplicationStatus,
  Document,
  DocumentType,
  LanguageDecision,
  LanguageExamType,
  LanguageProofInfo,
  UserRole,
} from "../../shared/types";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors";
import { IApplicationRepository, IDocumentRepository } from "../../shared/repositories";
import { AuditLogger, NotificationService } from "../../shared/audit";

export interface YdyoServiceDeps {
  applications: IApplicationRepository;
  documents: IDocumentRepository;
  audit: AuditLogger;
  notifications: NotificationService;
}

export interface LanguageRule {
  examType: LanguageExamType;
  minScore: number;
  exemptScore: number;
  validityLabel: string;
}

export const LANGUAGE_RULES: Record<LanguageExamType, LanguageRule> = {
  TOEFL_IBT: { examType: "TOEFL_IBT", minScore: 79, exemptScore: 90, validityLabel: "Sınav tarihinden itibaren 2 yıl" },
  IELTS: { examType: "IELTS", minScore: 6.0, exemptScore: 7.0, validityLabel: "Sınav tarihinden itibaren 2 yıl" },
  YDS: { examType: "YDS", minScore: 70, exemptScore: 85, validityLabel: "Sınav tarihinden itibaren 5 yıl" },
};

export interface LanguageEvaluation {
  meetsMinimum: boolean;
  qualifiesForExemption: boolean;
  suggestedDecision: LanguageDecision;
}

export interface YdyoQueueItem {
  applicationId: string;
  studentFullName: string;
  studentTckn: string;
  targetDepartmentId: string;
  targetFacultyId: string;
  examType: LanguageExamType;
  score: number;
  submittedAt: string;
  decision: LanguageDecision | null;
}

export interface YdyoDetailDto {
  application: Application;
  languageProof: LanguageProofInfo;
  document?: Document;
  rule: LanguageRule;
  evaluation: LanguageEvaluation;
}

export interface DecideInput {
  decision: LanguageDecision;
  notes?: string;
}

const EXAM_TYPES: LanguageExamType[] = ["TOEFL_IBT", "IELTS", "YDS"];

export class YdyoService {
  constructor(private readonly deps: YdyoServiceDeps) {}

  listQueue(): YdyoQueueItem[] {
    return this.deps.applications
      .findAll()
      .filter((a) => a.routedToYdyo === true || a.currentStatus === ApplicationStatus.InReviewYdyo)
      .sort((a, b) => a.applicationId.localeCompare(b.applicationId))
      .map((a) => {
        const proof = this.resolveProof(a);
        return {
          applicationId: a.applicationId,
          studentFullName: a.studentFullName,
          studentTckn: a.studentTckn,
          targetDepartmentId: a.targetDepartmentId,
          targetFacultyId: a.targetFacultyId,
          examType: proof.examType,
          score: proof.score,
          submittedAt: a.submittedAt,
          decision: a.ydyoDecision ?? null,
        };
      });
  }

  detail(applicationId: string): YdyoDetailDto {
    const application = this.requireApp(applicationId);
    const languageProof = this.resolveProof(application);
    if (!application.languageProof) {
      application.languageProof = languageProof;
      this.deps.applications.save(application);
    }
    const document = this.deps.documents
      .findByApplicationId(applicationId)
      .find((d) => d.documentType === DocumentType.LanguageProof);
    const rule = LANGUAGE_RULES[languageProof.examType];
    return {
      application,
      languageProof,
      document,
      rule,
      evaluation: this.evaluate(languageProof),
    };
  }

  decide(applicationId: string, actorUserId: string, input: DecideInput): Application {
    const application = this.requireApp(applicationId);
    if (!application.routedToYdyo && application.currentStatus !== ApplicationStatus.InReviewYdyo) {
      throw new ConflictError(
        "NOT_ROUTED_TO_YDYO",
        "This application is not in the YDYO language-review queue.",
      );
    }
    const decision = input.decision;
    if (!decision || !["SUCCESSFUL", "UNSUCCESSFUL", "EXEMPT"].includes(decision)) {
      throw new ValidationError("A valid decision (SUCCESSFUL, UNSUCCESSFUL, EXEMPT) is required.");
    }
    const notes = (input.notes ?? "").trim();
    if (decision === "UNSUCCESSFUL" && notes.length === 0) {
      throw new ValidationError("Notes are required when marking a language document as unsuccessful/invalid.");
    }

    const previous = application.ydyoDecision ?? null;
    application.ydyoDecision = decision;
    application.ydyoReviewNotes = notes || undefined;
    application.ydyoReviewedBy = actorUserId;
    application.ydyoReviewedAt = new Date().toISOString();
    application.ydyoExempt = decision === "EXEMPT";
    if (!application.languageProof) {
      application.languageProof = this.resolveProof(application);
    }
    application.currentStatus = ApplicationStatus.PendingYgkForwarding;
    application.routedToDeansOffice = true;
    this.deps.applications.save(application);

    this.deps.audit.write({
      actorUserId,
      actorRole: UserRole.YdyoOfficer,
      actionType: "YDYO_LANGUAGE_DECISION",
      affectedEntityId: application.applicationId,
      affectedEntityType: "Application",
      previousValue: previous,
      newValue: { decision, exempt: application.ydyoExempt, status: application.currentStatus },
    });
    this.deps.notifications.send({
      recipientUserId: application.studentId,
      eventType: "YDYO_DECISION",
      channel: "EMAIL",
      subject: "Language proficiency review completed",
      body:
        decision === "EXEMPT"
          ? "Your language proficiency grants an exemption (+5 bonus points)."
          : decision === "SUCCESSFUL"
            ? "Your language proficiency meets the minimum requirement."
            : `Your language document was found unsuccessful/invalid. ${notes}`,
    });
    return application;
  }

  private evaluate(proof: LanguageProofInfo): LanguageEvaluation {
    const rule = LANGUAGE_RULES[proof.examType];
    const meetsMinimum = proof.score >= rule.minScore;
    const qualifiesForExemption = proof.score >= rule.exemptScore;
    const suggestedDecision: LanguageDecision = qualifiesForExemption
      ? "EXEMPT"
      : meetsMinimum
        ? "SUCCESSFUL"
        : "UNSUCCESSFUL";
    return { meetsMinimum, qualifiesForExemption, suggestedDecision };
  }

  private resolveProof(application: Application): LanguageProofInfo {
    if (application.languageProof) return application.languageProof;
    const seed = hashString(application.applicationId);
    const examType = EXAM_TYPES[seed % EXAM_TYPES.length];
    const score = syntheticScore(examType, seed);
    return {
      examType,
      score,
      examDate: "2025-08-15",
      validUntil: examType === "YDS" ? "2030-08-15" : "2027-08-15",
      certificateNumber: `${examType}-${(seed % 90000) + 10000}`,
    };
  }

  private requireApp(applicationId: string): Application {
    const a = this.deps.applications.findById(applicationId);
    if (!a) throw new NotFoundError(`Application not found: ${applicationId}`);
    return a;
  }
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function syntheticScore(examType: LanguageExamType, seed: number): number {
  switch (examType) {
    case "TOEFL_IBT":
      return 70 + (seed % 30);
    case "YDS":
      return 60 + (seed % 35);
    case "IELTS":
    default:
      return Math.round((5.5 + (seed % 35) / 10) * 10) / 10;
  }
}
