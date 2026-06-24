// Shared notification bell — reads the logged-in user's real notifications from
// Neon (via /api/notifications). In dev the Vite proxy routes /api → :3001.

const BASE = '/api/notifications';

function authHeaders(userId: string): HeadersInit {
  return { 'x-mock-user': userId, 'Content-Type': 'application/json' };
}

export interface NotificationDto {
  notificationId: string;
  recipientUserId: string;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDto[];
  unreadCount: number;
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({}));
  throw new Error(body.message ?? `HTTP ${res.status}`);
}

export async function listNotifications(userId: string): Promise<NotificationListResponse> {
  const res = await fetch(BASE, { headers: authHeaders(userId) });
  return handle(res);
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await fetch(`${BASE}/${notificationId}/read`, {
    method: 'POST',
    headers: authHeaders(userId),
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await fetch(`${BASE}/read-all`, {
    method: 'POST',
    headers: authHeaders(userId),
  });
}

// ── View-model helpers for the bell UI ───────────────────────────────────────

export type NotificationTone = 'info' | 'success' | 'warning';

export function toneFor(eventType: string): NotificationTone {
  if (/REJECT|FAIL|RETURN|VIOLATION|WAITLIST/i.test(eventType)) return 'warning';
  if (/ADMIT|APPROVE|PUBLISH|SUCCESS|VERIFIED/i.test(eventType)) return 'success';
  return 'info';
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}
