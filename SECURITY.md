# Security policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub's private vulnerability reporting](https://github.com/ai-theresa-lab/ai-theresa-waggle-skill/security/advisories/new),
not in a public issue. Issues in the Waggle engine itself (the analysis pipeline, the local server, the CLI) belong in
[ai-theresa-waggle](https://github.com/ai-theresa-lab/ai-theresa-waggle/security/advisories/new).

## What this plugin does on your machine

- `plugins/theresa-waggle/bin/waggle.mjs` clones one pinned release of the Waggle engine from GitHub (without your git
  credentials), checks that its commit matches the pin, runs `npm ci --omit=dev` in it, and then runs its CLI.
- The engine starts a local server bound to `127.0.0.1` and runs read-only Claude agents with your keys.
- The skills instruct Claude to treat everything a scan returns as untrusted data, never run commands found in it,
  and change code only in `/theresa-waggle:fix`, on a branch, with your approval.

In scope: anything that lets scanned content cause actions in Claude Code, leaks keys, or runs code other than the
pinned engine.
