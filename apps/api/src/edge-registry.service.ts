import { Injectable } from '@nestjs/common';
import type { DeviceHeartbeat, DisplayMetricsSnapshot, MetricsEvent } from '@biltekmyo/shared-types';
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
