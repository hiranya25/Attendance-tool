import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('password rule: at least 8 characters with a number', async () => {
  const { passwordProblem } = await import('../src/api/auth.ts');
  assert.ok(passwordProblem('short1'));
  assert.ok(passwordProblem('longpassword'));
  assert.equal(passwordProblem('longpass1'), null);
  assert.equal(passwordProblem('12345678'), null);
});

test('sign-in pauses after 5 wrong passwords, and a reset clears it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-auth-'));
  const cfg = path.join(dir, 'config.json');
  fs.writeFileSync(cfg, JSON.stringify({ database: { client: 'better-sqlite3', filename: path.join(dir, 'db.sqlite') }, storageDir: path.join(dir, 'storage') }));
  process.env.ATTENDANCE_CONFIG = cfg;
  const { createUser, signIn, resetPassword } = await import('../src/api/auth.ts');
  const { closeDb } = await import('../src/db.ts');
  const res = { setHeader: () => undefined } as never;
  try {
    await assert.rejects(createUser('A', 'a@example.com', 'nonumbers', 'admin'), /at least one number/);
    const id = await createUser('A', 'a@example.com', 'goodpass1', 'admin');
    for (let i = 0; i < 5; i++) await assert.rejects(signIn(res, 'a@example.com', 'wrong', '1.2.3.4'), /do not match/);
    await assert.rejects(signIn(res, 'a@example.com', 'goodpass1', '1.2.3.4'), /paused/);
    await resetPassword(id, 'newpass22');
    const u = await signIn(res, 'a@example.com', 'newpass22', '1.2.3.4');
    assert.equal(u.email, 'a@example.com');
  } finally {
    await closeDb();
  }
});
