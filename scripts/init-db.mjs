import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(resolve('apps/api/package.json'));
const { Client } = require('pg');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  for (const migration of ['001_initial_schema.sql', '002_motion_metrics.sql']) {
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [migration]);
    if (applied.rowCount !== 0) continue;
    const sql = await readFile(resolve('infrastructure/postgres', migration), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  await client.query(
    `INSERT INTO displays (id, name, location, enabled) VALUES
      ('display-01', 'Ana Bina Giriş', 'Giriş holü', TRUE),
      ('display-02', 'Konferans Salonu', '1. kat', TRUE)
     ON CONFLICT (id) DO NOTHING`,
  );
  console.log('Veritabanı hazır.');
} finally {
  await client.end();
}
