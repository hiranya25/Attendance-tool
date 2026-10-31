import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Month end: half-day emails, no emails during the month, and the PDF + Excel package.
test('month end: half-day email, no in-month emails, PDF and Excel saved', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-'));
  const cfg = path.join(dir, 'config.json');
  fs.writeFileSync(cfg, JSON.stringify({ database: { client: 'better-sqlite3', filename: path.join(dir, 'db.sqlite') }, storageDir: path.join(dir, 'storage'), sendEmail: false }));
  process.env.ATTENDANCE_CONFIG = cfg;
  process.env.ATTENDANCE_TODAY = '2026-11-05';
  const { parseRows } = await import('../src/import/punchReport.ts');
  const { db, closeDb } = await import('../src/db.ts');
  const { buildMonth } = await import('../src/engine/monthBuilder.ts');
  const { sendReminders, sendDigest, buildPackage } = await import('../src/jobs.ts');

  const day = (d: number, status: string) => {
    const date = `${String(d).padStart(2, '0')}/10/2026`;
    return status === 'P'
      ? [date, 'Thu', 'G', '09:31', '18:35', '09:04', '00:00', '00:00', 'P', '--']
      : [date, 'Thu', 'X', '--:--', '--:--', '00:00', '00:00', '00:00', status, '--'];
  };
  const report = parseRows([
    ['Dept. Name', 'AMIPI - BT OFFICE', '', '', '', 'Report Month', '', 'October-2026'],
    ['Empcode', '0901', '', '', 'Name', 'Invented Person'],
    ['Date', 'Day', 'Shift', 'IN', 'OUT', 'Work+OT', 'OT', 'Less Hrs', 'Status', 'Remark'],
    day(27, 'P'), day(28, 'A'), day(29, 'A'), day(30, 'P'),
  ]);
  const k = await db();
  const [imp] = await k('imports').insert({ month: '2026-10', file_name: 't.xls', stored_path: '', source: 'upload', imported_at: '2026-11-01T10:00', imported_by: 'test', people: 1, days: 4 }).returning('id');
  await k('raw_days').insert(report.days.map((d) => ({ import_id: typeof imp === 'object' ? imp.id : imp, ...d })));
  await k('employees').insert({ code: '0901', name: 'Invented Person', office_id: 'indore', shift_code: 'G', calendar_id: 'india-day', email: 'invented@example.com', updated_at: '2026-10-29' });
  const email = { from_addr: 'invented@example.com', subject: 'Leave', body: '', is_attendance: 1, emp_code: '0901', confidence: 95, processed_at: '2026-10-28T09:00' };
  await k('emails').insert({ ...email, graph_id: 'a', received_at: '2026-10-28T09:00', kind: 'sick_leave', dates: '["2026-10-28"]', half_day: 1 });
  await k('emails').insert({ ...email, graph_id: 'b', received_at: '2026-10-29T09:00', kind: 'sick_leave', dates: '["2026-10-29"]', half_day: 0 });

  try {
    const m = await buildMonth('2026-10');
    assert.equal(m.records['0901']['2026-10-28'].code, 'HD', 'a half-day email makes the day a half day');
    assert.equal(m.records['0901']['2026-10-29'].code, 'LV', 'a full-day email makes the day leave');

    // Reminders and the daily summary are off by default: nothing is sent or recorded during the month.
    assert.match(await sendReminders(), /Turned off/);
    assert.match(await sendDigest(), /Turned off/);
    assert.equal(Number((await k('notifications').count({ n: '*' }))[0].n), 0);

    const r = await buildPackage('2026-10', 'Month closed');
    const pdf = r.file.replace(/\.xlsx$/, '.pdf');
    assert.ok(fs.existsSync(r.file), 'Excel saved');
    assert.ok(fs.existsSync(pdf), 'PDF saved');
    assert.equal(fs.readFileSync(pdf).subarray(0, 5).toString(), '%PDF-');
    const after = await buildMonth('2026-10');
    assert.equal(after.close.reports?.[0]?.hasPdf, true);
  } finally {
    await closeDb();
  }
});
