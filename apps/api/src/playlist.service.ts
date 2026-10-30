import { Injectable, NotFoundException } from '@nestjs/common';
import type { PlaylistSnapshot } from '@biltekmyo/shared-types';
import { PlaylistScheduler } from '@biltekmyo/scheduler';
import { ContentService } from './content.service.js';
import { DisplayService } from './display.service.js';
import { createDisplayMediaUrl } from './media-signing.js';

@Injectable()
export class PlaylistService {
  private readonly scheduler = new PlaylistScheduler();
  constructor(private readonly content: ContentService, private readonly displays: DisplayService) {}

  async snapshot(displayId: string, now = new Date()): Promise<PlaylistSnapshot> {
    if (!await this.displays.exists(displayId)) throw new NotFoundException(`Unknown display: ${displayId}`);
    const snapshot = this.scheduler.createSnapshot(displayId, await this.content.list(), { now });
    return {
      ...snapshot,
      items: snapshot.items.map((item) => {
        const attachment = item.payload.attachmentUrl;
        const match = attachment?.match(/^\/media\/([a-f0-9-]{36}\.(?:pdf|png|jpg|jpeg|webp|mp4))$/);
        if (!match?.[1]) return item;
        return { ...item, payload: { ...item.payload, attachmentUrl: createDisplayMediaUrl(match[1], displayId, now) } };
      }),
    };
  }
}
