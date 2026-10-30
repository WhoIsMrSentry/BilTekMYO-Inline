export type CameraSourceKind = 'usb' | 'rtsp';

export type CameraConfig = {
  id: string;
  name: string;
  source: CameraSourceKind;
  uri?: string;
  enabled: boolean;
};

export type AiBoxConfig = {
  id: string;
  name: string;
  cameras: [CameraConfig, CameraConfig];
  modelVersion: string;
  privacy: {
    retainFrames: boolean;
    retentionSeconds: number;
  };
};

export type Mood = 'happy' | 'neutral' | 'sad' | 'angry' | 'unknown';

export type AnonymousMetrics = {
  peopleCount: number;
  entries: number;
  exits: number;
  estimatedOccupancy: number;
  genderDistribution: {
    female: number;
    male: number;
    unknown: number;
  };
  moodDistribution: Record<Mood, number>;
};

export type MetricsEvent = {
  schemaVersion: 1;
  aiBoxId: string;
  cameraId: string;
  capturedAt: string;
  motionDetected?: boolean;
  metrics: AnonymousMetrics;
};

export type CameraFrameEvent = {
  aiBoxId: string;
  cameraId: string;
  capturedAt: string;
  jpegBase64: string;
};

export type DisplayCameraMetrics = {
  aiBoxId: string;
  cameraId: string;
  capturedAt: string;
  peopleCount: number;
  entries: number;
  exits: number;
  estimatedOccupancy: number;
  motionDetected?: boolean;
  genderDistribution?: AnonymousMetrics['genderDistribution'];
};

export type DisplayMetricsSnapshot = {
  generatedAt: string;
  cameras: DisplayCameraMetrics[];
};

export type DeviceHeartbeat = {
  aiBoxId: string;
  sentAt: string;
  agentVersion: string;
  modelVersion: string;
  cameraStatuses: Record<string, 'online' | 'offline' | 'degraded'>;
};

export type DisplayContent = {
  id: string;
  type: 'announcement' | 'image' | 'video' | 'school-info' | 'metrics' | 'emergency' | 'camera-stream';
  title: string;
  payload: Record<string, string>;
  durationSeconds: number;
  priority: number;
};

export type PlaylistSnapshot = {
  version: string;
  generatedAt: string;
  items: DisplayContent[];
  cameraPreview?: { cameraId: string; streamUrl: string };
};

export type DisplayConfig = {
  id: string;
  name: string;
  location: string;
  enabled: boolean;
};

export type DisplaySchedule = {
  displayIds: string[];
  startsAt: string;
  endsAt: string;
  daysOfWeek?: number[];
};

export type ScheduledContent = DisplayContent & {
  schedule: DisplaySchedule;
};
