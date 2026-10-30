import { Injectable } from '@nestjs/common';
import type { ScheduledContent } from '@biltekmyo/shared-types';
import type { ContentRepository } from './content-repository.js';

@Injectable()
export class InMemoryContentRepository implements ContentRepository {
  private readonly contents = new Map<string, ScheduledContent>();

  async list(): Promise<ScheduledContent[]> {
    return [...this.contents.values()]
      .sort((left, right) => {
        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }
        return left.id.localeCompare(right.id);
      })
      .map((content) => ({
        ...content,
        schedule: {
          ...content.schedule,
          displayIds: [...content.schedule.displayIds],
          daysOfWeek: content.schedule.daysOfWeek
            ? [...content.schedule.daysOfWeek]
            : undefined,
        },
      }));
  }

  async create(content: ScheduledContent): Promise<ScheduledContent> {
    if (this.contents.has(content.id)) {
      throw new Error(`Content already exists: ${content.id}`);
    }
    this.contents.set(content.id, { ...content });
    return {
      ...content,
      schedule: {
        ...content.schedule,
        displayIds: [...content.schedule.displayIds],
        daysOfWeek: content.schedule.daysOfWeek
          ? [...content.schedule.daysOfWeek]
          : undefined,
      },
    };
  }

  async update(content: ScheduledContent): Promise<ScheduledContent> {
    if (!this.contents.has(content.id)) {
      throw new Error(`Content not found: ${content.id}`);
    }
    this.contents.set(content.id, { ...content });
    return { ...content };
  }

  async remove(id: string): Promise<void> {
    if (!this.contents.delete(id)) {
      throw new Error(`Content not found: ${id}`);
    }
  }
}
