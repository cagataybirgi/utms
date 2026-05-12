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

export async function createApplication(
  userId: string,
  data: {
    studentTckn: string;
    studentFullName: string;
    targetDepartmentId: string;
    targetSemester: number;
    submittedGpa: number;
    submittedYksScore?: number;
    currentInstitution?: string;
    currentDepartment?: string;
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
