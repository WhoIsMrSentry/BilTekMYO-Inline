import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import type { DisplayContent, ScheduledContent } from '@biltekmyo/shared-types';
import type { ContentRepository } from './content-repository.js';

type ContentRow = {
  id: string;
  type: DisplayContent['type'];
  title: string;
  payload: Record<string, string>;
  duration_seconds: number;
  priority: number;
  starts_at: Date;
  ends_at: Date;
  days_of_week: number[];
  display_ids: string[];
};

@Injectable()
export class PostgresContentRepository implements ContentRepository, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async list(): Promise<ScheduledContent[]> {
    const result = await this.pool.query<ContentRow>(
      `SELECT c.id, c.type, c.title, c.payload, c.duration_seconds, c.priority,
        s.starts_at, s.ends_at, s.days_of_week,
        COALESCE(array_agg(cd.display_id) FILTER (WHERE cd.display_id IS NOT NULL), '{}') AS display_ids
       FROM contents c
       JOIN content_schedules s ON s.content_id = c.id
       LEFT JOIN content_displays cd ON cd.content_id = c.id
       GROUP BY c.id, s.starts_at, s.ends_at, s.days_of_week
       ORDER BY priority DESC, id ASC`,
    );
    return result.rows.map((row) => this.toContent(row));
  }

  async create(content: ScheduledContent): Promise<ScheduledContent> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO contents (id, type, title, payload, duration_seconds, priority)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
        [content.id, content.type, content.title, JSON.stringify(content.payload), content.durationSeconds, content.priority],
      );
      await client.query(
        `INSERT INTO content_schedules (content_id, starts_at, ends_at, days_of_week)
         VALUES ($1, $2, $3, $4)`,
        [content.id, content.schedule.startsAt, content.schedule.endsAt, content.schedule.daysOfWeek ?? []],
      );
      for (const displayId of content.schedule.displayIds) {
        await client.query(
          'INSERT INTO content_displays (content_id, display_id) VALUES ($1, $2)',
          [content.id, displayId],
        );
      }
      await client.query('COMMIT');
      return content;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query('DELETE FROM contents WHERE id = $1', [id]);
    if (result.rowCount !== 1) {
      throw new Error(`Content not found: ${id}`);
    }

  }

  async update(content: ScheduledContent): Promise<ScheduledContent> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE contents SET type = $2, title = $3, payload = $4::jsonb,
          duration_seconds = $5, priority = $6, updated_at = NOW()
         WHERE id = $1`,
        [content.id, content.type, content.title, JSON.stringify(content.payload), content.durationSeconds, content.priority],
      );
      if (result.rowCount !== 1) throw new Error(`Content not found: ${content.id}`);
      await client.query(
        `UPDATE content_schedules SET starts_at = $2, ends_at = $3, days_of_week = $4
         WHERE content_id = $1`,
        [content.id, content.schedule.startsAt, content.schedule.endsAt, content.schedule.daysOfWeek ?? []],
      );
      await client.query('DELETE FROM content_displays WHERE content_id = $1', [content.id]);
      for (const displayId of content.schedule.displayIds) {
        await client.query('INSERT INTO content_displays (content_id, display_id) VALUES ($1, $2)', [content.id, displayId]);
      }
      await client.query('COMMIT');
      return content;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private toContent(row: ContentRow & { display_ids?: string[] }): ScheduledContent {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      payload: row.payload,
      durationSeconds: row.duration_seconds,
      priority: row.priority,
      schedule: {
        displayIds: row.display_ids ?? [],
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        daysOfWeek: row.days_of_week,
      },
    };
  }
}
