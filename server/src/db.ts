import knexFactory, { type Knex } from 'knex';
import { config } from './config.ts';
import { ensureSchema } from './schema.ts';

let instance: Knex | null = null;
let ready: Promise<void> | null = null;

/** The database: MySQL on cPanel, SQLite for local tests. Tables are created on first use. */
export async function db(): Promise<Knex> {
  if (!instance) {
    const c = config().database;
    instance = knexFactory(
      c.client === 'better-sqlite3'
        ? { client: 'better-sqlite3', connection: { filename: c.filename ?? ':memory:' }, useNullAsDefault: true }
        : { client: 'mysql2', connection: { host: c.host, port: c.port, user: c.user, password: c.password, database: c.database, charset: 'utf8mb4', timezone: 'local', dateStrings: true }, pool: { min: 0, max: 5 } },
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
