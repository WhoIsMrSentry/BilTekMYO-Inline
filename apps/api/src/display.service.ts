import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

export type DisplayRecord = { id: string; name: string; location: string; enabled: boolean };

@Injectable()
export class DisplayService implements OnModuleDestroy {
  private readonly pool?: Pool;
  private readonly records = new Map<string, DisplayRecord>([
    ['display-01', { id: 'display-01', name: 'Ana Bina Giriş', location: 'Giriş holü', enabled: true }],
    ['display-02', { id: 'display-02', name: 'Konferans Salonu', location: '1. kat', enabled: true }],
  ]);

  constructor(databaseUrl?: string) {
    if (databaseUrl) this.pool = new Pool({ connectionString: databaseUrl });
  }

  async list(): Promise<DisplayRecord[]> {
    if (!this.pool) return [...this.records.values()].map((display) => ({ ...display }));
    const result = await this.pool.query<DisplayRecord>('SELECT id, name, location, enabled FROM displays ORDER BY name, id');
    return result.rows;
  }

  async create(input: Omit<DisplayRecord, 'id'>): Promise<DisplayRecord> {
    this.validate(input);
    const record = { ...input, id: `display-${randomUUID()}`, name: input.name.trim(), location: input.location.trim() };
    if (!this.pool) { this.records.set(record.id, record); return { ...record }; }
    await this.pool.query('INSERT INTO displays (id, name, location, enabled) VALUES ($1, $2, $3, $4)', [record.id, record.name, record.location, record.enabled]);
    return record;
  }

  async update(id: string, input: Omit<DisplayRecord, 'id'>): Promise<DisplayRecord> {
    this.validate(input);
    if (!this.pool) {
      if (!this.records.has(id)) throw new Error(`Display not found: ${id}`);
      const record = { ...input, id, name: input.name.trim(), location: input.location.trim() };
      this.records.set(id, record);
      return { ...record };
    }
    const result = await this.pool.query('UPDATE displays SET name = $2, location = $3, enabled = $4 WHERE id = $1 RETURNING id, name, location, enabled', [id, input.name.trim(), input.location.trim(), input.enabled]);
    if (!result.rows[0]) throw new Error(`Display not found: ${id}`);
    return result.rows[0];
  }

  async remove(id: string): Promise<void> {
    if (!this.pool) {
      if (!this.records.delete(id)) throw new Error(`Display not found: ${id}`);
      return;
    }
    const result = await this.pool.query('DELETE FROM displays WHERE id = $1', [id]);
    if (result.rowCount !== 1) throw new Error(`Display not found: ${id}`);
  }

  async exists(id: string): Promise<boolean> {
    if (!this.pool) return this.records.get(id)?.enabled === true;
    const result = await this.pool.query('SELECT 1 FROM displays WHERE id = $1 AND enabled = TRUE', [id]);
    return (result.rowCount ?? 0) === 1;
  }

  async onModuleDestroy(): Promise<void> { await this.pool?.end(); }

  private validate(input: Omit<DisplayRecord, 'id'>): void {
    if (!input.name?.trim() || !input.location?.trim()) throw new Error('Ekran adı ve konumu gerekli.');
  }
}
