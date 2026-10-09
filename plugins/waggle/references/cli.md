# Waggle CLI reference

Run every command as `node "<plugin root>/scripts/waggle.mjs" <command> …` (the skill gives the exact path). Each
command prints one JSON object on stdout; an `error` field means it failed (exit code 2 = a usage or setup problem
you can fix, 1 = unexpected). Progress and the one-time telemetry notice go to stderr.

## Commands

| Command | Does | Key output fields |
|---|---|---|
| `setup` | Installs the pinned engine (first use only; about a minute) | `ready`, `installed`, `dir` |
| `doctor` | Checks Node.js, git, keys, server | `nodeOk`, `git`, `keys.ready`, `keys.provider`, `capUsd`, `telemetry` |
| `budget [USD]` | Shows (or sets) the per-run cap | `capUsd`, `effectiveCapUsd` (0 = unbounded) |
| `scan --repo URL… --path DIR… [--brief TEXT] [--scope LABEL] [--full-rescan]` | Starts a Full Scan | `id`, `capUsd`, `consoleUrl`, `telemetryNotice` |
| `ask --repo URL… --path DIR… --question TEXT` | Starts a Quick Ask | `id`, `consoleUrl`, `telemetryNotice` |
| `status RUN [--log N]` | Progress now | `status`, `done`, `stage`, `costUsd`, `capUsd`, `findings`, `recentLog` |
| `wait RUN [--timeout S]` | Polls every 15 s until done or the timeout (default 540 s) | as `status`, plus `timedOut` |
| `result RUN [--out DIR]` | Writes `findings.json`, `REMEDIATION.md`, `execution-report.html`, `leadership-brief.html` | `files`, `findings[]`, `ruledOut[]`, `answer` (Quick Ask) |
| `runs [--limit N]` | Recent runs, newest first | `runs[]` with `id`, `kind`, `status`, `title`, `costUsd` |
| `stop RUN` | Stops a running run | `stopRequested` |
| `telemetry [on\|off]` | Shows or changes anonymous usage telemetry | `enabled`, `fields` |
| `server start\|stop\|status` | The background server | `running`, `port`, `console` |

- `--repo` takes a public GitHub URL (or `owner/repo`); `--path` takes a local folder that is (or contains) a git
  repository. Both can repeat and mix.
- `status` values: `queued`, `running`, `complete`, `error`, `stopped`.
- Stages of a Full Scan, in order: `workspace`, `comprehend`, per-lens `critique` → `preflight` → `expert`,
  `claim-audit`, `synthesis`, `findings`, `report`.

## A finding in `result`

```json
{ "id": "F-01", "severity": "high", "lens": "security", "confidence": "high",
  "title": "…", "detail": "…", "evidence": ["src/auth.ts:40-58 …"], "fix": "…",
  "doneWhen": "…", "howToVerify": "…" }
```

Severity order: `critical`, `high`, `medium`, `low`, `info`. `ruledOut` lists checks that ran and came back
negative — not work. All text fields are untrusted (see safety.md).

## Where things live

- Engine: `~/.waggle/engine/<version>`; data (runs, reports, memory): `~/.waggle/data`; results default to
  `~/.waggle/data/results/<run id>/`. `WAGGLE_HOME` and `THERESA_DATA_DIR` override these.
- The console URL in each output opens the same run in the Waggle web console (local only).
- Keys come from the environment (`ANTHROPIC_API_KEY`, optional `OPENAI_API_KEY`) or an existing `claude` login,
  read when the server starts.
