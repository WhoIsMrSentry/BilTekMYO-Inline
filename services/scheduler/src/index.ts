import type {
  DisplayContent,
  PlaylistSnapshot,
  ScheduledContent,
} from '@biltekmyo/shared-types';

export type ScheduleClock = {
  now: Date;
  timeZone?: string;
};

export class PlaylistScheduler {
  createSnapshot(
    displayId: string,
    entries: ScheduledContent[],
    clock: ScheduleClock,
  ): PlaylistSnapshot {
    const active = entries.filter((entry) => isActive(entry, displayId, clock));
    const emergency = active.filter((entry) => entry.type === 'emergency');
    const selected = emergency.length > 0 ? emergency : active;
    const items = sortByPriority(selected).map(toDisplayContent);

    return {
      version: `${displayId}-${clock.now.toISOString()}`,
      generatedAt: clock.now.toISOString(),
      items,
    };
  }
}

function isActive(
  entry: ScheduledContent,
  displayId: string,
  clock: ScheduleClock,
): boolean {
  if (!entry.schedule.displayIds.includes(displayId)) {
    return false;
  }

  const startsAt = new Date(entry.schedule.startsAt);
  const endsAt = new Date(entry.schedule.endsAt);
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    endsAt <= startsAt ||
    clock.now < startsAt ||
    clock.now >= endsAt
  ) {
    return false;
  }

  const days = entry.schedule.daysOfWeek;
  return !days || days.length === 0 || days.includes(clock.now.getUTCDay());
}

function sortByPriority(entries: ScheduledContent[]): ScheduledContent[] {
  return [...entries].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }
    return left.id.localeCompare(right.id);
  });
}

function toDisplayContent(entry: ScheduledContent): DisplayContent {
  const { schedule: _schedule, ...content } = entry;
  return content;
}
