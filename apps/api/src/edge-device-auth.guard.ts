import { createHash, timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
type RequestLike = { headers: { authorization?: string } };

@Injectable()
export class EdgeDeviceAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const expected = process.env.AI_BOX_API_KEY ?? '';
    const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    if (!expected || !supplied) return false;
    const expectedHash = createHash('sha256').update(expected).digest();
    const suppliedHash = createHash('sha256').update(supplied).digest();
    return timingSafeEqual(expectedHash, suppliedHash) && expected.length === supplied.length;
  }
}

