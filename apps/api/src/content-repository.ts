import type { ScheduledContent } from '@biltekmyo/shared-types';

export interface ContentRepository {
  list(): Promise<ScheduledContent[]>;
  create(content: ScheduledContent): Promise<ScheduledContent>;
  update(content: ScheduledContent): Promise<ScheduledContent>;
  remove(id: string): Promise<void>;
}
