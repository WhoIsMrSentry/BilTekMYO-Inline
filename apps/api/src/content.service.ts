import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { ScheduledContent } from '@biltekmyo/shared-types';
import type { ContentRepository } from './content-repository.js';

@Injectable()
export class ContentService {
  private readonly updates = new EventEmitter();

  constructor(private readonly repository: ContentRepository) {}

  list(): Promise<ScheduledContent[]> {
    return this.repository.list();
  }

  async create(content: ScheduledContent): Promise<ScheduledContent> {
    this.validate(content);
    const saved = await this.repository.create(content);
    this.updates.emit('changed');
    return saved;
  }

  async update(content: ScheduledContent): Promise<ScheduledContent> {
    this.validate(content);
    const saved = await this.repository.update(content);
    this.updates.emit('changed');
    return saved;
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.updates.emit('changed');
  }

  onChanged(listener: () => void): () => void {
    this.updates.on('changed', listener);
    return () => this.updates.off('changed', listener);
  }

  private validate(content: ScheduledContent): void {
    if (!content.id.trim() || !content.title.trim()) {
      throw new Error('Content id and title are required.');
    }
    if (content.durationSeconds <= 0) {
      throw new Error('Content duration must be positive.');
    }
    if (content.type === 'emergency' && content.priority < 100) {
      throw new Error('Emergency content must have priority 100 or higher.');
    }
    if (content.schedule.displayIds.length === 0) {
      throw new Error('Content must target at least one display.');
    }
    const startsAt = new Date(content.schedule.startsAt);
    const endsAt = new Date(content.schedule.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new Error('Content schedule must have a valid date range.');
    }
    if (content.schedule.daysOfWeek?.some((day) => day < 0 || day > 6)) {
      throw new Error('Schedule days must be between 0 and 6.');
    }
  }
}
