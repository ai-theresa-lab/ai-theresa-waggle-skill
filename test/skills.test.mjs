// Structural checks for the plugin's skills: frontmatter, limits from the Agent Skills spec, and that every file a
// skill links through ${CLAUDE_PLUGIN_ROOT} / ${CLAUDE_SKILL_DIR} exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'plugins', 'theresa-waggle');
const SKILLS = readdirSync(join(ROOT, 'skills'));
const ALLOWED_KEYS = new Set(['name', 'description', 'argument-hint', 'disable-model-invocation', 'allowed-tools']);

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text.replace(/\r\n/g, '\n'));
  assert.ok(m, 'frontmatter block');
  const keys = {};
  for (const line of m[1].split('\n')) { const k = /^([a-z-]+):\s*(.*)$/.exec(line); if (k) keys[k[1]] = k[2]; }
  return { keys, body: text.slice(m[0].length) };
}

test('the plugin has the four skills', () => {
  assert.deepEqual(SKILLS.sort(), ['ask', 'fix', 'report', 'scan']);
});

for (const skill of SKILLS) {
  test(`skill ${skill}: frontmatter, limits, links`, () => {
    const text = readFileSync(join(ROOT, 'skills', skill, 'SKILL.md'), 'utf8');
    const { keys, body } = frontmatter(text);
    for (const k of Object.keys(keys)) assert.ok(ALLOWED_KEYS.has(k), `unexpected key ${k}`);
    assert.equal(keys.name, skill);
    assert.match(keys.name, /^[a-z0-9-]{1,64}$/);
    assert.doesNotMatch(keys.name, /anthropic|claude/);
    const desc = JSON.parse(keys.description);
    assert.ok(desc.length > 50 && desc.length <= 1024, `description length ${desc.length}`);
    assert.ok(body.split('\n').length < 500, 'body under 500 lines');
    assert.match(text, /safety\.md/, 'every skill points at the safety rules');
    for (const m of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)) assert.ok(existsSync(join(ROOT, m[1])), `missing ${m[1]}`);
    assert.doesNotMatch(text, /[㐀-鿿]/, 'English only');
  });
}

test('the costly skills only run when the user invokes them', () => {
  for (const s of ['scan', 'fix']) {
    const { keys } = frontmatter(readFileSync(join(ROOT, 'skills', s, 'SKILL.md'), 'utf8'));
    assert.equal(keys['disable-model-invocation'], 'true', s);
  }
});

test('every skill replies in English by default and in Chinese only when asked in Chinese', () => {
  for (const s of SKILLS) {
    const text = readFileSync(join(ROOT, 'skills', s, 'SKILL.md'), 'utf8');
    assert.match(text, /\*\*Language:\*\* reply in English by default\. Only when the user writes the request in Chinese, reply in Chinese/, s);
    assert.doesNotMatch(text, /their language|user'?s language|in the user's/i, s);
  }
});

// Anthropic plugin directory requirements (claude.com/docs/plugins/pre-submission-checklist): the installed plugin
// folder carries its own README (40+ words outside code blocks) and license, and a top-level bin/ keeps the listing
// to Claude Code (chat and Cowork cannot run the engine).
test('the plugin folder meets the directory checklist', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8').replace(/```[\s\S]*?```/g, '');
  assert.ok(readme.split(/\s+/).filter(Boolean).length >= 40, 'README of at least 40 words');
  assert.match(readme, /accel-scope-telemetry-[\w.-]+\.run\.app/, 'README names the telemetry endpoint');
  assert.ok(existsSync(join(ROOT, 'LICENSE')) && existsSync(join(ROOT, 'NOTICE')), 'LICENSE and NOTICE');
  assert.equal(readFileSync(join(ROOT, 'LICENSE'), 'utf8'), readFileSync(join(ROOT, '..', '..', 'LICENSE'), 'utf8'));
  assert.ok(existsSync(join(ROOT, 'bin', 'waggle.mjs')), 'launcher in bin/');
  const manifest = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.match(manifest.name, /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/);
  for (const k of ['description', 'author', 'version', 'license', 'displayName']) assert.ok(manifest[k], k);
  const bad = readdirSync(ROOT, { recursive: true }).filter((f) => /(^|[\/])(\.DS_Store|Thumbs\.db|desktop\.ini|__MACOSX)$/.test(f));
  assert.deepEqual(bad, [], 'no OS junk files');
});

test('package.json and plugin.json carry the same version', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, '..', '..', 'package.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(pkg.version, manifest.version);
});
