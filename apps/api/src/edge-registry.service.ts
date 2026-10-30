import { Injectable } from '@nestjs/common';
import type { CameraFrameEvent, DeviceHeartbeat, DisplayMetricsSnapshot, MetricsEvent } from '@biltekmyo/shared-types';
import type { EdgeRepository } from './edge-repository.js';

export type RegisteredAiBox = {
  id: string;
  name: string;
  cameraIds: [string, string];
  lastHeartbeatAt?: string;
  lastMetricsAt?: string;
};

@Injectable()
export class EdgeRegistryService {
  private readonly metricListeners = new Set<() => void>();
  private readonly latestFrames = new Map<string, CameraFrameEvent>();
  private readonly frameListeners = new Map<string, Set<(frame: CameraFrameEvent) => void>>();

  constructor(private readonly repository: EdgeRepository) {}

  register(box: RegisteredAiBox): Promise<RegisteredAiBox> {
    if (box.cameraIds.length !== 2) {
      throw new Error('An AI Box must be configured with exactly two cameras.');
    }
    return this.repository.register(box);
  }

  heartbeat(heartbeat: DeviceHeartbeat): Promise<RegisteredAiBox> {
    return this.repository.heartbeat(heartbeat);
  }

  async ingestMetrics(event: MetricsEvent): Promise<void> {
    await this.repository.ingestMetrics(event);
    for (const listener of this.metricListeners) listener();
  }

  async ingestCameraFrame(event: CameraFrameEvent): Promise<void> {
    if (!await this.repository.hasCamera(event.aiBoxId, event.cameraId)) {
      throw new Error(`Camera ${event.cameraId} is not registered on AI Box ${event.aiBoxId}.`);
    }
    if (!Number.isFinite(Date.parse(event.capturedAt))) throw new Error('Camera frame timestamp is invalid.');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(event.cameraId)) throw new Error('Camera ID is invalid.');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(event.jpegBase64)) throw new Error('Camera frame must be base64 encoded.');
    const bytes = Buffer.from(event.jpegBase64, 'base64');
    if (bytes.length < 4 || bytes.length > 64 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw new Error('Camera preview must be a JPEG frame no larger than 64 KB.');
    }
    const frame = { ...event };
    this.latestFrames.set(event.cameraId, frame);
    const expire = setTimeout(() => {
      if (this.latestFrames.get(event.cameraId) === frame) this.latestFrames.delete(event.cameraId);
    }, 15_000);
    expire.unref?.();
    for (const listener of this.frameListeners.get(event.cameraId) ?? []) listener(frame);
  }

  latestCameraFrame(cameraId: string): CameraFrameEvent | undefined { return this.latestFrames.get(cameraId); }

  onCameraFrame(cameraId: string, listener: (frame: CameraFrameEvent) => void): () => void {
    const listeners = this.frameListeners.get(cameraId) ?? new Set<(frame: CameraFrameEvent) => void>();
    listeners.add(listener);
    this.frameListeners.set(cameraId, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.frameListeners.delete(cameraId); };
  }

  displayMetrics(): Promise<DisplayMetricsSnapshot> {
    return this.repository.displayMetrics();
  }

  onMetricsChanged(listener: () => void): () => void {
    this.metricListeners.add(listener);
    return () => this.metricListeners.delete(listener);
  }

  list(): Promise<RegisteredAiBox[]> {
    return this.repository.list();
  }
}
