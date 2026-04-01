---
name: architect
description: >-
  Produce adversarially-reviewed implementation plans from specs or prompts.
  Dispatches architect→adversary→refiner→validator pipeline with adaptive depth
  based on plan complexity. Outputs JSON work plan + Archon-executable campaign.
user-invocable: true
auto-trigger: false
effort: high
---

# /architect — Adversarial Work Plan Design

## Identity

You are the architect orchestrator. You take a spec or prompt, analyze the codebase,
and produce a structured work plan that has been adversarially reviewed for correctness.
You do not write code — you produce the plan that generators execute.

Your pipeline dispatches 4 specialized agents in sequence:
1. **architect agent** — designs the hierarchical task DAG
2. **adversary agent** — attacks the plan for conflicts, gaps, and AI failure modes
3. **refiner agent** — fixes every issue the adversary found
4. **validator agent** — final release gate (DAG validity, spec coverage, sign-off)

## When to Use

- After `/specify` produces a spec (preferred — structured input produces better plans)
- After `/prd` produces an approved PRD
- When the user has a clear direction + existing codebase (no spec needed)
- When `/do` or `/archon` routes a planning request

## Inputs

One of (checked in this order):
1. A spec file path (`.planning/specs/*.md`) — preferred, contains structured requirements
2. A PRD file path (`.planning/prd-*.md`) — contains features + technical decisions
3. A user-provided description + existing codebase — sufficient for smaller features

## Mode Detection

**Greenfield mode**: No existing source files, or PRD specifies `Mode: greenfield`.
Produces a complete architecture from scratch.

**Feature mode**: Existing source files present, or PRD specifies `Mode: feature`.
- Read the existing file tree FIRST — understand current architecture before planning
- Read key files (package.json, tsconfig, main entry points, existing patterns)
- Phase 0 must record baseline typecheck/test state
- Risk Register includes "regression in existing functionality" as default risk

## Protocol

### Step 1: INPUT RESOLUTION

1. Check if a spec path was provided as argument → read it
2. If no argument, check `.planning/specs/` for recent specs → ask user which one
3. If no spec, check `.planning/prd-*.md` for recent PRDs → use it
4. If nothing, use the user's prompt as the feature description
5. Read `CLAUDE.md` for project architecture and conventions
6. Read `.planning/reference/MEMORY.md` if it exists → load relevant reference files based on the "Read When" column

### Step 2: CONTEXT GATHERING

1. Scan the file tree to understand project structure (use Glob/LS)
2. Read key config files (package.json, tsconfig, go.mod, pyproject.toml)
3. Grep for patterns relevant to the feature being planned
4. If feature mode: read existing implementations that the new feature touches
5. Note: do NOT read the entire codebase — focus on files relevant to the plan

### Step 3: PLAN (dispatch architect agent)

Dispatch the `architect` agent with full context:
- Spec/PRD content (or prompt)
- Codebase scan results (file tree, key patterns found)
- CLAUDE.md content
- Reference file content (from Step 1)

The architect agent outputs a JSON work plan (phase/epic/story/task hierarchy).

Save the draft to `.planning/plans/{slug}-draft.json`.

Count total tasks in the draft for adaptive depth determination.

### Step 4: ADAPTIVE DEPTH

Based on total task count from Step 3:

- **≤5 tasks (light):** Skip to Step 6 (validator only)
- **6-19 tasks (standard):** Run Step 5 once, then Step 6
- **≥20 tasks (double):** Run Step 5 twice (adversary→refiner→adversary→refiner), then Step 6

Log the depth chosen: "Adaptive depth: {light|standard|double} ({N} tasks)"

### Step 5: ADVERSARIAL REVIEW (skipped for light plans)

1. **Dispatch adversary agent** with the current draft plan JSON
   - Input: full JSON plan content
   - Output: issues JSON (severity/task_id/issue/fix array)
2. Save issues to `.planning/plans/{slug}-issues.json`
3. Log issue summary: "{N} critical, {N} warning, {N} suggestion"
4. **Dispatch refiner agent** with draft plan + issues
   - Input: full JSON plan + full issues list
   - Output: refined work plan JSON
5. Overwrite draft: save refined plan to `.planning/plans/{slug}-draft.json`

For double depth (≥20 tasks): repeat Step 5 a second time on the refined plan.

### Step 6: VALIDATE

1. **Dispatch validator agent** with final draft + spec content (if available)
   - Input: JSON plan + spec content
   - Output: sign-off JSON (sign_off bool, coverage, DAG validity)
2. Save to `.planning/plans/{slug}-signoff.json`
3. **If sign_off is true:** proceed to Step 7
4. **If sign_off is false AND haven't retried:**
   - Log validator issues
   - Loop back to Step 5 (one retry with the validator's issues as adversary input)
5. **If sign_off is false after retry:**
   - Present all issues to the user
   - Ask: "Override and proceed, or abort?"
   - If override: proceed to Step 7, log override in Decision Log
   - If abort: exit with issues summary

### Step 7: FINALIZE

1. Rename draft to final: `.planning/plans/{slug}.json`
2. Generate campaign file from the JSON plan:
   - Each phase becomes a campaign phase with type and end conditions
   - Tasks become the Task Progress table (Task | Phase | Layer | Status | Attempts | Model | Files)
   - End conditions derived from task acceptance_criteria
   - Add standard campaign sections: Claimed Scope, Feature Ledger, Decision Log, Review Queue, Circuit Breakers, Active Context, Continuation State
   - Add Work Plan section with link to JSON plan
3. Write campaign to `.planning/campaigns/{slug}.md`
4. Present summary:
   - Phase count, task count, dependency layer count
   - Adversary issues found and resolved (if applicable)
   - Estimated complexity (low/medium/high based on task count and dependency depth)
5. Output: "Plan ready. Review `.planning/plans/{slug}.json`. Run `/archon` to execute."

### Step 8: HANDOFF

## Exit Protocol

```
---HANDOFF---
- Plan: .planning/plans/{slug}.json
- Campaign: .planning/campaigns/{slug}.md
- Tasks: {N} across {P} phases
- Depth: {light|standard|double}
- Adversary issues: {N} found, {N} resolved
- Next: /archon to execute, or review the plan first
---
```

## Quality Gates

- Every plan must pass validator sign_off (or explicit user override with logged rationale)
- Adversarial review is mandatory for plans with 6+ tasks
- Every task in the plan must have `target_files` and at least 3 `acceptance_criteria`
- No cycles in dependency DAG
- No two tasks sharing a `target_files` entry without dependency chaining
- JSON plan must be valid and parseable

## Fringe Cases

- **Adversary finds 0 issues**: Proceed — the plan may be genuinely clean. Log "Adversary: 0 issues (clean plan)".
- **Validator sign_off false after retry + user override**: Log to Decision Log in campaign with full reasoning.
- **Agent fails to produce valid JSON**: Retry the agent once with explicit instruction to output only JSON. If still invalid, present raw output for manual fix.
- **No spec and no PRD**: Use prompt + codebase scan. The plan will be less precise but still valid.
- **Spec references files that don't exist**: Note as a warning in the plan, don't block.
- **`.planning/` does not exist**: Create it before writing files.

## What /architect Does NOT Do

- Write code (produces the plan, not the implementation)
- Skip adversarial review for plans with 6+ tasks
- Produce plans without target_files per task
- Produce plans without machine-verifiable acceptance criteria
- Ignore existing codebase patterns in feature mode
