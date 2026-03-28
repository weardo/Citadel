# Wave 1 Discovery Relay — v3-hardening

## Agent: data-layer
**Files:** scripts/telemetry-schema.js (new), scripts/telemetry-stats.js (new), scripts/health.js (new), scripts/telemetry-log.cjs (updated), scripts/telemetry-report.cjs (updated), docs/token-economics-methodology.md (new)
**Key facts for Wave 2:**
- SCHEMA_VERSION = 1; every entry now has `schema: 1` field
- Valid agent-run event types: agent-start, agent-complete, agent-fail, campaign-start, campaign-complete, wave-start, wave-complete, agent-timeout
- `hook-timing.jsonl` shape: { schema, timestamp, hook, event: 'timing'|'counter', metric, duration_ms }
- `audit.jsonl` shape: { schema, timestamp, event, project, ...data }
- Shared module `telemetry-stats.js` does all file reading; both health.js and telemetry-report.cjs use it
- `health.js` runs via `node scripts/health.js` — outputs JSON to stdout; smoke-tested successfully
- `telemetry-report.cjs --tokens` now shows Token Economics section
- harness-health-util.js STILL writes without schema: 1 field — out of scope, flagged for follow-up

## Agent: templates
**Files:** .planning/_templates/campaign.md, .planning/_templates/fleet-session.md
**YAML frontmatter format — campaign.md:**
```yaml
---
version: 1
status: active
started: "{ISO timestamp}"
direction: "{one-line summary}"
phase_count: 0
current_phase: 1
---
```
**YAML frontmatter format — fleet-session.md:**
```yaml
---
version: 1
status: active
started: "{ISO timestamp}"
direction: "{one-line summary}"
wave_count: 0
current_wave: 1
agents_total: 0
agents_complete: 0
---
```
- Comment blocks added after frontmatter explaining each field
- Example section in fleet-session.md preserved intact

## Agent: hooks-hardening
**Files:** hooks_src/protect-files.js, hooks_src/circuit-breaker.js, hooks_src/quality-gate.js, hooks_src/external-action-gate.js, hooks_src/intake-scanner.js, hooks_src/init-project.js
**Key facts for Wave 2:**
- CITADEL_UI=true env var → hooks emit JSON envelope: { hook, action, message, timestamp, data }
- governance.js had NO stdout output — no change needed there
- 5 hooks updated; each has inline `hookOutput()` helper
- `doc-sync.js`, `post-edit.js`, `pre-compact.js`, `post-compact.js`, `restore-compact.js`, `stop-failure.js` all have stdout.write calls but were out-of-scope — need a follow-up pass
- init-project.js: auto-sweep runs AFTER .planning/ dirs created, BEFORE scripts copy
- Version gate: `.citadel/version.txt` stores plugin version; scripts only copied on version mismatch
- protect-files.js: ** glob now implemented via regex; src/** and **/*.ts both work
