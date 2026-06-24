// In local dev the Vite proxy routes /api → localhost:3001.
// On Vercel the root vercel.json rewrites /api/* → /api/index (Express serverless).
const BASE = '/api';

function authHeaders(userId: string): HeadersInit {
  return { 'x-mock-user': userId };
}

export interface DocumentVersionDto {
  versionId: string;
  versionNumber: number;
  standardizedFileName: string;
  storageUrl: string;
  uploadedAt: string;
  uploadedBy: string;
  isActive: boolean;
}

export interface DocumentSlotDto {
  documentType: string;
  name: string;
  description: string;
  required: boolean;
  currentStatus: string;
  activeVersion: DocumentVersionDto | null;
  versionCount: number;
  acceptedFormats: string[];
  maxSizeMb: number;
}

export interface ChecklistDto {
  applicationId: string;
  applicationStatus: string;
  slots: DocumentSlotDto[];
  mandatoryCount: number;
  uploadedMandatoryCount: number;
  canSubmit: boolean;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({}));
  throw new Error(body.message ?? `HTTP ${res.status}`);
}

export interface ApplicationSummaryDto {
  applicationId: string;
  targetDepartmentId: string;
  targetFacultyId: string;
  currentStatus: string;
  submittedAt: string;
  lastModifiedAt: string;
  uploadedDocumentCount: number;
}

export async function listApplications(userId: string): Promise<ApplicationSummaryDto[]> {
  const res = await fetch(`${BASE}/applications`, {
    headers: authHeaders(userId),
  });
  return handleResponse(res);
}

export async function createApplication(
  userId: string,
  data: {
    studentTckn: string;
    studentFullName: string;
    targetDepartmentId: string;
    targetFacultyId?: string;
    transferType?: string;
    targetSemester: number;
    submittedGpa: number;
    submittedYksScore?: number;
    yksExamYear?: number;
    currentInstitution?: string;
    currentDepartment?: string;
    isDraft?: boolean;
  },
): Promise<{ applicationId: string }> {
  const res = await fetch(`${BASE}/applications`, {
    method: 'POST',
    headers: { ...authHeaders(userId), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function getChecklist(applicationId: string, userId: string): Promise<ChecklistDto> {
  const res = await fetch(`${BASE}/documents/${applicationId}/checklist`, {
    headers: authHeaders(userId),
  });
  return handleResponse(res);
}

export async function uploadDocument(
  applicationId: string,
  documentType: string,
  file: File,
  userId: string,
): Promise<DocumentSlotDto> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/documents/${applicationId}/upload/${documentType}`, {
    method: 'POST',
    headers: authHeaders(userId),
    body: formData,
  });
  return handleResponse(res);
}

export async function submitApplication(applicationId: string, userId: string): Promise<void> {
  const res = await fetch(`${BASE}/documents/${applicationId}/submit`, {
    method: 'POST',
    headers: authHeaders(userId),
  });
  await handleResponse(res);
}

export interface ActivePeriodDto {
  periodId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export async function getActivePeriod(): Promise<ActivePeriodDto | null> {
  try {
    const res = await fetch(`${BASE}/period/active`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface StageLogDto {
  stageKey: string;
  actorName: string | null;
  actorRole: string | null;
  occurredAt: string;
  notes: string | null;
}

export interface IntibakCourseRowDto {
  sourceCourses: { code: string; name: string; ects: number }[];
  targetCourse: { code: string; name: string; ects: number } | null;
  status: string;
}

export interface IntibakDetailDto {
  isLocked: boolean;
  rows: IntibakCourseRowDto[];
  totalExemptedEcts: number;
}

export interface ApplicationDetailDto {
  applicationId: string;
  studentFullName: string;
  currentStatus: string;
  submittedAt: string;
  lastModifiedAt: string;
  intakeVerifiedAt: string | null;
  intakeVerifiedBy: string | null;
  routedToYdyo: boolean;
  routedToDeansOffice: boolean;
  ydyoExempt: boolean;
  correctionReasons: unknown[];
  rejectionReason: string | null;
  rankingCategory: string | null;
  transferScore: number | null;
  hasIntibak: boolean;
  hasLockedIntibak: boolean;
  intibak: IntibakDetailDto | null;
  stageLogs: StageLogDto[];
  targetDepartmentId: string;
  targetFacultyId: string;
  transferType: string;
  targetedSemester: number | null;
  submittedGpa: number;
  submittedYksScore: number | null;
  yksExamYear: number | null;
  currentInstitution: string | null;
  currentDepartment: string | null;
}

export async function getApplication(applicationId: string, userId: string): Promise<ApplicationDetailDto> {
  const res = await fetch(`${BASE}/applications/${applicationId}`, {
    headers: authHeaders(userId),
  });
  return handleResponse(res);
}

export async function cancelApplication(applicationId: string, userId: string): Promise<void> {
  const res = await fetch(`${BASE}/applications/${applicationId}`, {
    method: 'DELETE',
    headers: authHeaders(userId),
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
}
