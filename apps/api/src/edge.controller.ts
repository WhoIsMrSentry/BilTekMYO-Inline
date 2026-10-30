import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { DeviceHeartbeat, MetricsEvent } from '@biltekmyo/shared-types';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { EdgeDeviceAuthGuard } from './edge-device-auth.guard.js';
import { EdgeRegistryService, type RegisteredAiBox } from './edge-registry.service.js';

type EventRequest = { on(event: 'close', listener: () => void): void };
type EventResponse = {
  setHeader(name: string, value: string): void;
  flushHeaders?: () => void;
  write(chunk: string): void;
  end(): void;
};

@Controller('edge')
export class EdgeController {
  constructor(private readonly registry: EdgeRegistryService) {}

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

  @Get('display-metrics')
  displayMetrics() { return this.registry.displayMetrics(); }

  @Get('display-metrics/events')
  async displayMetricsEvents(
    @Req() request: EventRequest,
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
    const keepAlive = setInterval(() => response.write(': keepalive\n\n'), 20_000);
    request.on('close', () => {
      closed = true;
      clearInterval(keepAlive);
      unsubscribe();
      response.end();
    });
  }
}
