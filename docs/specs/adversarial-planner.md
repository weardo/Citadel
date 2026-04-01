# Citadel Fork — Adversarial Planner + Knowledge Compounding

**Status:** Draft
**Author:** weardo + Claude
**Date:** 2026-04-01
**Repo:** `~/Citadel` (fork of `SethGammon/Citadel` at `weardo/Citadel`)
**ADR:** `vault/decisions/adr-002-fork-citadel-for-brownfield-orchestration.md`

## 1. Goal

Upgrade the Citadel fork with (1) a multi-pass adversarial planner from astra that produces structured JSON work plans with dependency DAGs, (2) task-level execution in Archon that dispatches generators per-task with HARNESS_STATUS verification and multi-reviewer gates, and (3) a compounding knowledge system (MEMORY.md, session-learnings, /evolve) that makes each session faster than the last. General-purpose — works on any project, any stack.

## 2. Background

### What Citadel has (keep)

- 22 lifecycle hooks (governance, quality-gate, post-edit, circuit-breaker, cost-tracker, protect-files, consent, compact)
- Fleet/worktree coordination with discovery relay
- Daemon mode (RemoteTrigger chaining for multi-session execution)
- Campaign persistence (markdown with frontmatter)
- Telemetry (hook timing, audit logs, session costs)
- Trust/consent system (novice → familiar → trusted)
- 35+ skills (marshal, review, test-gen, doc-gen, refactor, scaffold, research, improve, learn, triage, etc.)
- init-project SessionStart scaffolding

### What Citadel lacks (build)

1. **Multi-pass plan review** — `/architect` is single-pass. No adversarial critique, no refinement loop, no validation gate. Plans for large features miss file conflicts, dependency gaps, and vague criteria that surface expensively during execution.

2. **Task-level execution** — Archon delegates whole phases to Marshal, which "wings it" dynamically. No pre-planned task graph → can't parallelize independent tasks, can't retry a single failed task, quality depends on Marshal's in-context reasoning.

3. **Compounding knowledge** — `.planning/knowledge/` is campaign-scoped (write-mostly). No domain-organized reference files (db-schema, api-patterns), no navigation index (MEMORY.md with "Read When"), no session-learnings that accumulate gotchas, no /evolve that updates references after each session.

4. **Spec-driven planning** — `/architect` reads PRDs or prompts but doesn't integrate with a structured spec system (specs with acceptance criteria, cross-cutting concerns, indexed tracking).

### Prior art ported into this fork

| Source | What we take |
|--------|-------------|
| **astra-plugin** (`weardo/astra`) | 4-pass planner pipeline (architect→adversary→refiner→validator), adaptive depth logic, JSON work plan format (phase/epic/story/task), generator agent with HARNESS_STATUS, failure-modes knowledge base, generator recovery protocol |
| **brain vault** (`~/brain`) | MEMORY.md navigation index, session-learnings.md, /evolve compounding engine, /prime session startup, cross-cutting concerns checklist, spec templates (11-section + INDEX.md) |
| **projectroot** (Seekora reference) | 3-tier cross-cutting enforcement (spec time / build time / verify time), 6-phase /validate, friction-driven CLAUDE.md rules, prime cache |

## 3. Architecture

### Data Flow: Planning

```
User input (spec OR prompt)
    │
    ├─ /architect SKILL.md orchestrates 4-pass pipeline:
    │
    │   ① architect agent (Opus)
    │   │  Reads: codebase (Grep/Glob), spec (if exists), CLAUDE.md, reference files
    │   │  Outputs: draft work_plan.json
    │   │
    │   ② adversary agent (Opus)
    │   │  Reads: draft work_plan.json
    │   │  Outputs: issues.json (file conflicts, missing deps, vague criteria, AI failure modes)
    │   │
    │   ③ refiner agent (Opus)
    │   │  Reads: draft work_plan.json + issues.json
    │   │  Outputs: refined work_plan.json (all issues addressed or rejected with reasoning)
    │   │
    │   ④ validator agent (Opus)
    │   │  Reads: refined work_plan.json + spec (if exists)
    │   │  Outputs: sign_off.json (DAG validity, spec coverage, file conflict check)
    │   │  If sign_off: false → loop back to ③ (max 1 retry)
    │   │
    │   Adaptive depth (from astra planner.py):
    │   │  ≤5 tasks:  architect → validator (light)
    │   │  6-19 tasks: architect → adversary → refiner → validator (standard)
    │   │  ≥20 tasks: architect → adversary → refiner → adversary → refiner → validator (double)
    │
    └─ Outputs:
         .planning/plans/{slug}.json     ← JSON work plan (source of truth)
         .planning/campaigns/{slug}.md   ← Campaign file (human-readable + Archon-executable)
```

### Data Flow: Execution (Modified Archon Step 3)

```
Archon reads campaign.md + .planning/plans/{slug}.json
    │
    ├─ For each phase in the JSON plan:
    │   │
    │   ├─ Group tasks by dependency layers:
    │   │   Layer 0: tasks with no depends_on (can run in parallel)
    │   │   Layer 1: tasks depending only on Layer 0 tasks
    │   │   Layer N: tasks depending on Layer N-1 tasks
    │   │
    │   ├─ For each layer:
    │   │   │
    │   │   ├─ Dispatch generator agents (parallel via Fleet for independent tasks)
    │   │   │   Each generator receives:
    │   │   │   - Task description + acceptance_criteria + steps
    │   │   │   - target_files scope
    │   │   │   - CLAUDE.md + reference files
    │   │   │   - Failure-modes knowledge base
    │   │   │   - Recovery protocol (check feedback.md, regression check)
    │   │   │   Must output HARNESS_STATUS block
    │   │   │
    │   │   ├─ Parse HARNESS_STATUS from each generator
    │   │   │   STATUS: COMPLETE → proceed to review
    │   │   │   STATUS: BLOCKED → log, skip, continue
    │   │   │   STATUS: WORKING → error (generator didn't finish)
    │   │   │
    │   │   ├─ Multi-reviewer verification (parallel):
    │   │   │   code-reviewer agent: patterns, security, error handling, scope
    │   │   │   test-runner agent: run test suite, report pass/fail
    │   │   │   ALL must approve → task marked complete
    │   │   │   ANY reject → task retries with feedback (max 3 attempts)
    │   │   │
    │   │   └─ Update campaign.md task progress table + JSON plan status
    │   │
    │   ├─ Archon Step 4 checks still run (direction alignment, quality spot-check, regression guard)
    │   │
    │   └─ Phase complete when all tasks in all layers are complete
    │
    └─ Campaign complete → Step 7 (completion, postmortem suggestion)
```

### Data Flow: Knowledge Compounding

```
Session start:
    /prime reads .planning/reference/MEMORY.md
    ├─ Loads session-learnings.md (always)
    ├─ Loads task-relevant reference files (based on "Read When" annotations)
    └─ Provides orientation report

Session end (after /commit-feature):
    /evolve reads git log since last evolve
    ├─ Categorizes changes: DB schema | API | UI | external services | bugs
    ├─ Updates corresponding reference files in .planning/reference/
    ├─ Appends gotchas to session-learnings.md
    ├─ Updates MEMORY.md if new reference files created
    └─ Suggests CLAUDE.md improvements (user approves)
```

### Key Interfaces

**work_plan.json** (astra format, source of truth):

```json
{
  "meta": {
    "slug": "add-auth",
    "spec": ".planning/specs/add-auth.md",
    "created": "2026-04-01T14:30:00Z",
    "planner_depth": "standard"
  },
  "phases": [{
    "id": "phase-0",
    "name": "Setup & Contracts",
    "epics": [{
      "id": "epic-001",
      "name": "Auth infrastructure",
      "stories": [{
        "id": "story-001",
        "name": "JWT middleware",
        "tasks": [{
          "id": "task-001",
          "description": "Create JWT verification middleware",
          "acceptance_criteria": [
            "GET /api/protected returns 401 without token",
            "GET /api/protected returns 200 with valid JWT",
            "Expired tokens return 401 with 'token expired' message"
          ],
          "steps": [
            "Read existing middleware patterns in src/middleware/",
            "Create src/middleware/auth.ts with verify function",
            "Write tests in tests/middleware/auth.test.ts"
          ],
          "depends_on": [],
          "target_files": ["src/middleware/auth.ts", "tests/middleware/auth.test.ts"],
          "status": "pending",
          "attempts": 0,
          "blocked_reason": null
        }]
      }]
    }]
  }]
}
```

**HARNESS_STATUS block** (mandatory generator output):

```
---HARNESS_STATUS---
STATUS: COMPLETE
FILES_MODIFIED: src/middleware/auth.ts, tests/middleware/auth.test.ts
TESTS_STATUS: 8/8 pass
EXIT_SIGNAL: false
RECOMMENDATION: proceed to task-002
---END_HARNESS_STATUS---
```

**campaign.md** (enhanced with task progress):

The existing Citadel campaign format stays, with an added Task Progress section:

```markdown
## Work Plan
Plan: .planning/plans/add-auth.json
Spec: .planning/specs/add-auth.md
Tasks: 15 total (3 complete, 1 in-progress, 11 pending)
Current Phase: phase-1 (Core Features)
Current Layer: 1

## Task Progress
| Task | Phase | Layer | Status | Attempts | Model | Files |
|------|-------|-------|--------|----------|-------|-------|
| task-001 | 0 | 0 | complete | 1 | sonnet | auth.ts, auth.test.ts |
| task-002 | 0 | 0 | complete | 1 | haiku | user.ts, migration.sql |
| task-003 | 1 | 1 | failed | 3 | sonnet | login.ts |
| task-004 | 1 | 1 | pending | 0 | — | — |
```

The existing sections (Phases, Phase End Conditions, Feature Ledger, Decision Log, Review Queue, Circuit Breakers, Active Context, Continuation State) all remain.

## 4. Data Model / DB Schema

No database. All state is file-based within `.planning/`:

### Extended `.planning/` Directory Structure

```
.planning/
├── campaigns/              # Campaign state (existing)
├── coordination/           # Collision prevention (existing)
├── fleet/                  # Parallel execution (existing)
├── intake/                 # Feature queue (existing)
├── postmortems/            # Campaign retrospectives (existing)
├── research/               # Research findings (existing)
├── screenshots/            # Visual verification (existing)
├── telemetry/              # Hook data (existing)
├── knowledge/              # Campaign-scoped patterns (existing, from /learn)
├── _templates/             # Templates (existing, extended)
│
├── plans/                  # NEW: JSON work plans (source of truth)
│   └── {slug}.json         #   Output of 4-pass planner
│
├── specs/                  # NEW: Feature specifications
│   ├── TEMPLATE.md         #   11-section spec template
│   └── INDEX.md            #   Spec registry with status tracking
│
└── reference/              # NEW: Compounding knowledge (domain-organized)
    ├── MEMORY.md           #   Navigation index with "Read When" annotations
    ├── session-learnings.md #  Corrections, gotchas (grows over time)
    ├── feature-dev-standards.md # Cross-cutting concerns checklist
    ├── architecture.md     #   System overview (generated from detection)
    └── [domain-specific].md #  db-schema, api-patterns, etc. (created by /evolve)
```

### State Files Per Run

| File | Location | Format | Created By | Read By |
|------|----------|--------|------------|---------|
| `work_plan.json` | `.planning/plans/{slug}.json` | JSON | /architect (planner pipeline) | Archon Step 3 |
| `campaign.md` | `.planning/campaigns/{slug}.md` | Markdown | Archon Step 2 (from JSON plan) | Archon (all steps) |
| `issues.json` | `.planning/plans/{slug}-issues.json` | JSON | adversary agent | refiner agent |
| `sign_off.json` | `.planning/plans/{slug}-signoff.json` | JSON | validator agent | /architect (pass/fail gate) |
| `MEMORY.md` | `.planning/reference/MEMORY.md` | Markdown | init-project / /evolve | /prime |
| `session-learnings.md` | `.planning/reference/session-learnings.md` | Markdown | /evolve | /prime (always) |

## 5. API Contract

Not an HTTP API. The fork exposes skill, agent, and hook interfaces:

### Modified Skills

| Skill | Change | Input | Output |
|-------|--------|-------|--------|
| `/architect` | **Rewrite** — 4-pass pipeline | Spec path OR prompt + codebase | `.planning/plans/{slug}.json` + campaign.md |
| `/archon` | **Modify** Steps 2+3 | Campaign (existing) or direction (new) | Executed tasks, updated campaign |

### New Skills

| Skill | Purpose | Input | Output |
|-------|---------|-------|--------|
| `/prime` | Session startup — load MEMORY.md, reference files, orient | None | Orientation report |
| `/evolve` | Post-commit reference file updates | None (reads git log) | Updated reference files |
| `/specify` | Co-author feature spec with Q&A | Feature description | `.planning/specs/{slug}.md` |

### New Agents

| Agent | Model | Tools | Source | Output Contract |
|-------|-------|-------|--------|-----------------|
| `adversary` | Opus | Read, Grep, Glob | astra `agents/adversary.md` | `issues.json`: severity, task_id, issue, fix |
| `refiner` | Opus | Read, Grep, Glob | astra `agents/refiner.md` | Refined `work_plan.json` |
| `validator` | Opus | Read, Grep, Glob | astra `agents/validator.md` | `sign_off.json`: sign_off bool, coverage, DAG validity |
| `generator` | Adaptive | Read, Write, Edit, Bash, Grep, Glob | astra `agents/generator.md` | HARNESS_STATUS block |

### Existing Agents (unchanged)

Archon agent, fleet agent, arch-reviewer agent, knowledge-extractor agent — all unchanged.

## 6. Business Logic

### Planner Pipeline (/architect)

1. **Input resolution**: Check for spec at `.planning/specs/`. If found, read it. If not, use the prompt + codebase scan.

2. **Context injection**: Read CLAUDE.md, `.planning/reference/MEMORY.md` (load relevant reference files), detection results if available.

3. **Adaptive depth** (from astra `planner.py`):
   - ≤5 tasks: `architect → validator` (light)
   - 6-19 tasks: `architect → adversary → refiner → validator` (standard)
   - ≥20 tasks: `architect → adversary → refiner → adversary → refiner → validator` (double review)

4. **Adversary rules** (from astra): minimum 3 issues. Checks file conflicts (CRITICAL), missing dependencies, scope issues, AI failure modes (criteria an LLM satisfies trivially, hallucinated libraries, tests that mock everything).

5. **Validator sign-off rules**: `sign_off: false` if any spec requirement uncovered, DAG has cycles, parallel file modification without dependency chaining, acceptance criteria allow hardcoded values.

6. **Output**: Write `work_plan.json` to `.planning/plans/`. Create campaign.md in `.planning/campaigns/` with Task Progress table derived from the JSON plan.

### Task-Level Execution (Archon Step 3)

1. **Dependency layer grouping**: Flatten tasks across epics/stories. Group by dependency layers (layer 0 = no deps, layer N = depends on completed layer N-1 tasks).

2. **Dispatch**: For each layer, dispatch generator agents. Independent tasks within a layer run in parallel via Fleet (worktree isolation). Each generator receives: task context, target_files, acceptance_criteria, CLAUDE.md, reference files, failure-modes.md, recovery protocol.

3. **Generator contract**: Must output HARNESS_STATUS block. `STATUS: COMPLETE` with `TESTS_STATUS` showing all pass. Must follow target_files scope. Must run tests before reporting complete. Must commit with `git add <specific files>`.

4. **Multi-reviewer verification**: After generator reports COMPLETE, dispatch code-reviewer AND test-runner in parallel. Both must approve. Any rejection → generator retries with feedback (max 3 attempts per task). After 3 failures → task marked blocked, Archon logs to Review Queue for human review.

5. **Task state updates**: After each task completes/fails, update both `work_plan.json` (status, attempts) and `campaign.md` (Task Progress table).

6. **Phase completion**: Phase is complete when all tasks in all layers are complete or explicitly blocked. Archon's existing Step 4 checks run (direction alignment, quality spot-check, regression guard).

### Legacy Campaign Conversion

When Archon encounters a campaign without a linked JSON plan (old-style flat phases):
1. Read the campaign's Phases table
2. Generate a basic `work_plan.json` — each phase becomes one task with end conditions as acceptance_criteria
3. Write to `.planning/plans/{slug}.json`
4. Add `Plan: .planning/plans/{slug}.json` to campaign.md
5. Continue with task-level execution

### Knowledge Compounding (/evolve)

After each `/commit-feature`, `/evolve` runs:

1. **Detect changes**: Read `git log --stat` since last evolve marker
2. **Categorize**: DB schema | API endpoints | UI patterns | external services | bugs/gotchas | test patterns
3. **Update reference files**:
   - DB changes → `.planning/reference/db-schema.md`
   - API changes → `.planning/reference/api-patterns.md`
   - Bugs/corrections → `.planning/reference/session-learnings.md` (append)
   - New patterns → `.planning/reference/[domain].md` (create if needed)
4. **Update navigation**: If new reference file created → add row to MEMORY.md
5. **Suggest CLAUDE.md improvements**: Present suggestions, user approves
6. **Update spec INDEX**: Mark completed specs

### Failure Modes Knowledge Base

Astra's `references/failure-modes.md` is injected into generator prompts at runtime. Contains 10 known failure patterns (FTS trigger omission, SSE subscriber leak, empty error paths, hardcoded config values, type-only correctness, etc.) with prescribed guard actions. This file lives in the fork's `references/` directory and is appended to generator context via the planner's `build_role_prompt()` logic (ported from astra's `planner.py` as SKILL.md inline logic).

### Generator Recovery Protocol

Astra's `references/generator-recovery-protocol.md` is injected into every generator dispatch:
1. Check for `feedback.md` (evaluator rejection feedback) → fix ALL issues first
2. Check `attempts > 0` → read previous feedback carefully
3. Run regression check (test suite) BEFORE starting new work
4. Browser verification for web projects (navigate, interact, screenshot)

## 7. UI Changes

N/A — CLI plugin.

## 8. Dependencies & Ordering

### Build Sequence

```
Layer 0 (foundation — no dependencies):
├─ Port astra agents (adversary, refiner, validator, generator) → ~/Citadel/agents/
├─ Port astra references (failure-modes, recovery-protocol) → ~/Citadel/references/
├─ Create reference scaffold templates → ~/Citadel/.planning/_templates/reference-scaffold/
├─ Create spec template + INDEX → ~/Citadel/.planning/_templates/specs-scaffold/

Layer 1 (depends on Layer 0):
├─ Rewrite /architect SKILL.md — 4-pass pipeline with adaptive depth
├─ Modify init-project.js — add specs/, plans/, reference/ to PLANNING_DIRS
├─ Create /prime SKILL.md — session startup with MEMORY.md
├─ Create /evolve SKILL.md — post-commit reference updates

Layer 2 (depends on Layer 1):
├─ Modify /archon SKILL.md — Steps 2+3 for task-level execution
├─ Create /specify SKILL.md — spec co-authoring (adapted from brain vault)

Layer 3 (depends on Layer 2):
├─ Integration testing — full pipeline: specify → architect → archon execution
├─ Legacy campaign conversion testing
├─ Multi-session resume testing
```

### Implementation Notes

- Layer 0 is pure file copying + adaptation (read source, adapt, write)
- Layer 1 skills can be developed in parallel (no interdependence)
- Layer 2 is the critical path — Archon modification requires Layer 1 complete
- Layer 3 is testing only

## 9. Migration Plan

### For existing Citadel users

- Fork is backward compatible: old campaigns without JSON plans auto-convert on first run
- New `.planning/` subdirs (specs/, plans/, reference/) are created by init-project on next SessionStart
- Existing hooks, fleet, daemon, telemetry — all unchanged
- Old `/architect` skill is replaced (new version is strictly superior — falls back to single-pass for ≤5 task plans)

### For astra users

- Astra-plugin is abandoned (ADR-002)
- Astra's planner prompts are ported wholesale (architect, adversary, refiner, validator agents)
- Astra's JSON plan format is preserved (phase/epic/story/task hierarchy)
- Python orchestrator is NOT ported — SKILL.md handles sequencing
- Astra's generator + recovery protocol are ported

### For brain vault users

- AIDD pipeline skills (/prime, /evolve, /specify) are adapted for the fork
- Reference file infrastructure moves from `docs/reference/` to `.planning/reference/`
- Brain vault's original skills remain for brain-vault-specific use

## 10. Test Plan

| Test Type | Scenario | Expected |
|-----------|----------|----------|
| Unit | adversary agent finds file conflict in plan | issues.json contains critical severity issue |
| Unit | validator rejects plan with DAG cycle | sign_off: false, cycles array non-empty |
| Unit | validator approves clean plan | sign_off: true |
| Unit | adaptive depth selects light for 3 tasks | Sequence: architect → validator |
| Unit | adaptive depth selects standard for 10 tasks | Sequence: architect → adversary → refiner → validator |
| Unit | adaptive depth selects double for 25 tasks | Sequence: architect → adversary → refiner → adversary → refiner → validator |
| Unit | generator outputs valid HARNESS_STATUS | Parsed correctly: STATUS, FILES_MODIFIED, TESTS_STATUS |
| Unit | generator outputs malformed HARNESS_STATUS | Detected as error, task marked failed |
| Integration | /architect produces JSON plan from prompt | Valid work_plan.json with phases, tasks, depends_on DAG |
| Integration | /architect produces JSON plan from spec file | Plan references spec, all spec requirements covered in validator |
| Integration | Archon Step 3 dispatches tasks by dependency layer | Layer 0 tasks complete before Layer 1 starts |
| Integration | Multi-reviewer rejection triggers retry | Generator receives feedback, attempts incremented, max 3 |
| Integration | Legacy campaign auto-converts to JSON plan | Old campaign gets Plan: link, tasks generated from phases |
| Integration | /prime loads MEMORY.md and correct reference files | Given "touching database" work, loads db-schema.md |
| Integration | /evolve updates reference files after DB change | db-schema.md updated with new table |
| Integration | /evolve appends to session-learnings.md | New gotcha entry with timestamp |
| Integration | init-project scaffolds specs/, plans/, reference/ | Dirs exist after SessionStart hook |
| E2E | Full pipeline: specify → architect → archon → evolve | Spec written, plan created, tasks executed, references updated |
| E2E | Multi-session: archon pauses, resume continues from correct task | Continuation State has task position, resume dispatches next task |
| E2E | Parallel execution: independent tasks in same layer | Fleet dispatches 2+ generators in worktrees, merge succeeds |

## 11. Out of Scope

- **Python runtime** — No Python orchestrator. SKILL.md handles all sequencing.
- **Citadel engine changes** — Hooks, fleet, daemon, telemetry, marshal, consent, trust — all untouched.
- **New hook development** — Using Citadel's existing 22 hooks as-is.
- **Cost tracking** — Citadel's existing cost-tracker hook handles this.
- **Plugin marketplace publishing** — Fork is installed locally or from GitHub.
- **Upstream contribution** — May PR improvements to SethGammon/Citadel later, but not a goal for v1.
- **CI/CD integration** — No GitHub Actions, no PR automation (Citadel's /pr-watch covers this separately).
- **Desktop/web surfaces** — CLI plugin only (Citadel's runtime-agnostic work may add this later).
- **Team mode** — Single developer workflow. Fleet parallelizes agents, not humans.
- **Custom hooks** — Using Citadel's existing hooks. Project-specific hooks are configured via harness.json, not added to the fork.
