import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { CameraFrameEvent, DeviceHeartbeat, MetricsEvent } from '@biltekmyo/shared-types';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { EdgeDeviceAuthGuard } from './edge-device-auth.guard.js';
import { EdgeRegistryService, type RegisteredAiBox } from './edge-registry.service.js';
import { DisplayService } from './display.service.js';
import { verifyDisplayCameraPreviewSignature } from './media-signing.js';

type EventResponse = {
  setHeader(name: string, value: string): void;
  flushHeaders?: () => void;
  write(chunk: string | Uint8Array): boolean;
  end(): void;
  on(event: 'close', listener: () => void): void;
};

@Controller('edge')
export class EdgeController {
  constructor(private readonly registry: EdgeRegistryService, private readonly displays: DisplayService) {}

  @Get('ai-boxes')
  @UseGuards(AdminAuthGuard)
  listAiBoxes(): Promise<RegisteredAiBox[]> { return this.registry.list(); }

  @Post('ai-boxes')
  @UseGuards(EdgeDeviceAuthGuard)
  registerAiBox(@Body() box: RegisteredAiBox): Promise<RegisteredAiBox> { return this.registry.register(box); }

  @Post('heartbeat')
  @UseGuards(EdgeDeviceAuthGuard)
  heartbeat(@Body() heartbeat: DeviceHeartbeat): Promise<RegisteredAiBox> { return this.registry.heartbeat(heartbeat); }

  @Post('metrics')
  @UseGuards(EdgeDeviceAuthGuard)
  async ingestMetrics(@Body() event: MetricsEvent): Promise<{ accepted: true }> {
    await this.registry.ingestMetrics(event);
    return { accepted: true };
  }

  @Post('camera-frames')
  @UseGuards(EdgeDeviceAuthGuard)
  async ingestCameraFrame(@Body() event: CameraFrameEvent): Promise<{ accepted: true }> {
    await this.registry.ingestCameraFrame(event);
    return { accepted: true };
  }

  @Get('camera-frames/:cameraId/events')
  async cameraFrameEvents(
    @Param('cameraId') cameraId: string,
    @Query('displayId') displayId: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() response: EventResponse,
  ): Promise<void> {
    if (!displayId || !verifyDisplayCameraPreviewSignature(cameraId, displayId, expires, signature) || !await this.displays.exists(displayId)) {
      throw new ForbiddenException('Camera preview link is invalid or expired.');
    }
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store, no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
    let closed = false;
    const sendFrame = (frame: CameraFrameEvent) => { if (!closed) response.write(`data: ${JSON.stringify(frame)}\n\n`); };
    const current = this.registry.latestCameraFrame(cameraId);
    if (current) sendFrame(current);
    const unsubscribe = this.registry.onCameraFrame(cameraId, sendFrame);
    const keepAlive = setInterval(() => { if (!closed) response.write(': keepalive\n\n'); }, 20_000);
    const expiryTimer = setTimeout(() => { cleanup(); response.end(); }, Math.max(0, Number(expires) * 1000 - Date.now()));
    expiryTimer.unref?.();
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(keepAlive);
      clearTimeout(expiryTimer);
      unsubscribe();
    };
    response.on('close', cleanup);
  }

  @Get('camera-frames/:cameraId/stream')
  async cameraFrameStream(
    @Param('cameraId') cameraId: string,
    @Query('displayId') displayId: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() response: EventResponse,
  ): Promise<void> {
    if (!displayId || !verifyDisplayCameraPreviewSignature(cameraId, displayId, expires, signature) || !await this.displays.exists(displayId)) {
      throw new ForbiddenException('Camera preview link is invalid or expired.');
    }
    response.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    response.setHeader('Cache-Control', 'no-store, no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
    let closed = false;
    const sendFrame = (frame: CameraFrameEvent) => {
      if (closed) return;
      const jpeg = Buffer.from(frame.jpegBase64, 'base64');
      response.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.byteLength}\r\n\r\n`);
      response.write(jpeg);
      response.write('\r\n');
    };
    const current = this.registry.latestCameraFrame(cameraId);
    if (current) sendFrame(current);
    const unsubscribe = this.registry.onCameraFrame(cameraId, sendFrame);
    const expiryTimer = setTimeout(() => { cleanup(); response.end(); }, Math.max(0, Number(expires) * 1000 - Date.now()));
    expiryTimer.unref?.();
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearTimeout(expiryTimer);
      unsubscribe();
    };
    response.on('close', cleanup);
  }

  @Get('display-metrics')
  displayMetrics() { return this.registry.displayMetrics(); }

  @Get('display-metrics/events')
  async displayMetricsEvents(
    @Res() response: EventResponse,
  ): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    let closed = false;
    const sendUpdate = async () => {
      if (closed) return;
      try {
        const snapshot = await this.registry.displayMetrics();
        if (!closed) response.write(`data: ${JSON.stringify(snapshot)}\n\n`);
      } catch {
        if (!closed) response.write(': metrics unavailable\n\n');
      }
    };
    await sendUpdate();
    const unsubscribe = this.registry.onMetricsChanged(() => { void sendUpdate(); });
    const keepAlive = setInterval(() => { if (!closed) response.write(': keepalive\n\n'); }, 20_000);
    response.on('close', () => {
      if (closed) return;
      closed = true;
      clearInterval(keepAlive);
      unsubscribe();
    });
  }
}
