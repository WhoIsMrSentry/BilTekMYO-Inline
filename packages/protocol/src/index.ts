import type { DeviceHeartbeat, MetricsEvent, PlaylistSnapshot } from '@biltekmyo/shared-types';

export const protocolVersion = '1';

export type EdgeMessage =
  | { type: 'metrics'; payload: MetricsEvent }
  | { type: 'heartbeat'; payload: DeviceHeartbeat };

export type DisplayMessage =
  | { type: 'playlist.snapshot'; payload: PlaylistSnapshot }
  | { type: 'display.invalidate-cache' };
