/**
 * Board-side types — kept separate from `shared/types/domain.ts` so that the
 * YGK's EvaluationPackage object remains untouched.  BoardReviewState lives
 * alongside EvaluationPackage and references it by packageId.
 *
 * One BoardReviewState <-> one EvaluationPackage (1:1).
 */

// ─── Sub-codes used by the routes / frontend ────────────────────────────────

export type SignatureTokenState = "valid" | "expired" | "invalid" | "not_issued";

export type LoopbackTarget = "oidb" | "ydyo" | "ygk" | "dean";

export type BoardLifecycleStatus =
  | "PENDING_BOARD_REVIEW"
  | "FORWARDED_TO_BOARD"
  | "APPROVED_BY_BOARD"
  | "READY_FOR_PUBLICATION"
  | "REJECTED_BY_BOARD"
  | "WAITING_FOR_CLARIFICATION_YGK"
  | "LOCKED_HASH_VIOLATION"
  | "PUBLISHED";

// ─── Dean's signature on the package handoff to the Faculty Board ───────────

export interface DeanSignature {
  /** Token format: SIG-{INITIALS}-{YYYYMMDD}-{SEQUENCE} */
  token: string;
  signedBy: string;             // Dean userId
  issuedAt: string;             // ISO timestamp
  expiresAt: string;            // issuedAt + 24h
  documentHashAtSignature: string;
  state: SignatureTokenState;
}

// ─── Faculty Board's resolution ─────────────────────────────────────────────

export interface BoardDecision {
  decidedBy: string;            // Board member userId
  decidedAt: string;
  approved: boolean;
  resolutionText: string;
  rejectionReason: string | null;
  loopbackTarget: LoopbackTarget | null;
}

// ─── Notification record specifically attached to a board action ────────────
//   Wraps shared NotificationRecord IDs so the Board UI can show delivery state
//   without re-querying the notifications repository.

export interface BoardNotificationStub {
  notificationId: string;
  recipientUserId: string;
  subject: string;
  channel: "EMAIL" | "DASHBOARD_ALERT";
  status: "pending" | "delivered" | "failed";
  errorCode: string | null;     // e.g. '571-NOTIFY'
  decoupled: boolean;
  createdAt: string;
}

// ─── The Board's view of a package — separate entity from EvaluationPackage ─

export interface BoardReviewState {
  packageId: string;            // FK -> EvaluationPackage.packageId
  lifecycle: BoardLifecycleStatus;
  deanSignature: DeanSignature | null;
  boardDecision: BoardDecision | null;
  hashLocked: boolean;          // true when 702-HASH check has failed
  hashLockedAt: string | null;
  hashLockReason: string | null;
  // TC-7B — note written by the Dean's office when returning to YGK because
  // an intibak table is missing.  Cleared on YGK re-send.
  clarificationNote: string | null;
  publishedAt: string | null;
  notifications: BoardNotificationStub[];
  createdAt: string;
  lastModifiedAt: string;
}

// ─── Repository interface — mirrors the existing IApplicationRepository etc. ─

export interface IBoardReviewStateRepository {
  findById(packageId: string): BoardReviewState | undefined;
  findAll(): BoardReviewState[];
  save(state: BoardReviewState): BoardReviewState;
  put(state: BoardReviewState): void;
}

// ─── Request / Response DTOs used by the controller ─────────────────────────

// TC-7B / TC-7D — gate fires at YGK send, Dean signature, and Board approve.
export interface IntibakCompletenessResult {
  packageId: string;
  totalAsil: number;
  missingApplicationIds: string[];
  missingStudentNames: string[];
  isComplete: boolean;
  blockedBy: "INTIBAK_GATE" | null;
}

// TC-7B — Dean returns the package to YGK with a clarification note.
export interface ReturnForClarificationInput {
  packageId: string;
  requestedBy: string;
  note: string;
}

export interface ReturnForClarificationResult {
  packageId: string;
  newLifecycle: BoardLifecycleStatus;
  note: string;
  returnedAt: string;
  notifications: BoardNotificationStub[];
}

// TC-7A Step 4 — Board confirms approved results for publication (ÖİDB handoff).
export interface ConfirmForPublicationInput {
  packageId: string;
  confirmedBy: string;
}

export interface ConfirmForPublicationResult {
  packageId: string;
  newLifecycle: BoardLifecycleStatus;
  confirmedAt: string;
  message: string;
}

// TC-702-HASH
export interface HashCheckResult {
  packageId: string;
  hashAtSignature: string;
  currentHash: string;
  isMatch: boolean;
  errorCode: "702-HASH" | null;
  locked: boolean;
}

// TC-7C
export interface SignatureIssueResult {
  token: string;
  validForHours: number;
  signatoryId: string;
  issuedAt: string;
}

export interface SignatureVerifyInput {
  packageId: string;
  token: string;
  signatoryId: string;
}

export interface SignatureVerifyResult {
  packageId: string;
  token: string;
  state: SignatureTokenState;
  errorCode: "7C-EXPIRED" | "7C-INVALID" | null;
  message: string;
  clearedAt: string | null;
}

// TC-7A / 7E
export interface BoardDecisionInput {
  packageId: string;
  decidedBy: string;
  resolutionText: string;
  approved: boolean;
  rejectionReason?: string;
  loopbackTarget?: LoopbackTarget;
}

export interface StatePropagationEvent {
  target: string;
  previousValue: string;
  newValue: string;
  propagatedAt: string;
}

export interface BoardDecisionResult {
  packageId: string;
  approved: boolean;
  newLifecycle: BoardLifecycleStatus;
  statePropagation: StatePropagationEvent[];
  notifications: BoardNotificationStub[];
  rejectionDispatch: {
    loopbackTarget: LoopbackTarget;
    deanNotified: boolean;
  } | null;
}

// TC-571-NOTIFY
export interface PublishInput {
  packageId: string;
  publishedBy: string;
}

export interface PublishResult {
  packageId: string;
  published: boolean;
  publishedAt: string;
  notifications: BoardNotificationStub[];
  hasNotifyErrors: boolean;
  notifyErrorCode: "571-NOTIFY" | null;
  message: string;
}
