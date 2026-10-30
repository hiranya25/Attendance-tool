import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A month-to-date export taken on 29 Oct lists 29-31 Oct as "A". Those days must not count as absences.
test('month-to-date file: days after yesterday are not counted', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-'));
  const cfg = path.join(dir, 'config.json');
  fs.writeFileSync(cfg, JSON.stringify({ database: { client: 'better-sqlite3', filename: path.join(dir, 'db.sqlite') }, storageDir: path.join(dir, 'storage'), sendEmail: false }));
  process.env.ATTENDANCE_CONFIG = cfg;
  process.env.ATTENDANCE_TODAY = '2026-10-29';
  const { parseRows } = await import('../src/import/punchReport.ts');
  const { db, closeDb } = await import('../src/db.ts');
  const { buildMonth } = await import('../src/engine/monthBuilder.ts');

  const rows: string[][] = [
    ['Dept. Name', 'AMIPI - BT OFFICE', '', '', '', 'Report Month', '', 'October-2026'],
    ['Empcode', '0901', '', '', 'Name', 'Invented Person'],
    ['Date', 'Day', 'Shift', 'IN', 'OUT', 'Work+OT', 'OT', 'Less Hrs', 'Status', 'Remark'],
    ['27/10/2026', 'Tue', 'G', '09:40', '18:35', '08:55', '00:00', '00:00', 'P', '--'],
    ['28/10/2026', 'Wed', 'X', '--:--', '--:--', '00:00', '00:00', '00:00', 'A', '--'],
    ['29/10/2026', 'Thu', 'X', '--:--', '--:--', '00:00', '00:00', '00:00', 'A', '--'],
    ['30/10/2026', 'Fri', 'X', '--:--', '--:--', '00:00', '00:00', '00:00', 'A', '--'],
  ];
  const report = parseRows(rows);
  const k = await db();
  const [imp] = await k('imports').insert({ month: '2026-10', file_name: 't.xls', stored_path: '', source: 'upload', imported_at: '2026-10-29T10:00', imported_by: 'test', people: 1, days: 4 }).returning('id');
  await k('raw_days').insert(report.days.map((d) => ({ import_id: typeof imp === 'object' ? imp.id : imp, ...d })));
  await k('employees').insert({ code: '0901', name: 'Invented Person', office_id: 'indore', shift_code: 'G', calendar_id: 'india-day', updated_at: '2026-10-29' });

  try {
    const m = await buildMonth('2026-10');
    assert.equal(m.dataThrough, '2026-10-28');
    assert.equal(m.partial, true);
    assert.equal(m.records['0901']['2026-10-29'].code, 'F');
    assert.equal(m.records['0901']['2026-10-30'].code, 'F');
    // 1-26 Oct are not in this small file: working days are "Missing record", weekends are not flagged.
    assert.equal(m.records['0901']['2026-10-25'].code, 'WO');
    assert.ok(!m.issues.some((x) => x.date === '2026-10-25'));
    assert.ok(!m.issues.some((x) => x.date >= '2026-10-29'));
    assert.ok(m.issues.some((x) => x.date === '2026-10-28' && x.type === 'Unexplained absence'));
  } finally {
    await closeDb();
  }
});
