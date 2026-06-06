// Scenario 6 — Intibak Preparation. Frontend client for the /api/ygk endpoints.
// In local dev the Vite proxy routes /api → backend (localhost:3001).

const BASE = '/api/ygk';

// ── Backend enum mirrors (string values must match src/shared/types/enums.ts) ──
export type MappingStatus =
  | 'SUGGESTED_MATCH'
  | 'APPROVED'
  | 'MANUAL_OVERRIDE'
  | 'NOT_EXEMPT'
  | 'NO_PREVIOUS_EQUIVALENT'
  | 'PENDING_REVIEW';

export type RankingCategory = 'ASIL' | 'YEDEK' | 'RED';

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

export interface IntibakDto {
  applicationId: string;
  previousCourses: PreviousCourse[];
  targetCurriculum: TargetCourse[];
  mappings: MappingEntry[];
  manualEntryRequired: boolean;
  noSuggestionsFound: boolean;
}

export interface IntibakCandidate {
  applicationId: string;
  studentFullName: string;
  studentTckn: string;
  rankingCategory: RankingCategory | null;
  currentStatus: string;
  intibakStarted: boolean;
  intibakCompleted: boolean;
}

export interface CandidatesDto {
  departmentId: string;
  periodId: string;
  candidates: IntibakCandidate[];
  asilTotal: number;
  asilCompleted: number;
  ready: boolean;
}

export interface MappingMutation {
  entryId?: string;
  sourceCourseCodes: string[];
  targetCourseCode: string | null;
  status: MappingStatus;
}

export class IntibakApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: any,
  ) {
    super(message);
  }
}

function authHeaders(): Record<string, string> {
  const raw = localStorage.getItem('currentUser');
  const userId = raw ? JSON.parse(raw).id : 'user-ygk-cmpe-1';
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
    throw new IntibakApiError(
      data.message ?? `HTTP ${res.status}`,
      res.status,
      data.error,
      data.details,
    );
  }
  return data as T;
}

// ── Queue / overview ──────────────────────────────────────────────────────────
export function getCandidates(departmentId: string, periodId: string): Promise<CandidatesDto> {
  const q = new URLSearchParams({ departmentId, periodId }).toString();
  return call<CandidatesDto>('GET', `/intibak/candidates?${q}`);
}

// ── Single-application intibak flow ─────────────────────────────────────────────
export function prepare(applicationId: string): Promise<IntibakDto> {
  return call<IntibakDto>('POST', `/intibak/${applicationId}/prepare`);
}

export function updateMappings(applicationId: string, mutations: MappingMutation[]): Promise<IntibakDto> {
  return call<IntibakDto>('PATCH', `/intibak/${applicationId}/mappings`, { mutations });
}

export function markNotExempt(applicationId: string, sourceCourseCodes: string[]): Promise<IntibakDto> {
  return call<IntibakDto>('POST', `/intibak/${applicationId}/not-exempt`, { sourceCourseCodes });
}

export function addManualCourse(
  applicationId: string,
  course: { code: string; name: string; letterGrade: string; ects: number },
): Promise<IntibakDto> {
  return call<IntibakDto>('POST', `/intibak/${applicationId}/courses`, course);
}

export function regenerateSuggestions(applicationId: string): Promise<IntibakDto> {
  return call<IntibakDto>('POST', `/intibak/${applicationId}/regenerate-suggestions`);
}

export function save(applicationId: string): Promise<{ message: string; table: unknown }> {
  return call('POST', `/intibak/${applicationId}/save`);
}

export function sendPackage(input: {
  signaturePassword: string;
  departmentId: string;
  periodId: string;
}): Promise<{ message: string; package: unknown }> {
  return call('POST', `/package/send`, input);
}

// ── Demo department/period options (seed data) ─────────────────────────────────
export const DEPARTMENTS = [
  { id: 'dept-computer-engineering', label: 'Bilgisayar Mühendisliği' },
  { id: 'dept-electrical-engineering', label: 'Elektrik-Elektronik Müh. (müfredat tanımsız)' },
];
export const DEFAULT_PERIOD = 'period-spring-2026';
