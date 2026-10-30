import { Injectable } from '@nestjs/common';
import type { DeviceHeartbeat, DisplayMetricsSnapshot, MetricsEvent } from '@biltekmyo/shared-types';
import type { EdgeRepository } from './edge-repository.js';
import type { RegisteredAiBox } from './edge-registry.service.js';

@Injectable()
export class InMemoryEdgeRepository implements EdgeRepository {
  private readonly boxes = new Map<string, RegisteredAiBox>();
  private readonly metrics: MetricsEvent[] = [];

  async register(box: RegisteredAiBox): Promise<RegisteredAiBox> {
    this.boxes.set(box.id, { ...box });
    return { ...box };
  }

  async heartbeat(heartbeat: DeviceHeartbeat): Promise<RegisteredAiBox> {
    const box = this.boxes.get(heartbeat.aiBoxId);
    if (!box) {
      throw new Error(`Unknown AI Box: ${heartbeat.aiBoxId}`);
    }
    box.lastHeartbeatAt = heartbeat.sentAt;
    return { ...box };
  }

  async ingestMetrics(event: MetricsEvent): Promise<void> {
    const box = this.boxes.get(event.aiBoxId);
    if (!box) {
      throw new Error(`Unknown AI Box: ${event.aiBoxId}`);
    }
    if (!box.cameraIds.includes(event.cameraId)) {
      throw new Error(`Camera ${event.cameraId} is not registered on AI Box ${event.aiBoxId}.`);
    }
    box.lastMetricsAt = event.capturedAt;
    this.metrics.push(event);
    if (this.metrics.length > 100) this.metrics.shift();
  }

  async hasCamera(aiBoxId: string, cameraId: string): Promise<boolean> {
    return this.boxes.get(aiBoxId)?.cameraIds.includes(cameraId) ?? false;
  }

  async displayMetrics(): Promise<DisplayMetricsSnapshot> {
    const latest = new Map<string, MetricsEvent>();
    for (const event of [...this.metrics].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))) {
      const key = `${event.aiBoxId}:${event.cameraId}`;
      if (!latest.has(key)) latest.set(key, event);
    }
    return {
      generatedAt: new Date().toISOString(),
      cameras: [...latest.values()].map((event) => ({
        aiBoxId: event.aiBoxId,
        cameraId: event.cameraId,
        capturedAt: event.capturedAt,
        peopleCount: event.metrics.peopleCount,
        entries: event.metrics.entries,
        exits: event.metrics.exits,
        estimatedOccupancy: event.metrics.estimatedOccupancy,
        motionDetected: event.motionDetected ?? false,
        genderDistribution: event.metrics.genderDistribution,
      })),
    };
  }

  async list(): Promise<RegisteredAiBox[]> {
    return [...this.boxes.values()].map((box) => ({ ...box }));
  }
}
