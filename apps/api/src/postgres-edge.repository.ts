import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import type { AnonymousMetrics, DeviceHeartbeat, DisplayMetricsSnapshot, MetricsEvent } from '@biltekmyo/shared-types';
import type { EdgeRepository } from './edge-repository.js';
import type { RegisteredAiBox } from './edge-registry.service.js';

type AiBoxRow = {
  id: string;
  name: string;
  last_heartbeat_at: Date | null;
  last_metrics_at: Date | null;
};

type DisplayMetricRow = {
  ai_box_id: string;
  camera_id: string;
  captured_at: Date;
  people_count: number;
  entries: number;
  exits: number;
  estimated_occupancy: number;
  motion_detected: boolean;
  gender_distribution: AnonymousMetrics['genderDistribution'];
};

@Injectable()
export class PostgresEdgeRepository implements EdgeRepository, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async register(box: RegisteredAiBox): Promise<RegisteredAiBox> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ai_boxes (id, name, model_version)
         VALUES ($1, $2, 'unconfigured')
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
        [box.id, box.name],
      );
      for (const cameraId of box.cameraIds) {
        await client.query(
          `INSERT INTO cameras (id, ai_box_id, name, source_kind)
           VALUES ($1, $2, $3, 'usb')
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, ai_box_id = EXCLUDED.ai_box_id`,
          [cameraId, box.id, cameraId],
        );
      }
      await client.query('COMMIT');
      return box;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async heartbeat(heartbeat: DeviceHeartbeat): Promise<RegisteredAiBox> {
    const result = await this.pool.query<AiBoxRow>(
      `UPDATE ai_boxes
       SET last_heartbeat_at = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, last_heartbeat_at,
         (SELECT MAX(last_metrics_at) FROM cameras WHERE ai_box_id = ai_boxes.id) AS last_metrics_at`,
      [heartbeat.aiBoxId, heartbeat.sentAt],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Unknown AI Box: ${heartbeat.aiBoxId}`);
    }
    return this.toRegisteredBox(row);
  }

  async ingestMetrics(event: MetricsEvent): Promise<void> {
    const result = await this.pool.query(
      `INSERT INTO metrics_events (
        ai_box_id, camera_id, captured_at, people_count, entries, exits,
        estimated_occupancy, gender_distribution, mood_distribution, motion_detected
      )
      SELECT $1, c.id, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10
      FROM cameras c
      WHERE c.id = $2 AND c.ai_box_id = $1
      RETURNING id`,
      [
        event.aiBoxId,
        event.cameraId,
        event.capturedAt,
        event.metrics.peopleCount,
        event.metrics.entries,
        event.metrics.exits,
        event.metrics.estimatedOccupancy,
        JSON.stringify(event.metrics.genderDistribution),
        JSON.stringify(event.metrics.moodDistribution),
        event.motionDetected ?? false,
      ],
    );
    if (result.rowCount !== 1) {
      throw new Error(`Camera ${event.cameraId} is not registered on AI Box ${event.aiBoxId}.`);
    }
    await this.pool.query(
      'UPDATE cameras SET last_metrics_at = $2 WHERE id = $1',
      [event.cameraId, event.capturedAt],
    );
  }

  async displayMetrics(): Promise<DisplayMetricsSnapshot> {
    const result = await this.pool.query<DisplayMetricRow>(
      `SELECT DISTINCT ON (ai_box_id, camera_id)
         ai_box_id, camera_id, captured_at, people_count, entries, exits, estimated_occupancy,
         motion_detected, gender_distribution
       FROM metrics_events
       ORDER BY ai_box_id, camera_id, captured_at DESC, id DESC`,
    );
    return {
      generatedAt: new Date().toISOString(),
      cameras: result.rows
        .sort((a, b) => b.captured_at.getTime() - a.captured_at.getTime())
        .map((row) => ({
          aiBoxId: row.ai_box_id,
          cameraId: row.camera_id,
          capturedAt: row.captured_at.toISOString(),
          peopleCount: row.people_count,
          entries: row.entries,
          exits: row.exits,
          estimatedOccupancy: row.estimated_occupancy,
          motionDetected: row.motion_detected,
          genderDistribution: row.gender_distribution,
        })),
    };
  }

  async hasCamera(aiBoxId: string, cameraId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM cameras WHERE ai_box_id = $1 AND id = $2 AND enabled = TRUE',
      [aiBoxId, cameraId],
    );
    return result.rowCount === 1;
  }

  async list(): Promise<RegisteredAiBox[]> {
    const result = await this.pool.query<AiBoxRow>(
      `SELECT b.id, b.name, b.last_heartbeat_at,
        (SELECT MAX(last_metrics_at) FROM cameras WHERE ai_box_id = b.id) AS last_metrics_at
       FROM ai_boxes b
       ORDER BY b.id`,
    );
    const boxes = await Promise.all(result.rows.map(async (row) => {
      const cameras = await this.pool.query<{ id: string }>(
        'SELECT id FROM cameras WHERE ai_box_id = $1 ORDER BY id',
        [row.id],
      );
      if (cameras.rows.length !== 2) {
        throw new Error(`AI Box ${row.id} must have exactly two cameras.`);
      }
      return this.toRegisteredBox(row, cameras.rows.map((camera) => camera.id));
    }));
    return boxes;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private toRegisteredBox(
    row: AiBoxRow,
    cameraIds?: string[],
  ): RegisteredAiBox {
    if (!cameraIds || cameraIds.length !== 2) {
      throw new Error(`AI Box ${row.id} must have exactly two cameras.`);
    }
    const [firstCameraId, secondCameraId] = cameraIds;
    if (!firstCameraId || !secondCameraId) {
      throw new Error(`AI Box ${row.id} has invalid camera identifiers.`);
    }
    return {
      id: row.id,
      name: row.name,
      cameraIds: [firstCameraId, secondCameraId],
      lastHeartbeatAt: row.last_heartbeat_at?.toISOString(),
      lastMetricsAt: row.last_metrics_at?.toISOString(),
    };
  }
}
