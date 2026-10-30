import type { DeviceHeartbeat, DisplayMetricsSnapshot, MetricsEvent } from '@biltekmyo/shared-types';
import type { RegisteredAiBox } from './edge-registry.service.js';

export interface EdgeRepository {
  register(box: RegisteredAiBox): Promise<RegisteredAiBox>;
  heartbeat(heartbeat: DeviceHeartbeat): Promise<RegisteredAiBox>;
  ingestMetrics(event: MetricsEvent): Promise<void>;
  displayMetrics(): Promise<DisplayMetricsSnapshot>;
  list(): Promise<RegisteredAiBox[]>;
}
