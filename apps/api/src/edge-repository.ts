import type { DeviceHeartbeat, DisplayMetricsSnapshot, MetricsEvent } from '@biltekmyo/shared-types';
import type { RegisteredAiBox } from './edge-registry.service.js';

export interface EdgeRepository {
  register(box: RegisteredAiBox): Promise<RegisteredAiBox>;
  heartbeat(heartbeat: DeviceHeartbeat): Promise<RegisteredAiBox>;
  ingestMetrics(event: MetricsEvent): Promise<void>;
  hasCamera(aiBoxId: string, cameraId: string): Promise<boolean>;
  displayMetrics(): Promise<DisplayMetricsSnapshot>;
  list(): Promise<RegisteredAiBox[]>;
}
