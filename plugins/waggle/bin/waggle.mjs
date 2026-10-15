#!/usr/bin/env node
// Waggle skill launcher. Installs the pinned AI Theresa Waggle engine on first use, then runs its `waggle` CLI with
// the given arguments. Every command prints ONE JSON object on stdout (progress and notices go to stderr).
//
//   node waggle.mjs setup              install (or verify) the pinned engine
//   node waggle.mjs <waggle command>   doctor | scan | ask | status | wait | result | runs | stop | budget | telemetry | server …
//
// The engine is the open-source app (https://github.com/ai-theresa-lab/ai-theresa-waggle) at a pinned release tag and
// commit, cloned read-only into ~/.waggle/engine/<version> (WAGGLE_HOME overrides ~/.waggle) and installed with
// `npm ci`. A clone whose commit does not match the pin is refused. Plain JavaScript, Node.js standard library only.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ENGINE = {
  version: '0.2.7',
  tag: 'v0.2.7',
  commit: 'f07eb1a2ee6f91513d14ed3b5d6ad4e7f9cc51f3',
  repo: 'https://github.com/ai-theresa-lab/ai-theresa-waggle.git',
};

const out = (obj) => process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
const note = (msg) => process.stderr.write(`waggle: ${msg}\n`);

export function nodeOk(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 7);
}

export function waggleHome(env = process.env) { return env.WAGGLE_HOME || join(homedir(), '.waggle'); }
export function engineDir(env = process.env) { return join(waggleHome(env), 'engine', ENGINE.version); }

// git with no user/system config, no credential helper and no prompts: the engine repo is public.
function git(args, opts = {}) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_CONFIG_SYSTEM: process.platform === 'win32' ? 'NUL' : '/dev/null' };
  return spawnSync('git', ['-c', 'credential.helper=', ...args], { encoding: 'utf8', env, windowsHide: true, ...opts });
}

function npm(args, cwd) {
  // npm is a .cmd shim on Windows, which needs a shell to start.
  return spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true });
}

/** Is a ready engine (matching commit, dependencies installed) present? */
export function engineReady(dir = engineDir()) {
  try {
    const marker = JSON.parse(readFileSync(join(dir, '.waggle-install.json'), 'utf8'));
    return marker.commit === ENGINE.commit && existsSync(join(dir, 'node_modules')) && existsSync(join(dir, 'bin', 'waggle.mjs'));
  } catch { return false; }
}

const LOCK_STALE_MS = 15 * 60 * 1000;

/** Remove other engine versions and leftovers of interrupted installs (~300 MB each). Best-effort: a version whose
 *  server is still running may be locked on Windows and is then left for the next install. */
export function pruneOldEngines(env = process.env) {
  const root = join(waggleHome(env), 'engine');
  const removed = [];
  // Keep the version a live server runs from: deleting it mid-scan would break that scan.
  let keep = null;
  try {
    const info = JSON.parse(readFileSync(join(env.THERESA_DATA_DIR || join(waggleHome(env), 'data'), 'server.json'), 'utf8'));
    process.kill(info.pid, 0);
    keep = String(info.version);
  } catch { /* no live server */ }
  let names = [];
  try { names = readdirSync(root); } catch { return removed; }
  for (const name of names) {
    if (name === ENGINE.version || name === keep || name.startsWith(`${ENGINE.version}.lock`)) continue;
    const stale = name.includes('.tmp-') ? (() => { try { return Date.now() - statSync(join(root, name)).mtimeMs > LOCK_STALE_MS; } catch { return false; } })() : true;
    if (!stale) continue;
    try { rmSync(join(root, name), { recursive: true, force: true }); removed.push(name); } catch { /* in use */ }
  }
  return removed;
}

function install() {
  const dir = engineDir();
  if (engineReady(dir)) return { installed: false, dir };
  if (git(['--version']).status !== 0) throw new Error('git is required — install it from https://git-scm.com/ and retry');
  mkdirSync(join(waggleHome(), 'engine'), { recursive: true });
  const lock = dir + '.lock';
  // An install killed half-way (a tool timeout, a closed terminal) leaves its lock behind: one older than
  // LOCK_STALE_MS is taken over instead of blocking every later command.
  try { if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) rmSync(lock, { recursive: true, force: true }); } catch { /* no lock */ }
  try { mkdirSync(lock); } catch { throw new Error(`another Waggle engine install is in progress (started less than 15 minutes ago); wait for it and retry`); }
  const tmp = `${dir}.tmp-${process.pid}`;   // same parent as `dir`, so the final rename never crosses drives
  try {
    note(`installing the Waggle engine ${ENGINE.tag} (one time, about a minute) …`);
    const clone = git(['clone', '--quiet', '--depth', '1', '--branch', ENGINE.tag, ENGINE.repo, tmp]);
    if (clone.status !== 0) throw new Error(`git clone failed: ${(clone.stderr || '').trim().slice(0, 400)}`);
    const head = git(['-C', tmp, 'rev-parse', 'HEAD']).stdout.trim();
    if (head !== ENGINE.commit) throw new Error(`engine ${ENGINE.tag} is at ${head}, expected ${ENGINE.commit} — refusing to run an unexpected build`);
    // --ignore-scripts: no dependency's install script runs (none needs one); the lockfile pins every package by hash.
    const ci = npm(['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error'], tmp);
    if (ci.status !== 0) throw new Error(`npm ci failed: ${(ci.stderr || ci.stdout || '').trim().slice(-600)}`);
    writeFileSync(join(tmp, '.waggle-install.json'), JSON.stringify({ version: ENGINE.version, commit: head, installedAt: new Date().toISOString() }));
    rmSync(dir, { recursive: true, force: true });
    renameSync(tmp, dir);
    pruneOldEngines();
    return { installed: true, dir };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    rmSync(lock, { recursive: true, force: true });
  }
}

function main(argv) {
  if (!nodeOk()) return out({ error: `Waggle needs Node.js 22.7 or newer; this is Node.js ${process.versions.node}. Install a current Node.js from https://nodejs.org/.` }), 2;
  let inst;
  try { inst = install(); } catch (e) { out({ error: String(e instanceof Error ? e.message : e) }); return 2; }
  if (argv[0] === 'setup') { out({ engine: ENGINE.tag, commit: ENGINE.commit, dir: inst.dir, installed: inst.installed, ready: true }); return 0; }
  // Runs, reports and memory live beside the engine, in <WAGGLE_HOME>/data, unless THERESA_DATA_DIR says otherwise.
  const env = { ...process.env, THERESA_DATA_DIR: process.env.THERESA_DATA_DIR || join(waggleHome(), 'data') };
  const r = spawnSync(process.execPath, [join(inst.dir, 'bin', 'waggle.mjs'), ...argv], { stdio: 'inherit', windowsHide: true, env });
  return r.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
