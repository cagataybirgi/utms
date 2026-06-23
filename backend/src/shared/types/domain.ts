import {
  ApplicationStatus,
  DocumentType,
  DocumentVerificationBadge,
  MappingStatus,
  PackageStatus,
  RankingCategory,
  UserRole,
} from "./enums";

export interface User {
  userId: string;
  tckn: string;
  fullName: string;
  email: string;
  roles: UserRole[];
  departmentId?: string;
  facultyId?: string;
  // Scenario 1 (Login) — auth fields. In-memory demo only.
  passwordHash?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
}

export interface Department {
  departmentId: string;
  departmentName: string;
  facultyId: string;
}

export interface Faculty {
  facultyId: string;
  facultyName: string;
}

export interface Document {
  documentId: string;
  applicationId: string;
  documentType: DocumentType;
  versions: DocumentVersion[];
}

export interface DocumentVersion {
  versionId: string;
  versionNumber: number;
  standardizedFileName: string;
  storageKey: string;
  uploadedAt: string;
  uploadedBy: string;
  hasBarcode: boolean;
  isCorrupt?: boolean;
}

export interface DeptConditionCheck {
  name: string;
  requirement: string;
  studentValue: string;
  met: boolean;
}

export interface PreScreeningResult {
  isPassed: boolean;
  failedRules: string[];
  apiFlaggedForManualVerification?: boolean;
  conditionChecks?: DeptConditionCheck[];
}

export interface Application {
  applicationId: string;
  studentId: string;
  studentTckn: string;
  studentFullName: string;
  periodId: string;
  targetDepartmentId: string;
  targetFacultyId: string;
  transferType: string;
  targetSemester: 3 | 5;
  submittedGpa: number;
  submittedYksScore?: number;
  yksExamYear?: number;
  language?: string;
  finishedSemester?: number;
  finishedYear?: number;
  currentInstitution?: string;
  currentDepartment?: string;
  currentStatus: ApplicationStatus;
  preScreening: PreScreeningResult;
  correctionReasons: CorrectionReason[];
  rejectionReason?: string;
  intakeVerifiedBy?: string;
  intakeVerifiedAt?: string;
  routedToYdyo: boolean;
  routedToDeansOffice: boolean;
  ydyoExempt: boolean;
  languageProof?: LanguageProofInfo;
  ydyoDecision?: LanguageDecision;
  ydyoReviewNotes?: string;
  ydyoReviewedBy?: string;
  ydyoReviewedAt?: string;
  rankingCategory?: RankingCategory;
  transferScore?: number;
  intibakTableId?: string;
  submittedAt: string;
  lastModifiedAt: string;
}

export type LanguageExamType = "TOEFL_IBT" | "IELTS" | "YDS";

export type LanguageDecision = "SUCCESSFUL" | "UNSUCCESSFUL" | "EXEMPT";

export interface LanguageProofInfo {
  examType: LanguageExamType;
  score: number;
  examDate: string;
  validUntil: string;
  certificateNumber: string;
}

export interface CorrectionReason {
  slot: DocumentType;
  reason: string;
}

export interface DocumentVerificationOutcome {
  documentId: string;
  documentType: DocumentType;
  badge: DocumentVerificationBadge;
  message?: string;
}

export interface DepartmentQuota {
  departmentId: string;
  periodId: string;
  asilQuota: number;
  yedekQuota: number;
}

export interface PreviousCourse {
  code: string;
  name: string;
  letterGrade: string;
  ects: number;
}

export interface TargetCourse {
  code: string;
  name: string;
  ects: number;
}

export interface MappingEntry {
  entryId: string;
  sourceCourseCodes: string[];
  targetCourseCode: string | null;
  status: MappingStatus;
  similarityScore?: number;
}

export interface IntibakTable {
  intibakTableId: string;
  applicationId: string;
  previousCourses: PreviousCourse[];
  targetCurriculum: TargetCourse[];
  mappings: MappingEntry[];
  manualEntryUsed: boolean;
  noSuggestionsFound: boolean;
  isLocked: boolean;
  createdBy: string;
  createdAt: string;
  savedAt?: string;
}

export interface DepartmentCurriculum {
  departmentId: string;
  courses: TargetCourse[];
  isDefined: boolean;
}

export interface EvaluationPackage {
  packageId: string;
  departmentId: string;
  periodId: string;
  status: PackageStatus;
  asilApplicationIds: string[];
  yedekApplicationIds: string[];
  redApplicationIds: string[];
  intibakTableIds: string[];
  digitalSignatureBy?: string;
  digitalSignatureAt?: string;
  sentBy?: string;
  sentAt?: string;
}

export interface AuditLogEntry {
  logId: string;
  actorUserId: string;
  actorRole: UserRole;
  actionType: string;
  affectedEntityId: string;
  affectedEntityType: string;
  previousValue: string | null;
  newValue: string | null;
  occurredAt: string;
  ipAddress?: string;
}

export interface NotificationRecord {
  notificationId: string;
  recipientUserId: string;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
  isDelivered: boolean;
  failureReason?: string;
  createdAt: string;
}
