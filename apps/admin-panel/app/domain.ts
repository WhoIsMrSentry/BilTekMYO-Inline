import type { IconName } from './icons';

export type Display = { id: string; name: string; location: string; enabled: boolean };
export type AiBox = { id: string; name: string; cameraIds: [string, string]; lastHeartbeatAt?: string; lastMetricsAt?: string };
export type ContentType = 'announcement' | 'image' | 'video' | 'school-info' | 'metrics' | 'emergency' | 'camera-stream';
export type Content = {
  id: string; type: ContentType;
  title: string; payload: Record<string, string>; durationSeconds: number; priority: number;
  schedule: { displayIds: string[]; startsAt: string; endsAt: string; daysOfWeek?: number[] };
};
export type Section = 'overview' | 'displays' | 'content' | 'schedule' | 'devices' | 'analytics';
export type ContentStatus = 'live' | 'scheduled' | 'ended';

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
export const playerUrl = process.env.NEXT_PUBLIC_PLAYER_URL ?? 'http://localhost:3002';
export const maxUploadBytes = 40 * 1024 * 1024;

export const weekdays = [{ value: 1, label: 'Pzt' }, { value: 2, label: 'Sal' }, { value: 3, label: 'Çar' }, { value: 4, label: 'Per' }, { value: 5, label: 'Cum' }, { value: 6, label: 'Cmt' }, { value: 0, label: 'Paz' }];
export const sections: { id: Section; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Genel Bakış', icon: 'home' }, { id: 'displays', label: 'Ekranlar', icon: 'monitor' },
  { id: 'content', label: 'İçerikler', icon: 'layers' }, { id: 'schedule', label: 'Yayın Planı', icon: 'calendar' },
  { id: 'devices', label: 'Cihazlar', icon: 'cpu' }, { id: 'analytics', label: 'Analitik', icon: 'chart' },
];
export const typeMeta: Record<ContentType, { label: string; hint: string; icon: IconName }> = {
  announcement: { label: 'Duyuru', hint: 'Metin odaklı bilgilendirme', icon: 'megaphone' },
  'school-info': { label: 'Okul bilgisi', hint: 'Takvim, ders, etkinlik', icon: 'school' },
  image: { label: 'Görsel', hint: 'Afiş veya fotoğraf', icon: 'image' },
  video: { label: 'Video', hint: 'MP4 ya da canlı yayın', icon: 'video' },
  emergency: { label: 'Acil duyuru', hint: 'Diğer yayınları durdurur', icon: 'alert' },
  metrics: { label: 'Metrik', hint: 'Canlı sayaç ekranı', icon: 'chart' },
  'camera-stream': { label: 'Kamera yayını', hint: 'İşlenmiş görüntüyü tam ekrana alır', icon: 'camera' },
};
export const statusMeta: Record<ContentStatus, string> = { live: 'Yayında', scheduled: 'Planlı', ended: 'Bitti' };

export class UnauthorizedError extends Error {}

export async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { ...init, credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    const message = body?.message ?? `İstek başarısız (${response.status})`;
    // The admin guard answers an expired session with 403.
    throw response.status === 401 || response.status === 403 ? new UnauthorizedError(message) : new Error(message);
  }
  return response;
}
export const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export function localDateTimeValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Mirrors PlaylistScheduler.isActive so the panel reports what the screens actually show. */
export function isOnAir(item: Content, now: number): boolean {
  const { startsAt, endsAt, daysOfWeek } = item.schedule;
  if (now < Date.parse(startsAt) || now >= Date.parse(endsAt)) return false;
  return !daysOfWeek?.length || daysOfWeek.includes(new Date(now).getUTCDay());
}
export function contentStatus(item: Content, now: number): ContentStatus {
  if (isOnAir(item, now)) return 'live';
  return now >= Date.parse(item.schedule.endsAt) ? 'ended' : 'scheduled';
}
/** The active rotation of one display; an active emergency replaces everything else. */
export function nowPlaying(contents: Content[], displayId: string, now: number): Content[] {
  const active = contents.filter((item) => item.schedule.displayIds.includes(displayId) && isOnAir(item, now));
  const emergency = active.filter((item) => item.type === 'emergency');
  return [...(emergency.length ? emergency : active)].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

export function heartbeatState(box: AiBox, now: number): { tone: 'live' | 'warn' | 'off'; label: string } {
  if (!box.lastHeartbeatAt) return { tone: 'off', label: 'Sinyal alınmadı' };
  const age = now - Date.parse(box.lastHeartbeatAt);
  if (age <= 2 * 60_000) return { tone: 'live', label: 'Çevrimiçi' };
  return age <= 10 * 60_000 ? { tone: 'warn', label: 'Gecikmeli' } : { tone: 'off', label: 'Çevrimdışı' };
}

export const formatTime = (value: string | number) => new Date(value).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
export const formatClock = (value: string | number) => new Date(value).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const formatDay = (value: string | number) => new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
export const formatDateTime = (value: string | number) => `${formatDay(value)} ${formatTime(value)}`;

export function formatRelative(value: string | number, now: number): string {
  const minutes = Math.round((new Date(value).getTime() - now) / 60_000);
  const size = Math.abs(minutes);
  const amount = size < 1 ? 'az' : size < 60 ? `${size} dk` : size < 1440 ? `${Math.round(size / 60)} sa` : `${Math.round(size / 1440)} gün`;
  if (size < 1) return 'şimdi';
  return minutes > 0 ? `${amount} sonra` : `${amount} önce`;
}
export function formatDays(days?: number[]): string {
  if (!days?.length || days.length === 7) return 'Her gün';
  const set = new Set(days);
  if (set.size === 5 && [1, 2, 3, 4, 5].every((day) => set.has(day))) return 'Hafta içi';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Hafta sonu';
  return weekdays.filter((day) => set.has(day.value)).map((day) => day.label).join(', ');
}
export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase('tr-TR').trim();
}
export function greeting(hour: number): string {
  if (hour < 6) return 'İyi geceler';
  if (hour < 12) return 'Günaydın';
  return hour < 18 ? 'İyi günler' : 'İyi akşamlar';
}
