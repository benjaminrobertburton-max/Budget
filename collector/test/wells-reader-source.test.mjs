import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('Wells reader keeps source-context capture bounded and private', async () => {
  const reader = await readFile(fileURLToPath(new URL('../chrome-bridge/wells-page-state.js', import.meta.url)), 'utf8');
  assert.match(reader, /const labels = \{ "available balance": "available", "current posted balance": "ledger"/);
  assert.match(reader, /depth < 4/);
  assert.match(reader, /accountSuffix: match \? match\[1\] : null/);
  assert.match(reader, /nextPage: !next\.length \? "next_unavailable"/);
  assert.match(reader, /captureAfterPageTurn/);
  assert.match(reader, /pageToken/);
  assert.doesNotMatch(reader, /document\.cookie|localStorage|sessionStorage|\.value/);
});
