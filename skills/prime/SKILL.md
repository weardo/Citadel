---
name: prime
description: >-
  Session startup — load reference files, check recent activity, orient to
  project state and active campaigns. Run at the start of every session.
user-invocable: true
auto-trigger: false
---

# /prime — Session Startup

## Identity

Orient yourself at the start of every session. Do NOT start any implementation.

## Protocol

### Phase 1: Load Context

Read these files (skip any that don't exist):
1. `.planning/reference/MEMORY.md` — navigation index for reference files
2. `.planning/reference/session-learnings.md` — corrections and gotchas from past sessions
3. `CLAUDE.md` — project overview, conventions, commands
4. `.planning/specs/INDEX.md` — feature specs and their statuses

For each reference file listed in MEMORY.md where the "Read When" condition matches the current work area, read that file too.

### Phase 2: Check Recent Activity

Run:
```bash
git log --oneline -15
git status
```

Check `.planning/campaigns/` for active campaigns (not in `completed/`).
Check `.planning/telemetry/session-costs.jsonl` for recent session costs (if exists).

### Phase 3: Output Report

Present a structured report:

**Project State**
- Summary of recent changes (from git log)
- Any uncommitted work in progress

**Active Campaigns**
- List any active campaigns from `.planning/campaigns/` with current phase/status

**Specs Status**
- Table from INDEX.md showing features and their statuses
- Highlight any specs marked "In Progress" or "Draft"

**Recommended Next Work**
- Based on: specs index, git history, active campaigns, user focus area
- If active campaign exists: "Continue campaign with `/archon`"
- If draft specs exist: "Plan next feature with `/architect .planning/specs/<spec>.md`"

**Reference Files Loaded**
- List which reference files were loaded and why

## Rules
- Do NOT start any implementation. This is orientation only.
- Do NOT read reference files beyond MEMORY.md and session-learnings.md unless the "Read When" condition matches.
- Keep the report concise — tables, not paragraphs.
- If continuing a campaign, remind: "Run `/archon` to continue."

## Quality Gates

- Report must be factual — never fabricate file contents or test results
- Reference files loaded must actually exist (skip missing files gracefully)
- All file paths must be verified before referencing

## Exit Protocol

```
---HANDOFF---
- Session: oriented
- Active campaigns: {count}
- Reference files loaded: {list}
- Recommended: {next action}
---
```
