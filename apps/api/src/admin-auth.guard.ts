import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
type RequestLike = { headers: { cookie?: string; origin?: string }; method: string };

export const ADMIN_COOKIE = 'biltekmyo_admin';
const SESSION_SECONDS = 8 * 60 * 60;

function equalSecret(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash) && left.length === right.length;
}

function signature(payload: string): string | undefined {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return undefined;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function createAdminCookie(): string | undefined {
  const payload = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const mac = signature(payload);
  if (!mac) return undefined;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ADMIN_COOKIE}=${payload}.${mac}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function hasValidAdminCookie(request: RequestLike): boolean {
  const raw = request.headers.cookie ?? '';
  const token = raw.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  if (!token) return false;
  const [expires, supplied] = token.split('.');
  if (!expires || !supplied || !/^\d+$/.test(expires)) return false;
  if (Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  const expected = signature(expires);
  return Boolean(expected && equalSecret(supplied, expected));
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    if (!hasValidAdminCookie(request)) return false;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      const allowed = (process.env.ADMIN_PANEL_ORIGIN ?? 'http://localhost:3001')
        .split(',').map((value) => value.trim()).filter(Boolean);
      if (!origin || !allowed.includes(origin)) return false;
    }
    return true;
  }
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME ?? '';
  const expectedPassword = process.env.ADMIN_PASSWORD ?? '';
  if (!expectedUser || !expectedPassword) return false;
  return equalSecret(username, expectedUser) && equalSecret(password, expectedPassword);
}

export function clearAdminCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ADMIN_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}


