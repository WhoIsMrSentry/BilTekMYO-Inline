import type {
  DisplayConfig,
  DisplayContent,
  PlaylistSnapshot,
} from '@biltekmyo/shared-types';

export interface SnapshotStorage {
  load(key: string): PlaylistSnapshot | undefined;
  save(key: string, snapshot: PlaylistSnapshot): void;
}

export class MemorySnapshotStorage implements SnapshotStorage {
  private readonly snapshots = new Map<string, PlaylistSnapshot>();

  load(key: string): PlaylistSnapshot | undefined {
    return this.snapshots.get(key);
  }

  save(key: string, snapshot: PlaylistSnapshot): void {
    this.snapshots.set(key, snapshot);
  }
}

export class LocalStorageSnapshotStorage implements SnapshotStorage {
  load(key: string): PlaylistSnapshot | undefined {
    if (typeof window === 'undefined') return undefined;
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    const snapshot = JSON.parse(raw) as PlaylistSnapshot;
    validateSnapshot(snapshot);
    return snapshot;
  }

  save(key: string, snapshot: PlaylistSnapshot): void {
    if (typeof window === 'undefined') {
      throw new Error('Local storage is unavailable outside a browser.');
    }
    validateSnapshot(snapshot);
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  }
}

export class PlaylistCache {
  private snapshot?: PlaylistSnapshot;

  constructor(
    private readonly storage: SnapshotStorage,
    private readonly storageKey: string,
  ) {
    this.snapshot = storage.load(storageKey);
  }

  update(snapshot: PlaylistSnapshot): void {
    validateSnapshot(snapshot);
    this.snapshot = snapshot;
    this.storage.save(this.storageKey, snapshot);
  }

  current(): PlaylistSnapshot | undefined {
    return this.snapshot;
  }
}

export class DisplayRegistry {
  private readonly displays = new Map<string, DisplayConfig>();

  register(display: DisplayConfig): DisplayConfig {
    if (this.displays.has(display.id)) {
      throw new Error(`Display is already registered: ${display.id}`);
    }
    this.displays.set(display.id, display);
    return display;
  }

  list(): DisplayConfig[] {
    return [...this.displays.values()];
  }
}

export class PlaybackQueue {
  constructor(private readonly cache: PlaylistCache) {}

  currentItems(): DisplayContent[] {
    const items = this.cache.current()?.items ?? [];
    return [...items].sort((left, right) => right.priority - left.priority);
  }

  emergencyItems(): DisplayContent[] {
    return this.currentItems().filter((item) => item.type === 'emergency');
  }
}

function validateSnapshot(snapshot: PlaylistSnapshot): void {
  if (!snapshot.version.trim()) {
    throw new Error('Playlist version cannot be empty.');
  }
  if (!snapshot.generatedAt.trim()) {
    throw new Error('Playlist generatedAt cannot be empty.');
  }
  for (const item of snapshot.items) {
    if (item.durationSeconds <= 0) {
      throw new Error(`Content duration must be positive: ${item.id}`);
    }
  }
}
