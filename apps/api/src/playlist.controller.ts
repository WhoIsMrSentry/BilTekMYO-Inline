import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { PlaylistSnapshot } from '@biltekmyo/shared-types';
import { PlaylistService } from './playlist.service.js';
import { ContentService } from './content.service.js';

type EventRequest = { on(event: 'close', listener: () => void): void };
type EventResponse = {
  setHeader(name: string, value: string): void;
  flushHeaders?: () => void;
  write(chunk: string): void;
  end(): void;
};

@Controller('playlists')
export class PlaylistController {
  constructor(private readonly playlists: PlaylistService, private readonly content: ContentService) {}

  @Get(':displayId')
  snapshot(@Param('displayId') displayId: string): Promise<PlaylistSnapshot> {
    return this.playlists.snapshot(displayId);
  }

  @Get(':displayId/events')
  async events(
    @Param('displayId') displayId: string,
    @Req() request: EventRequest,
    @Res() response: EventResponse,
  ): Promise<void> {
    await this.playlists.snapshot(displayId);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    const sendUpdate = () => response.write('data: playlist-updated\n\n');
    sendUpdate();
    const unsubscribe = this.content.onChanged(sendUpdate);
    const keepAlive = setInterval(() => response.write(': keepalive\n\n'), 20_000);
    request.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
      response.end();
    });
  }
}
