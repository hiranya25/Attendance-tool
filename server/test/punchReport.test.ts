import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRows } from '../src/import/punchReport.ts';
import { diff, span, monthDates } from '../src/engine/dates.ts';
import { deviceCode } from '../src/engine/monthBuilder.ts';

// Same layout as the punch system's export, with invented people.
const rows = [
  ['AMIPI INC'],
  ['Dept. Name', 'AMIPI - BT OFFICE', '', '', '', 'Report Month', '', 'September-2026'],
  ['Empcode', '0101', '', '', 'Name', 'Test Person'],
  ['Date', 'Day', 'Shift', 'IN', 'OUT', 'Work+OT', 'OT', 'Less Hrs', 'Status', 'Remark'],
  ['01/09/2026', 'Tue', 'G', '09:39', '18:28', '09:13', '00:13', '00:00', 'P', 'OT'],
  ['02/09/2026', 'Wed', 'G', '10:24', '--:--', '00:00', '00:00', '00:00', 'P', 'MIS-LT'],
  ['03/09/2026', 'Thu', 'X', '--:--', '--:--', '00:00', '00:00', '00:00', 'A', '--'],
  ['Total Hours', '', '', '', '', '9:13'],
  ['AMIPI INC'],
  ['Dept. Name', 'AMIPI REMOTE', '', '', '', 'Report Month', '', 'September-2026'],
  ['Empcode', '0102', '', '', 'Name', 'Other Person (Nick)'],
  ['Date', 'Day', 'Shift', 'IN', 'OUT', 'Work+OT', 'OT', 'Less Hrs', 'Status', 'Remark'],
  ['04/09/2026', 'Fri', 'D', '03:12', '12:31', '09:18', '00:18', '00:00', 'P/2', 'EI-OT'],
];

test('reads people, departments, month and days', () => {
  const r = parseRows(rows);
  assert.deepEqual(r.months, ['2026-09']);
  assert.deepEqual(r.employees['0102'], { name: 'Other Person (Nick)', department: 'AMIPI REMOTE' });
  assert.equal(r.days.length, 4);
  assert.deepEqual(r.days[0], { emp_code: '0101', date: '2026-09-01', shift: 'G', in_min: 579, out_min: 1108, work_min: 553, ot_min: 13, less_min: 0, status: 'P', remark: 'OT' });
  assert.equal(r.days[1].out_min, null);
  assert.equal(r.days[2].remark, '');
  assert.equal(r.days[3].status, 'P/2');
});

test('time and status helpers', () => {
  assert.equal(span(1380, 60), 120); // across midnight
  assert.equal(diff(585, 600), 15);
  assert.equal(diff(1430, 10), 20);
  assert.equal(monthDates('2026-02').length, 28);
  assert.equal(deviceCode('P/2'), 'HD');
  assert.equal(deviceCode('WO'), 'WO');
});
