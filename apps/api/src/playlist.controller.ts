import { Controller, Get, Param, Res } from '@nestjs/common';
import type { PlaylistSnapshot } from '@biltekmyo/shared-types';
import { PlaylistService } from './playlist.service.js';
import { ContentService } from './content.service.js';

type EventResponse = {
  setHeader(name: string, value: string): void;
  flushHeaders?: () => void;
  write(chunk: string): void;
  end(): void;
  on(event: 'close', listener: () => void): void;
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
    @Res() response: EventResponse,
  ): Promise<void> {
    await this.playlists.snapshot(displayId);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    let closed = false;
    const sendUpdate = () => { if (!closed) response.write('data: playlist-updated\n\n'); };
    sendUpdate();
    const unsubscribe = this.content.onChanged(sendUpdate);
    const keepAlive = setInterval(() => { if (!closed) response.write(': keepalive\n\n'); }, 20_000);
    response.on('close', () => {
      if (closed) return;
      closed = true;
      clearInterval(keepAlive);
      unsubscribe();
    });
  }
}
