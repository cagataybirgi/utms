const BASE = '/api';

function authHeaders(userId: string): HeadersInit {
  return { 'x-mock-user': userId, 'Content-Type': 'application/json' };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({}));
  throw new Error(body.message ?? `HTTP ${res.status}`);
}

export interface ProfileDto {
  userId: string;
  fullName: string;
  email: string;
  tckn: string;
  phoneNum: string[];
  roles: string[];
  departmentId: string | null;
  facultyId: string | null;
}

export async function getProfile(userId: string): Promise<ProfileDto> {
  const res = await fetch(`${BASE}/profile`, { headers: authHeaders(userId) });
  return handleResponse(res);
}

export async function updateProfile(
  userId: string,
  data: { fullName?: string; email?: string; phoneNum?: string[] },
): Promise<ProfileDto> {
  const res = await fetch(`${BASE}/profile`, {
    method: 'PATCH',
    headers: authHeaders(userId),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch(`${BASE}/profile/change-password`, {
    method: 'POST',
    headers: authHeaders(userId),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await handleResponse(res);
}
