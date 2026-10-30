// The team list (NAME | MANAGER | Work Hours | LOCATION | Amipi Email | ... | Job Role), from .ods, .xlsx or .xls.
// Each row is linked to a person already known from the punch file where possible, otherwise added as a new person.
// "NA" in Work Hours means the person is not tracked by the attendance tool.
import type { Knex } from 'knex';
import type { Employee } from '../../../shared/types.ts';

export interface TeamRow {
  name: string;
  manager: string;
  workHours: string;
  location: string;
  email: string;
  role: string;
}

export function isTeamList(rows: string[][]): boolean {
  return headerIndex(rows) >= 0;
}

function headerIndex(rows: string[][]): number {
  return rows.findIndex((r) => {
    const h = r.map((c) => c.trim().toUpperCase());
    return h.includes('NAME') && (h.includes('MANAGER') || h.includes('LOCATION'));
  });
}

export function parseTeamList(rows: string[][]): TeamRow[] {
  const hi = headerIndex(rows);
  if (hi < 0) return [];
  const head = rows[hi].map((c) => c.trim().toUpperCase());
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const c = { name: col('NAME'), manager: col('MANAGER'), hours: col('WORK HOURS', 'HOURS'), location: col('LOCATION'), email: col('EMAIL'), role: col('ROLE', 'DESIGNATION') };
  const get = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  return rows.slice(hi + 1)
    .map((r) => ({ name: get(r, c.name), manager: get(r, c.manager), workHours: get(r, c.hours), location: get(r, c.location), email: get(r, c.email), role: get(r, c.role) }))
    .filter((r) => r.name && !/^name$/i.test(r.name));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
const main = (s: string) => norm(s.replace(/\([^)]*\)/g, ' '));
const inParens = (s: string) => [...s.matchAll(/\(([^)]+)\)/g)].map((m) => norm(m[1]));
const first = (s: string) => main(s).split(' ')[0] ?? '';
const last = (s: string) => main(s).split(' ').slice(-1)[0] ?? '';

/** All the ways a person may be written: full name, names in brackets, nicknames. */
function forms(name: string, aliases = ''): Set<string> {
  const out = new Set<string>([main(name), ...inParens(name), ...aliases.split(/[,;/]/).map(norm)]);
  out.delete('');
  return out;
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Links each team-list row to a known person. Strong matches are taken first, so a weaker rule never steals a person. */
export function matchTeam(rows: TeamRow[], known: (Pick<Employee, 'id' | 'name' | 'aliases'> & { officeId?: string })[]): Map<number, string> {
  const result = new Map<number, string>();
  const taken = new Set<string>();
  const firstCount = (list: string[]) => list.reduce((m, n) => m.set(n, (m.get(n) ?? 0) + 1), new Map<string, number>());
  const knownFirst = firstCount(known.map((e) => first(e.name)));
  const rowFirst = firstCount(rows.map((r) => first(r.name)));
  const officeFirst = (office: string, name: string) => ({
    known: known.filter((e) => e.officeId === office && first(e.name) === name).length,
    rows: rows.filter((r) => officeFor(r.location) === office && first(r.name) === name).length,
  });
  const passes: ((r: TeamRow, e: Pick<Employee, 'name' | 'aliases'> & { officeId?: string }) => boolean)[] = [
    // 1. Same full name (ignoring anything in brackets).
    (r, e) => main(r.name) === main(e.name),
    // 2. Any written form matches: "IRENE (Isha Bhanushali)" = "Isha Bhanushali (Irene)", "Ryan" = "Rahul Dumpa (Ryan)", "JOLLY SUDAN" = "Tajinder Kaur (Jolly)".
    (r, e) => {
      const ef = forms(e.name, e.aliases);
      const rf = forms(r.name);
      return [...rf].some((f) => ef.has(f)) || ef.has(first(r.name)) || rf.has(first(e.name));
    },
    // 3. Same first and last name, written slightly differently ("Johnny D Silva" / "JOHNNY DESILVA").
    (r, e) => first(r.name) === first(e.name) && (last(r.name) === last(e.name) || main(r.name).replace(/ /g, '').endsWith(last(e.name))),
    // 4. A first name only one person has, on both lists.
    (r, e) => first(r.name) === first(e.name) && knownFirst.get(first(e.name)) === 1 && rowFirst.get(first(r.name)) === 1,
    // 5. A first name only one person has within the same office (a sheet that lists "Sahil" for Mumbai's Sahil Zaveri).
    (r, e) => {
      if (first(r.name) !== first(e.name) || !e.officeId || officeFor(r.location) !== e.officeId) return false;
      const c = officeFirst(e.officeId, first(e.name));
      return c.known === 1 && c.rows === 1;
    },
  ];
  for (const pass of passes) {
    rows.forEach((r, i) => {
      if (result.has(i)) return;
      const hits = known.filter((e) => !taken.has(e.id) && pass(r, e));
      if (hits.length === 1) {
        result.set(i, hits[0].id);
        taken.add(hits[0].id);
      }
    });
  }
  return result;
}

export function officeFor(location: string): string {
  const l = location.toLowerCase();
  if (l.includes('new york') || l.includes('newyork') || l === 'ny') return 'newyork';
  if (l.includes('mumbai')) return 'mumbai';
  if (l.includes('remote')) return 'remote';
  return 'indore';
}

export function slug(name: string): string {
  return main(name).toUpperCase().replace(/ /g, '-').slice(0, 20) || 'PERSON';
}

export interface TeamImportResult { added: string[]; updated: string[]; notTracked: string[]; notOnList: string[] }

/** Writes the team list into the employee list. */
export async function applyTeamList(trx: Knex.Transaction, rows: TeamRow[], known: Employee[], at: string): Promise<TeamImportResult> {
  const matches = matchTeam(rows, known);
  const out: TeamImportResult = { added: [], updated: [], notTracked: [], notOnList: [] };
  const matchedIds = new Set(matches.values());
  for (const [i, r] of rows.entries()) {
    const na = /^n\/?a$/i.test(r.workHours);
    const id = matches.get(i);
    const fields = { manager: r.manager.slice(0, 120), role: r.role.slice(0, 160), location: r.location.slice(0, 120), work_hours: r.workHours.slice(0, 32), tracked: na ? 0 : 1, updated_at: at };
    if (id) {
      const e = known.find((x) => x.id === id)!;
      const email = isEmail(r.email) && !e.email ? { email: r.email.trim().toLowerCase() } : {};
      // People first seen on a hand-kept sheet ("Sahil") take their full name from the team list; the short name stays as a nickname.
      const fromSheet = !/^\d+$/.test(id) && main(r.name).length > main(e.name).length && first(r.name) === first(e.name);
      const rename = fromSheet ? { name: titleCase(r.name), aliases: [e.aliases, e.name].filter(Boolean).join(', ') } : {};
      await trx('employees').where({ code: id }).update({ ...fields, ...email, ...rename });
      (na ? out.notTracked : out.updated).push(`${e.name}${main(r.name) !== main(e.name) ? ` (team list: ${r.name})` : ''}`);
      continue;
    }
    if (na) { out.notTracked.push(r.name); continue; }
    const office = officeFor(r.location);
    const dayTime = /day/i.test(r.workHours);
    let code = `${{ newyork: 'NY', mumbai: 'MUM', remote: 'REM', indore: 'IND' }[office]}-${slug(r.name)}`;
    while (await trx('employees').where({ code }).first()) code += 'X';
    await trx('employees').insert({
      code, name: titleCase(r.name), department: '', office_id: office,
      shift_code: office === 'newyork' ? 'NY' : office === 'mumbai' ? 'MUM' : dayTime ? 'D' : 'G',
      calendar_id: office === 'newyork' || office === 'remote' ? 'us' : office === 'mumbai' ? 'mumbai' : dayTime ? 'india-day' : 'ny-shift',
      email: isEmail(r.email) ? r.email.trim().toLowerCase() : '', aliases: inParens(r.name).join(', '), join_date: null, exit_date: null, ...fields,
    });
    out.added.push(titleCase(r.name));
  }
  for (const e of known) if (!matchedIds.has(e.id) && e.tracked !== false) out.notOnList.push(e.name);
  return out;
}

export function titleCase(s: string): string {
  return s.trim().toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
}
