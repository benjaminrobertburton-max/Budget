import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('Wells pagination is available for an absent anchor but never auto-sweeps history', async () => {
  const worker = await readFile(fileURLToPath(new URL('../chrome-bridge/background.js', import.meta.url)), 'utf8');
  assert.match(worker, /async function navigateNextActivityPage/);
  assert.match(worker, /capture_wells_after_next/);
  assert.match(worker, /never sweep account history merely because Next is available/);
  assert.doesNotMatch(worker, /message\.candidate\.source\?\.nextPage === "next_enabled"\)\s*\n\s*void navigateNextActivityPage/);
  assert.match(worker, /setTimeout\(\(\) =>/);
  assert.doesNotMatch(worker, /document\.cookie|localStorage|sessionStorage|querySelector\(['"]input/);
});
