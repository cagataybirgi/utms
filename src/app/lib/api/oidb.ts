// Scenario 4 — ÖİDB intake verification & routing. Frontend client for /api/oidb.

const BASE = '/api/oidb';

export class OidbApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'OidbApiError';
  }
}

function authHeaders(userId: string): HeadersInit {
  return { 'x-mock-user': userId };
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({}));
  throw new OidbApiError(body.message ?? `HTTP ${res.status}`, res.status, body.error);
}

export type DocumentSlot =
  | 'TRANSCRIPT'
  | 'YKS_RESULT'
  | 'STUDENT_CERTIFICATE'
  | 'LANGUAGE_PROOF'
  | 'CURRICULUM'
  | 'COURSE_CONTENTS'
  | 'PORTFOLIO';

export const DOCUMENT_SLOT_LABELS: Record<DocumentSlot, string> = {
  TRANSCRIPT: 'Transkript',
  YKS_RESULT: 'YKS Sonuç Belgesi',
  STUDENT_CERTIFICATE: 'Öğrenci Belgesi',
  LANGUAGE_PROOF: 'Dil Yeterlilik Belgesi',
  CURRICULUM: 'Müfredat',
  COURSE_CONTENTS: 'Ders İçerikleri',
  PORTFOLIO: 'Portfolyo',
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING_OIDB_VERIFICATION: 'Onay Bekliyor',
  RETURNED_FOR_CORRECTION: 'Düzeltme İçin İade Edildi',
  INTAKE_VERIFIED: 'Onaylandı',
  IN_REVIEW_YDYO: 'YDYO İncelemesinde',
  PENDING_YGK_FORWARDING: 'YGK İletimi Bekliyor',
  REJECTED_AT_INTAKE: 'Reddedildi',
};

export const DEPARTMENT_LABELS: Record<string, string> = {
  'dept-computer-engineering': 'Bilgisayar Mühendisliği',
  'dept-electrical-engineering': 'Elektrik-Elektronik Mühendisliği',
  'dept-mechanical-engineering': 'Makine Mühendisliği',
  'dept-industrial-engineering': 'Endüstri Mühendisliği',
  'dept-civil-engineering': 'İnşaat Mühendisliği',
  'dept-civil': 'İnşaat Mühendisliği',
  'dept-architecture': 'Mimarlık',
};

export const FACULTY_LABELS: Record<string, string> = {
  'faculty-engineering': 'Mühendislik Fakültesi',
  'faculty-architecture': 'Mimarlık Fakültesi',
};

export function departmentLabel(id?: string): string {
  if (!id) return '—';
  return DEPARTMENT_LABELS[id] ?? id;
}

export function facultyLabel(id?: string): string {
  if (!id) return '—';
  return FACULTY_LABELS[id] ?? id;
}

export function maskTckn(tckn?: string): string {
  if (!tckn || tckn.length < 9) return tckn ?? '—';
  return `${tckn.substring(0, 3)}*****${tckn.substring(8)}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export interface OidbApplication {
  applicationId: string;
  studentId: string;
  studentFullName: string;
  studentTckn: string;
  targetDepartmentId: string;
  targetFacultyId: string;
  targetSemester: number;
  submittedGpa: number;
  submittedYksScore?: number;
  yksExamYear?: number;
  language?: string;
  currentInstitution?: string;
  currentDepartment?: string;
  currentStatus: string;
  submittedAt: string;
  rejectionReason?: string;
  correctionReasons?: CorrectionReason[];
  ydyoExempt: boolean;
}

export interface CorrectionReason {
  slot: DocumentSlot;
  reason: string;
}

export interface OidbDocumentVersion {
  versionId: string;
  versionNumber: number;
  standardizedFileName: string;
  storageKey: string;
  uploadedAt: string;
  uploadedBy: string;
  hasBarcode: boolean;
  isCorrupt?: boolean;
}

export interface OidbDocument {
  documentId: string;
  applicationId: string;
  documentType: DocumentSlot;
  versions: OidbDocumentVersion[];
}

export interface DocumentVerification {
  documentId: string;
  documentType: DocumentSlot;
  badge: string;
  message?: string;
}

export interface OidbApplicationDetail {
  application: OidbApplication;
  documents: OidbDocument[];
  verifications: DocumentVerification[];
}

export async function fetchOidbQueue(userId: string): Promise<{ items: OidbApplication[]; count: number }> {
  const res = await fetch(`${BASE}/applications`, { headers: authHeaders(userId) });
  return handle(res);
}

export async function fetchOidbDetail(
  applicationId: string,
  userId: string,
): Promise<OidbApplicationDetail> {
  const res = await fetch(`${BASE}/applications/${applicationId}`, { headers: authHeaders(userId) });
  return handle(res);
}

/**
 * Fetches the actual uploaded file for one document slot. The backend proxies
 * the private blob, so the body comes back as a Blob we can preview via an
 * object URL. Auth travels in the x-mock-user header, which is why this can't be
 * a plain <iframe src>.
 */
export async function fetchOidbDocumentFile(
  applicationId: string,
  documentType: DocumentSlot,
  userId: string,
): Promise<Blob> {
  const res = await fetch(
    `${BASE}/applications/${applicationId}/documents/${documentType}/file`,
    { headers: authHeaders(userId) },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new OidbApiError(body.message ?? `HTTP ${res.status}`, res.status, body.error);
  }
  return res.blob();
}

export async function verifyApplication(
  applicationId: string,
  userId: string,
): Promise<{ application: OidbApplication; message: string }> {
  const res = await fetch(`${BASE}/applications/${applicationId}/verify`, {
    method: 'POST',
    headers: { ...authHeaders(userId), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return handle(res);
}

export async function returnForCorrection(
  applicationId: string,
  reasons: CorrectionReason[],
  userId: string,
): Promise<{ application: OidbApplication; message: string }> {
  const res = await fetch(`${BASE}/applications/${applicationId}/return`, {
    method: 'POST',
    headers: { ...authHeaders(userId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reasons }),
  });
  return handle(res);
}

export async function rejectApplication(
  applicationId: string,
  justification: string,
  userId: string,
): Promise<{ application: OidbApplication; message: string }> {
  const res = await fetch(`${BASE}/applications/${applicationId}/reject`, {
    method: 'POST',
    headers: { ...authHeaders(userId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ justification }),
  });
  return handle(res);
}

export async function forwardApplication(
  applicationId: string,
  ydyoExempt: boolean,
  userId: string,
): Promise<{ application: OidbApplication; message: string }> {
  const res = await fetch(`${BASE}/applications/${applicationId}/forward`, {
    method: 'POST',
    headers: { ...authHeaders(userId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ydyoExempt }),
  });
  return handle(res);
}

export const oidbApi = {
  queue: fetchOidbQueue,
  detail: fetchOidbDetail,
  documentFile: fetchOidbDocumentFile,
  verify: verifyApplication,
  returnForCorrection,
  reject: rejectApplication,
  forward: forwardApplication,
};
