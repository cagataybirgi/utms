// Scenario 7 — Faculty Board Review. Frontend client for the /api/board endpoints.
// Vite proxy routes /api → http://localhost:3001 in dev; vercel.json rewrites in prod.

const BASE = '/api/board';

// ── Backend enum mirrors ─────────────────────────────────────────────────────

export type BoardLifecycleStatus =
  | 'PENDING_BOARD_REVIEW'
  | 'FORWARDED_TO_BOARD'
  | 'APPROVED_BY_BOARD'
  | 'READY_FOR_PUBLICATION'
  | 'REJECTED_BY_BOARD'
  | 'WAITING_FOR_CLARIFICATION_YGK'
  | 'LOCKED_HASH_VIOLATION'
  | 'PUBLISHED';

export type LoopbackTarget = 'oidb' | 'ydyo' | 'ygk' | 'dean';

export type PackageStatus = 'DRAFT' | 'SENT' | 'APPROVED_FACULTY_BOARD' | 'RETURNED';

// ── Backend DTO mirrors ──────────────────────────────────────────────────────

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

export interface DeanSignature {
  token: string;
  signedBy: string;
  issuedAt: string;
  expiresAt: string;
  documentHashAtSignature: string;
  state: 'valid' | 'expired' | 'invalid' | 'not_issued';
}

export interface BoardDecision {
  decidedBy: string;
  decidedAt: string;
  approved: boolean;
  resolutionText: string;
  rejectionReason: string | null;
  loopbackTarget: LoopbackTarget | null;
}

export interface BoardNotificationStub {
  notificationId: string;
  recipientUserId: string;
  subject: string;
  channel: 'EMAIL' | 'DASHBOARD_ALERT';
  status: 'pending' | 'delivered' | 'failed';
  errorCode: string | null;
  decoupled: boolean;
  createdAt: string;
}

export interface BoardReviewState {
  packageId: string;
  lifecycle: BoardLifecycleStatus;
  deanSignature: DeanSignature | null;
  boardDecision: BoardDecision | null;
  hashLocked: boolean;
  hashLockedAt: string | null;
  hashLockReason: string | null;
  clarificationNote: string | null;
  publishedAt: string | null;
  notifications: BoardNotificationStub[];
  createdAt: string;
  lastModifiedAt: string;
}

export interface HashCheckResult {
  packageId: string;
  hashAtSignature: string;
  currentHash: string;
  isMatch: boolean;
  errorCode: '702-HASH' | null;
  locked: boolean;
}

export interface IntibakCompletenessResult {
  packageId: string;
  totalAsil: number;
  missingApplicationIds: string[];
  missingStudentNames: string[];
  isComplete: boolean;
  blockedBy: 'INTIBAK_GATE' | null;
}

export interface BoardQueueItem {
  pkg: EvaluationPackage;
  state: BoardReviewState;
}

export interface BoardQueueResponse {
  items: BoardQueueItem[];
  count: number;
}

export interface BoardPackageDetail {
  pkg: EvaluationPackage;
  state: BoardReviewState;
  hashCheck: HashCheckResult;
}

export interface BoardDecisionResult {
  packageId: string;
  approved: boolean;
  newLifecycle: BoardLifecycleStatus;
  notifications: BoardNotificationStub[];
  rejectionDispatch: { loopbackTarget: LoopbackTarget; deanNotified: boolean } | null;
}

export interface ConfirmForPublicationResult {
  packageId: string;
  newLifecycle: BoardLifecycleStatus;
  confirmedAt: string;
  message: string;
}

export interface ReturnForClarificationResult {
  packageId: string;
  newLifecycle: BoardLifecycleStatus;
  note: string;
  returnedAt: string;
  notifications: BoardNotificationStub[];
}

export interface PublishResult {
  packageId: string;
  published: boolean;
  publishedAt: string;
  notifications: BoardNotificationStub[];
  hasNotifyErrors: boolean;
  notifyErrorCode: '571-NOTIFY' | null;
  message: string;
}

// ── Error class ──────────────────────────────────────────────────────────────

export class BoardApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

// ── HTTP plumbing ────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const raw = localStorage.getItem('currentUser');
  const userId = raw ? JSON.parse(raw).id : 'user-admin';
  return { 'Content-Type': 'application/json', 'x-mock-user': userId };
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new BoardApiError(
      data.message ?? `HTTP ${res.status}`,
      res.status,
      data.error,
      data.details,
    );
  }
  return data as T;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export function listQueue(): Promise<BoardQueueResponse> {
  return call<BoardQueueResponse>('GET', '/packages');
}

export function getDetail(packageId: string): Promise<BoardPackageDetail> {
  return call<BoardPackageDetail>('GET', `/packages/${packageId}`);
}

export function intibakCheck(packageId: string): Promise<IntibakCompletenessResult> {
  return call<IntibakCompletenessResult>('GET', `/packages/${packageId}/intibak-check`);
}

export function hashCheck(packageId: string): Promise<HashCheckResult> {
  return call<HashCheckResult>('GET', `/packages/${packageId}/hash-check`);
}

export function approveDecision(
  packageId: string,
  resolutionText: string,
): Promise<BoardDecisionResult> {
  return call<BoardDecisionResult>('POST', `/packages/${packageId}/board-decision`, {
    resolutionText,
    approved: true,
  });
}

export function rejectDecision(
  packageId: string,
  resolutionText: string,
  rejectionReason: string,
  loopbackTarget: LoopbackTarget = 'ygk',
): Promise<BoardDecisionResult> {
  return call<BoardDecisionResult>('POST', `/packages/${packageId}/board-decision`, {
    resolutionText,
    approved: false,
    rejectionReason,
    loopbackTarget,
  });
}

export function confirmForPublication(
  packageId: string,
): Promise<ConfirmForPublicationResult> {
  return call<ConfirmForPublicationResult>(
    'POST',
    `/packages/${packageId}/confirm-for-publication`,
    {},
  );
}

export function publish(packageId: string): Promise<PublishResult> {
  return call<PublishResult>('POST', `/packages/${packageId}/publish`, {});
}

export function returnToYgk(
  packageId: string,
  note: string,
): Promise<ReturnForClarificationResult> {
  return call<ReturnForClarificationResult>('POST', `/packages/${packageId}/return-to-ygk`, {
    note,
  });
}

// ── UI helpers ───────────────────────────────────────────────────────────────

/** Display-only labels mirroring the seed data used by intibak.ts. */
export const DEPARTMENT_LABELS: Record<string, string> = {
  'dept-computer-engineering': 'Bilgisayar Mühendisliği',
  'dept-electrical-engineering': 'Elektrik-Elektronik Mühendisliği',
  'dept-mechanical-engineering': 'Makine Mühendisliği',
  'dept-architecture': 'Mimarlık',
};

export const PERIOD_LABELS: Record<string, string> = {
  'period-spring-2026': 'Bahar 2025-2026',
  'period-ygk-scenarios-2026': 'YGK Senaryoları 2026',
};

export interface LifecycleDisplay {
  label: string;
  group: 'pending' | 'approved' | 'rejected' | 'locked';
}

export function lifecycleDisplay(lifecycle: BoardLifecycleStatus): LifecycleDisplay {
  switch (lifecycle) {
    case 'PENDING_BOARD_REVIEW':
      return { label: 'Dekan İmzası Bekliyor', group: 'pending' };
    case 'FORWARDED_TO_BOARD':
      return { label: 'Kurul İncelemesi Bekliyor', group: 'pending' };
    case 'APPROVED_BY_BOARD':
      return { label: 'Onaylandı (Yayın Onayı Bekliyor)', group: 'approved' };
    case 'READY_FOR_PUBLICATION':
      return { label: 'Yayına Hazır (ÖİDB)', group: 'approved' };
    case 'PUBLISHED':
      return { label: 'Yayınlandı', group: 'approved' };
    case 'REJECTED_BY_BOARD':
      return { label: 'Reddedildi', group: 'rejected' };
    case 'WAITING_FOR_CLARIFICATION_YGK':
      return { label: "Açıklama Bekliyor (YGK'da)", group: 'rejected' };
    case 'LOCKED_HASH_VIOLATION':
      return { label: 'Bütünlük İhlali (Kilitli)', group: 'locked' };
    default:
      return { label: lifecycle, group: 'pending' };
  }
}
