import type { Knex } from 'knex';
import { CALENDARS, HOLIDAYS, OFFICES, RULES, SHIFTS } from './seed.ts';

const VERSION = 1;

/** Creates the tables on first use and fills in the starting data. Safe to run on every start. */
export async function ensureSchema(k: Knex): Promise<void> {
  if (!(await k.schema.hasTable('state'))) {
    await k.schema.createTable('state', (t) => { t.string('name', 64).primary(); t.text('value'); });
  }
  const row = await k('state').where({ name: 'schema_version' }).first();
  if (Number(row?.value ?? 0) >= VERSION) return;

  const create = async (name: string, build: (t: Knex.CreateTableBuilder) => void) => {
    if (!(await k.schema.hasTable(name))) await k.schema.createTable(name, build);
  };
  await create('users', (t) => {
    t.increments('id'); t.string('email', 190).notNullable().unique(); t.string('name', 120).notNullable();
    t.string('pass_hash', 255).notNullable(); t.string('role', 16).notNullable().defaultTo('viewer'); t.string('created_at', 20).notNullable();
  });
  await create('sessions', (t) => {
    t.string('token', 64).primary(); t.integer('user_id').notNullable(); t.string('expires_at', 20).notNullable();
  });
  await create('employees', (t) => {
    t.string('code', 32).primary(); t.string('name', 120).notNullable(); t.string('department', 120).notNullable().defaultTo('');
    t.string('office_id', 32).notNullable().defaultTo(''); t.string('shift_code', 16).notNullable().defaultTo(''); t.string('calendar_id', 32).notNullable().defaultTo('');
    t.string('email', 190).notNullable().defaultTo(''); t.string('aliases', 255).notNullable().defaultTo('');
    t.string('join_date', 10).nullable(); t.string('exit_date', 10).nullable(); t.string('updated_at', 20).notNullable();
  });
  await create('calendars', (t) => {
    t.string('id', 32).primary(); t.string('name', 120).notNullable(); t.string('description', 255).notNullable().defaultTo(''); t.integer('sort').notNullable().defaultTo(0);
  });
  await create('holidays', (t) => {
    t.increments('id'); t.string('calendar_id', 32).notNullable(); t.string('date', 10).notNullable(); t.string('name', 120).notNullable();
    t.index(['calendar_id', 'date']);
  });
  await create('shifts', (t) => {
    t.string('code', 16).primary(); t.string('name', 120).notNullable().defaultTo(''); t.integer('start_min').notNullable(); t.integer('end_min').notNullable(); t.integer('confirmed').notNullable().defaultTo(0);
  });
  await create('settings', (t) => { t.string('name', 64).primary(); t.text('value').notNullable(); });
  await create('imports', (t) => {
    t.increments('id'); t.string('month', 7).notNullable().index(); t.string('file_name', 255).notNullable(); t.string('stored_path', 500).notNullable();
    t.string('source', 16).notNullable(); t.string('imported_at', 20).notNullable(); t.string('imported_by', 120).notNullable();
    t.integer('people').notNullable(); t.integer('days').notNullable();
  });
  await create('raw_days', (t) => {
    t.increments('id'); t.integer('import_id').notNullable().index(); t.string('emp_code', 32).notNullable(); t.string('date', 10).notNullable();
    t.string('shift', 16).notNullable(); t.integer('in_min').nullable(); t.integer('out_min').nullable(); t.integer('work_min').notNullable().defaultTo(0);
    t.integer('ot_min').notNullable().defaultTo(0); t.integer('less_min').notNullable().defaultTo(0); t.string('status', 8).notNullable(); t.string('remark', 64).notNullable().defaultTo('');
    t.index(['emp_code', 'date']);
  });
  await create('emails', (t) => {
    t.increments('id'); t.string('graph_id', 255).notNullable().unique(); t.string('from_addr', 190).notNullable(); t.string('received_at', 20).notNullable().index();
    t.string('subject', 255).notNullable(); t.text('body').notNullable(); t.integer('is_attendance').notNullable().defaultTo(0); t.string('kind', 32).notNullable().defaultTo('');
    t.string('detected', 120).notNullable().defaultTo(''); t.string('emp_code', 32).nullable(); t.text('dates').notNullable(); t.integer('half_day').notNullable().defaultTo(0);
    t.integer('confidence').notNullable().defaultTo(0); t.string('warning', 500).notNullable().defaultTo(''); t.string('processed_at', 20).notNullable(); t.string('error', 500).notNullable().defaultTo('');
  });
  await create('notifications', (t) => {
    t.increments('id'); t.string('at', 20).notNullable(); t.string('to_addr', 500).notNullable(); t.string('audience', 16).notNullable(); t.string('subject', 255).notNullable();
    t.text('body').notNullable(); t.string('issue_key', 160).nullable().index(); t.string('month', 7).notNullable().index(); t.integer('sent').notNullable().defaultTo(0); t.string('error', 500).notNullable().defaultTo('');
  });
  await create('audit', (t) => {
    t.increments('id'); t.string('at', 20).notNullable(); t.string('user_name', 120).notNullable(); t.string('subject', 255).notNullable();
    t.string('emp_code', 32).nullable(); t.string('date', 10).nullable(); t.string('from_val', 500).notNullable(); t.string('to_val', 500).notNullable();
    t.string('reason', 500).notNullable(); t.string('source', 32).notNullable();
  });
  await create('reports', (t) => {
    t.increments('id'); t.string('month', 7).notNullable().index(); t.integer('version').notNullable(); t.string('path', 500).notNullable();
    t.string('created_at', 20).notNullable(); t.text('sent_to').notNullable(); t.string('note', 255).notNullable().defaultTo('');
  });

  if (!(await k('calendars').first())) {
    await k('calendars').insert(CALENDARS.map((c) => ({ id: c.id, name: c.name, description: c.description, sort: c.sort })));
    await k('holidays').insert(Object.entries(HOLIDAYS).flatMap(([cal, list]) => list.map(([date, name]) => ({ calendar_id: cal, date, name }))));
  }
  if (!(await k('shifts').first())) {
    await k('shifts').insert(SHIFTS.map(([code, name, start, end]) => ({ code, name, start_min: start, end_min: end, confirmed: 0 })));
  }
  if (!(await k('settings').where({ name: 'rules' }).first())) await k('settings').insert({ name: 'rules', value: JSON.stringify(RULES) });
  if (!(await k('settings').where({ name: 'offices' }).first())) await k('settings').insert({ name: 'offices', value: JSON.stringify(OFFICES) });
  await k('state').where({ name: 'schema_version' }).delete();
  await k('state').insert({ name: 'schema_version', value: String(VERSION) });
}
