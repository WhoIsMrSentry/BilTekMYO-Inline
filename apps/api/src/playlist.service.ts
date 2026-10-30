import { Injectable, NotFoundException } from '@nestjs/common';
import type { PlaylistSnapshot } from '@biltekmyo/shared-types';
import { PlaylistScheduler } from '@biltekmyo/scheduler';
import { ContentService } from './content.service.js';
import { DisplayService } from './display.service.js';
import { createDisplayMediaUrl } from './media-signing.js';
import { createDisplayCameraPreviewUrl } from './media-signing.js';
import { EdgeRegistryService } from './edge-registry.service.js';

@Injectable()
export class PlaylistService {
  private readonly scheduler = new PlaylistScheduler();
  constructor(private readonly content: ContentService, private readonly displays: DisplayService, private readonly edge: EdgeRegistryService) {}

  async snapshot(displayId: string, now = new Date()): Promise<PlaylistSnapshot> {
    if (!await this.displays.exists(displayId)) throw new NotFoundException(`Unknown display: ${displayId}`);
    const snapshot = this.scheduler.createSnapshot(displayId, await this.content.list(), { now });
    const [boxes, displays] = await Promise.all([this.edge.list(), this.displays.list()]);
    const cameraIds = boxes.flatMap((box) => box.cameraIds);
    const displayIndex = Math.max(0, displays.findIndex((display) => display.id === displayId));
    const previewCameraId = cameraIds[Math.min(displayIndex, cameraIds.length - 1)];
    const previewUrl = previewCameraId ? createDisplayCameraPreviewUrl(previewCameraId, displayId, now) : undefined;
    return {
      ...snapshot,
      ...(previewCameraId && previewUrl ? { cameraPreview: { cameraId: previewCameraId, streamUrl: previewUrl } } : {}),
      items: snapshot.items.map((item) => {
        const attachment = item.payload.attachmentUrl;
        const match = attachment?.match(/^\/media\/([a-f0-9-]{36}\.(?:pdf|png|jpg|jpeg|webp|mp4))$/);
        if (!match?.[1]) return item;
        return { ...item, payload: { ...item.payload, attachmentUrl: createDisplayMediaUrl(match[1], displayId, now) } };
      }),
    };
  }
}
