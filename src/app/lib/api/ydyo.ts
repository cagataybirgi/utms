// Scenario 3.1 — YDYO language proficiency review. Frontend client for /api/ydyo.

const BASE = '/api/ydyo';

export class YdyoApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'YdyoApiError';
  }
}

function authHeaders(userId: string): HeadersInit {
  return { 'x-mock-user': userId };
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({}));
  throw new YdyoApiError(body.message ?? `HTTP ${res.status}`, res.status, body.error);
}

export type LanguageExamType = 'TOEFL_IBT' | 'IELTS' | 'YDS';
export type LanguageDecision = 'SUCCESSFUL' | 'UNSUCCESSFUL' | 'EXEMPT';

export const EXAM_TYPE_LABELS: Record<LanguageExamType, string> = {
  TOEFL_IBT: 'TOEFL iBT',
  IELTS: 'IELTS Academic',
  YDS: 'YDS',
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

export function departmentLabel(id?: string): string {
  if (!id) return '—';
  return DEPARTMENT_LABELS[id] ?? id;
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

export interface LanguageProofInfo {
  examType: LanguageExamType;
  score: number;
  examDate: string;
  validUntil: string;
  certificateNumber: string;
}

export interface LanguageRule {
  examType: LanguageExamType;
  minScore: number;
  exemptScore: number;
  validityLabel: string;
}

export interface LanguageEvaluation {
  meetsMinimum: boolean;
  qualifiesForExemption: boolean;
  suggestedDecision: LanguageDecision;
}

export interface YdyoApplicationSummary {
  applicationId: string;
  studentFullName: string;
  studentTckn: string;
  targetDepartmentId: string;
  language?: string;
  submittedAt: string;
  ydyoDecision?: LanguageDecision;
  ydyoReviewNotes?: string;
}

export interface YdyoDocumentVersion {
  standardizedFileName: string;
}

export interface YdyoDocument {
  versions: YdyoDocumentVersion[];
}

export interface YdyoDetailDto {
  application: YdyoApplicationSummary;
  languageProof: LanguageProofInfo;
  document?: YdyoDocument;
  rule: LanguageRule;
  evaluation: LanguageEvaluation;
}

export async function fetchYdyoQueue(userId: string): Promise<{ items: YdyoQueueItem[] }> {
  const res = await fetch(`${BASE}/queue`, { headers: authHeaders(userId) });
  return handle(res);
}

export async function fetchYdyoDetail(applicationId: string, userId: string): Promise<YdyoDetailDto> {
  const res = await fetch(`${BASE}/${applicationId}`, { headers: authHeaders(userId) });
  return handle(res);
}

export async function submitYdyoDecision(
  applicationId: string,
  decision: LanguageDecision,
  notes: string,
  userId: string,
): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/${applicationId}/decision`, {
    method: 'POST',
    headers: { ...authHeaders(userId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, notes }),
  });
  return handle(res);
}

export const ydyoApi = {
  queue: fetchYdyoQueue,
  detail: fetchYdyoDetail,
  decide: submitYdyoDecision,
};
