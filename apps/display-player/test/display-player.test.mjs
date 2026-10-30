import assert from 'node:assert/strict';
import {
  DisplayRegistry,
  MemorySnapshotStorage,
  PlaybackQueue,
  PlaylistCache,
} from '../dist/index.js';

const storage = new MemorySnapshotStorage();
const firstCache = new PlaylistCache(storage, 'display-01');
const registry = new DisplayRegistry();
registry.register({
  id: 'display-01',
  name: 'Main Hall',
  location: 'Entrance',
  enabled: true,
});
assert.throws(
  () => registry.register({
    id: 'display-01',
    name: 'Duplicate',
    location: 'Entrance',
    enabled: true,
  }),
  /already registered/,
);

firstCache.update({
  version: 'v1',
  generatedAt: '2026-10-28T14:30:00Z',
  items: [
    {
      id: 'announcement',
      type: 'announcement',
      title: 'Announcement',
      payload: {},
      durationSeconds: 10,
      priority: 1,
    },
    {
      id: 'emergency',
      type: 'emergency',
      title: 'Emergency',
      payload: {},
      durationSeconds: 10,
      priority: 100,
    },
  ],
});

const secondCache = new PlaylistCache(storage, 'display-01');
assert.equal(secondCache.current().version, 'v1');
const queue = new PlaybackQueue(secondCache);
assert.equal(queue.currentItems()[0].id, 'emergency');
assert.equal(queue.emergencyItems().length, 1);
assert.throws(
  () => secondCache.update({
    version: 'v2',
    generatedAt: '2026-10-28T14:31:00Z',
    items: [{
      id: 'invalid',
      type: 'announcement',
      title: 'Invalid',
      payload: {},
      durationSeconds: 0,
      priority: 1,
    }],
  }),
  /duration must be positive/,
);

console.log('display-player tests passed');
