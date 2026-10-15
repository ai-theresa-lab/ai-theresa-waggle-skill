# AI Theresa Waggle for Claude Code

Evidence-backed, read-only audits of your code from inside Claude Code. Waggle's agents pose falsifiable problems
about your system, measure each one against the code, and an adversarial audit re-checks every claim, so only findings
with file-and-line evidence reach you. This plugin brings the open-source
[AI Theresa Waggle](https://github.com/ai-theresa-lab/ai-theresa-waggle) engine to Claude Code as four skills.

**Claude Code only.** The engine runs on your machine and needs Node.js 22.7+, git and network access.

## Skills

| Skill | What it does | Cost (your Anthropic account) |
|---|---|---|
| `/waggle:scan [repo or folder] [focus]` | Full Scan: a team of read-only agents audits the code (security, architecture, release engineering, business logic and more), 20–40 minutes in the background. Asks for your go-ahead with its cost and cap first. | typically $5–30, capped (default $20) |
| `/waggle:ask [repo or folder] [question]` | Quick Ask: one agent answers one concrete question with cited evidence. | about $0.30–1 |
| `/waggle:report [run id]` | Progress of a running scan, or the findings and report locations of a finished one. | free |
| `/waggle:fix [run id] [finding ids]` | Re-verifies each finding against the current code and fixes the confirmed ones on a `waggle/fix-…` branch, one commit per finding, asking before each step. | your normal Claude Code usage |

Each scan writes a Leadership brief, an Execution report and a `REMEDIATION.md` to
`~/.waggle/data/results/<run id>/`, plus a local console page (127.0.0.1) to watch it live.

## What this plugin runs, sends and fetches

- **Installs the engine on first use.** `bin/waggle.mjs` (Node.js standard library only) clones one pinned release of
  `https://github.com/ai-theresa-lab/ai-theresa-waggle.git` into `~/.waggle/engine/<version>`, refuses any commit that
  does not match the pin, and installs its dependencies with `npm ci --ignore-scripts` from the engine's lockfile
  (registry.npmjs.org). It also removes older engine versions it installed there.
- **Runs a local server.** The engine runs as a background process bound to 127.0.0.1; the skills talk to it through
  the launcher. Nothing listens on other interfaces.
- **Uses your model credentials.** The engine's agents call Anthropic with `ANTHROPIC_API_KEY` from your environment
  or your existing `claude` login (a Claude subscription), and, only if `OPENAI_API_KEY` is set, OpenAI for report
  writing. Keys are read by the engine at call time; the plugin never prints, stores or sends them anywhere else.
- **Reads the code you choose.** A scan reads the local folder or public GitHub repository you name (public repos are
  cloned from github.com). The agents can only read and search it: no shell, no writes, no network.
- **Sends anonymous usage telemetry** (on by default, announced on first use) to
  `https://accel-scope-telemetry-355207447672.us-central1.run.app/v1/events`: a random install id, engine version,
  OS / CPU architecture / Node.js major version, the run type and outcome, the hour it ran, duration, a coarse cost
  range, finding counts, the built-in lenses, source kinds and stages that degraded, and which kind of key was used
  (for example "claude-subscription"). Never code, repository names, paths, questions, findings or keys. Turn it off
  with `THERESA_TELEMETRY=0` or by running `waggle telemetry off` through the plugin.
- **Edits code only in `/waggle:fix`**, on a separate branch, with your approval at each step; it never pushes.

Scanned code is treated as untrusted data: everything the CLI returns from a scan is marked `untrusted`, and the
skills tell Claude to show it, never to follow instructions inside it.

## Install

```text
/plugin marketplace add ai-theresa-lab/ai-theresa-waggle-skill
/plugin install waggle@ai-theresa
```

Full documentation, privacy details and limitations:
[github.com/ai-theresa-lab/ai-theresa-waggle-skill](https://github.com/ai-theresa-lab/ai-theresa-waggle-skill).
License: Apache-2.0 (see `LICENSE` and `NOTICE` in this folder).
