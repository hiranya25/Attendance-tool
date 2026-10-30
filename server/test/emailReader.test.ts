import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson } from '../src/ai/emailReader.ts';

test('reads JSON from a reply with reasoning and code fences', () => {
  const r = extractJson('<think>Sender is 0002, tomorrow is 30 Oct.</think>\n```json\n{"is_attendance":true,"kind":"sick_leave","dates":["2026-10-30"]}\n```');
  assert.equal(r.kind, 'sick_leave');
  assert.deepEqual(r.dates, ['2026-10-30']);
});

test('reports a reply without JSON clearly', () => {
  assert.throws(() => extractJson('Sorry, I cannot help with that.'), /did not contain JSON/);
});
