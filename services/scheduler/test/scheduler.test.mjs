import assert from 'node:assert/strict';
import { PlaylistScheduler } from '../dist/index.js';

const scheduler = new PlaylistScheduler();
const now = new Date('2026-10-28T10:00:00.000Z');
const baseSchedule = {
  displayIds: ['display-01'],
  startsAt: '2026-10-28T09:00:00.000Z',
  endsAt: '2026-10-28T17:00:00.000Z',
};

const normal = {
  id: 'normal',
  type: 'announcement',
  title: 'Normal',
  payload: {},
  durationSeconds: 10,
  priority: 1,
  schedule: baseSchedule,
};
const emergency = {
  id: 'emergency',
  type: 'emergency',
  title: 'Emergency',
  payload: {},
  durationSeconds: 10,
  priority: 5,
  schedule: baseSchedule,
};

let snapshot = scheduler.createSnapshot('display-01', [normal, emergency], { now });
assert.deepEqual(snapshot.items.map((item) => item.id), ['emergency']);

snapshot = scheduler.createSnapshot('display-02', [normal], { now });
assert.equal(snapshot.items.length, 0);

snapshot = scheduler.createSnapshot(
  'display-01',
  [{ ...normal, schedule: { ...baseSchedule, endsAt: '2026-10-28T10:00:00.000Z' } }],
  { now },
);
assert.equal(snapshot.items.length, 0);

snapshot = scheduler.createSnapshot(
  'display-01',
  [
    { ...normal, id: 'later', priority: 3 },
    { ...normal, id: 'earlier', priority: 3 },
  ],
  { now },
);
assert.deepEqual(snapshot.items.map((item) => item.id), ['earlier', 'later']);

console.log('scheduler tests passed');
