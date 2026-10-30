import { createHmac, timingSafeEqual } from 'node:crypto';

const DISPLAY_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;
const CAMERA_PREVIEW_TTL_SECONDS = 90;
function sign(value: string): string | undefined {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return undefined;
  return createHmac('sha256', secret).update(`display-media:${value}`).digest('hex');
}
export function createDisplayMediaUrl(filename: string, displayId: string, now = new Date()): string {
  const expires = Math.floor(now.getTime() / 1000) + DISPLAY_LINK_TTL_SECONDS;
  const signature = sign(`${filename}:${displayId}:${expires}`);
  if (!signature) return `/media/${filename}`;
  return `/media/${filename}?displayId=${encodeURIComponent(displayId)}&expires=${expires}&signature=${signature}`;
}
export function verifyDisplayMediaSignature(filename: string, displayId: string, expires: string, supplied: string): boolean {
  if (!/^\d+$/.test(expires) || Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  const expected = sign(`${filename}:${displayId}:${expires}`);
  if (!expected || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}

export function createDisplayCameraPreviewUrl(cameraId: string, displayId: string, now = new Date()): string | undefined {
  const expires = Math.floor(now.getTime() / 1000) + CAMERA_PREVIEW_TTL_SECONDS;
  const signature = sign(`camera-preview:${cameraId}:${displayId}:${expires}`);
  if (!signature) return undefined;
  return `/edge/camera-frames/${encodeURIComponent(cameraId)}/stream?displayId=${encodeURIComponent(displayId)}&expires=${expires}&signature=${signature}`;
}

export function verifyDisplayCameraPreviewSignature(cameraId: string, displayId: string, expires: string, supplied: string): boolean {
  if (!/^\d+$/.test(expires) || Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  const expected = sign(`camera-preview:${cameraId}:${displayId}:${expires}`);
  if (!expected || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
}
