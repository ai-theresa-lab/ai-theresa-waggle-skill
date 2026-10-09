import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ENGINE, engineDir, engineReady, nodeOk, waggleHome } from '../plugins/waggle/scripts/waggle.mjs';

test('the engine pin is a release tag and a full commit hash', () => {
  assert.match(ENGINE.tag, /^v\d+\.\d+\.\d+$/);
  assert.equal(ENGINE.tag, `v${ENGINE.version}`);
  assert.match(ENGINE.commit, /^[0-9a-f]{40}$/, 'pin the exact commit of the tag');
  assert.match(ENGINE.repo, /^https:\/\/github\.com\/ai-theresa-lab\/ai-theresa-waggle\.git$/);
});

test('nodeOk requires Node.js 22.7+', () => {
  for (const v of ['22.7.0', '22.20.0', '23.0.0', '24.1.0']) assert.equal(nodeOk(v), true, v);
  for (const v of ['22.6.9', '20.11.0', '18.0.0']) assert.equal(nodeOk(v), false, v);
});

test('engine location follows WAGGLE_HOME and the pinned version', () => {
  assert.equal(waggleHome({ WAGGLE_HOME: '/x' }), '/x');
  assert.equal(engineDir({ WAGGLE_HOME: '/x' }), join('/x', 'engine', ENGINE.version));
});

test('engineReady needs the install marker for the pinned commit, node_modules and the CLI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'waggle-engine-'));
  try {
    assert.equal(engineReady(dir), false);
    mkdirSync(join(dir, 'node_modules')); mkdirSync(join(dir, 'bin'));
    writeFileSync(join(dir, 'bin', 'waggle.mjs'), '');
    writeFileSync(join(dir, '.waggle-install.json'), JSON.stringify({ commit: 'f'.repeat(40) }));
    assert.equal(engineReady(dir), ENGINE.commit === 'f'.repeat(40), 'a different commit is not ready');
    writeFileSync(join(dir, '.waggle-install.json'), JSON.stringify({ commit: ENGINE.commit }));
    assert.equal(engineReady(dir), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
