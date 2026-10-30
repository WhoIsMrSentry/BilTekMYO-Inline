import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, clearAdminCookie, createAdminCookie, verifyAdminCredentials } from './admin-auth.guard.js';

@Controller('auth')
export class AuthController {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  @Post('login')
  login(
    @Body() body: { username?: string; password?: string },
    @Req() request: { ip?: string },
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ): { authenticated: true } {
    const ip = request.ip ?? 'unknown';
    const now = Date.now();
    const entry = this.attempts.get(ip);
    if (entry && entry.resetAt > now && entry.count >= 10) {
      throw new UnauthorizedException('Çok fazla başarısız giriş. Bir süre sonra tekrar deneyin.');
    }
    if (!verifyAdminCredentials(body?.username ?? '', body?.password ?? '')) {
      if (!entry || entry.resetAt <= now) this.attempts.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
      else entry.count += 1;
      throw new UnauthorizedException('Kullanıcı adı veya parola hatalı.');
    }
    this.attempts.delete(ip);
    const cookie = createAdminCookie();
    if (!cookie) throw new Error('SESSION_SECRET en az 32 karakter olmalı.');
    response.setHeader('Set-Cookie', cookie);
    return { authenticated: true };
  }

  @Get('session')
  @UseGuards(AdminAuthGuard)
  session(): { authenticated: true } {
    return { authenticated: true };
  }

  @Post('logout')
  @UseGuards(AdminAuthGuard)
  logout(@Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }): { authenticated: false } {
    response.setHeader('Set-Cookie', clearAdminCookie());
    return { authenticated: false };
  }
}

