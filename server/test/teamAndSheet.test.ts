import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchTeam, parseTeamList, isTeamList, officeFor } from '../src/import/teamList.ts';
import { isDailySheet, parseDailySheet } from '../src/import/dailySheet.ts';

// Invented people, written the way the real lists write them.
const known = [
  { id: '0001', name: 'Ravi Kumar', aliases: '', officeId: 'indore' },
  { id: '0002', name: 'Meena Rao (Mimi)', aliases: 'Mimi', officeId: 'remote' },
  { id: '0003', name: 'Arjun D Costa', aliases: '', officeId: 'remote' },
  { id: '0004', name: 'Kiran Shah', aliases: '', officeId: 'indore' },
  { id: '0005', name: 'Kiran Patel', aliases: '', officeId: 'indore' },
  { id: '0006', name: 'Zoya Ali (Zee)', aliases: 'Zee', officeId: 'remote' },
  { id: 'MUM-NIKHIL', name: 'Nikhil', aliases: '', officeId: 'mumbai' },
];
const sheet = [
  ['NAME', 'MANAGER', 'Work Hours', 'LOCATION', 'Amipi Email', 'Ext', 'Job Role'],
  ['RAVI KUMAR', 'Asha', 'Full Time', 'INDORE', 'ravi@example.com', '1', 'ACCOUNTS'],
  ['MIMI (Meena Rao)', 'Asha', 'Full Time', 'REMOTE', 'mimi@example.com', '', 'SALES'],
  ['ARJUN DCOSTA', 'Asha', 'Full Time', 'MUMBAI/DUBAI', 'arjun@example.com', '', 'SALES'],
  ['Kiran Patel', 'Asha', 'Day Time', 'Indore', 'kiran@example.com', '', 'WEB'],
  ['ZEE MALIK', 'Asha', 'Full Time', 'INDORE', 'zee@example.com', '', 'ADMIN'],
  ['NIKHIL JOSHI', 'Asha', 'Full Time', 'MUMBAI', 'nikhil@example.com', '', 'BUYER'],
  ['BOSS PERSON', 'Asha', 'NA', 'NEW YORK', 'boss@example.com', '', 'PRESIDENT'],
];

test('team list rows are read by their headers', () => {
  assert.ok(isTeamList(sheet));
  const rows = parseTeamList(sheet);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows[0], { name: 'RAVI KUMAR', manager: 'Asha', workHours: 'Full Time', location: 'INDORE', email: 'ravi@example.com', role: 'ACCOUNTS' });
  assert.equal(officeFor('NEWYORK'), 'newyork');
  assert.equal(officeFor('MUMBAI/DUBAI'), 'mumbai');
});

test('team list names link to the right people', () => {
  const rows = parseTeamList(sheet);
  const m = matchTeam(rows, known);
  const linked = Object.fromEntries([...m].map(([i, id]) => [rows[i].name, id]));
  assert.equal(linked['RAVI KUMAR'], '0001'); // same name, different case
  assert.equal(linked['MIMI (Meena Rao)'], '0002'); // nickname and name swapped
  assert.equal(linked['ARJUN DCOSTA'], '0003'); // spelled slightly differently
  assert.equal(linked['Kiran Patel'], '0005'); // first name shared by two people: needs the last name
  assert.equal(linked['ZEE MALIK'], '0006'); // known only by nickname
  assert.equal(linked['NIKHIL JOSHI'], 'MUM-NIKHIL'); // short name from a sheet, same office
  assert.equal(linked['BOSS PERSON'], undefined);
});

test('daily sheet: OK, late marks, absences and blanks', () => {
  const rows = [
    ['Date', 'Nikhil', 'Pooja', ''],
    ['01/09/2026', 'L1', 'OK', 'TUESDAY'],
    ['02/09/2026', 'OK', 'A', 'WEDNESDAY'],
    ['06/09/2026', '', '', 'SUNDAY'],
    ['', '', '', ''],
    ['A', '0', '1', 'LEAVE'],
  ];
  assert.ok(isDailySheet(rows));
  const s = parseDailySheet(rows);
  assert.deepEqual(s.names, ['Nikhil', 'Pooja']);
  assert.deepEqual(s.months, ['2026-09']);
  assert.equal(s.days.length, 4);
  assert.deepEqual(s.days.map((d) => `${d.name} ${d.date} ${d.status} ${d.remark}`), [
    'Nikhil 2026-09-01 P LT (L1)', 'Pooja 2026-09-01 P ', 'Nikhil 2026-09-02 P ', 'Pooja 2026-09-02 A ',
  ]);
});
