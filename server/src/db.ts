import knexFactory, { type Knex } from 'knex';
import { config } from './config.ts';
import { ensureSchema } from './schema.ts';

let instance: Knex | null = null;
let ready: Promise<void> | null = null;

/** The database: PostgreSQL (or MySQL) on the server, SQLite on your own computer. Tables are created on first use. */
export async function db(): Promise<Knex> {
  if (!instance) {
    const c = config().database;
    const pool = { min: 0, max: 5 };
    instance = knexFactory(
      c.client === 'better-sqlite3'
        ? { client: 'better-sqlite3', connection: { filename: c.filename ?? ':memory:' }, useNullAsDefault: true }
        : c.client === 'mysql2'
          ? { client: 'mysql2', connection: { host: c.host, port: c.port ?? 3306, user: c.user, password: c.password, database: c.database, charset: 'utf8mb4', timezone: 'local', dateStrings: true }, pool }
          : { client: 'pg', connection: { host: c.host ?? 'localhost', port: c.port ?? 5432, user: c.user, password: c.password, database: c.database }, pool },
    );
    ready = ensureSchema(instance);
  }
  await ready;
  return instance;
}

export async function closeDb() {
  if (instance) await instance.destroy();
  instance = null;
  ready = null;
}

/** Inserts one row and returns its new id. MySQL reports ids differently from PostgreSQL and SQLite. */
export async function insertId(k: Knex | Knex.Transaction, table: string, row: Record<string, unknown>): Promise<number> {
  if (config().database.client === 'mysql2') {
    const [id] = await k(table).insert(row);
    return Number(id);
  }
  const [r] = await k(table).insert(row).returning('id');
  return Number(typeof r === 'object' ? (r as { id: number }).id : r);
}
