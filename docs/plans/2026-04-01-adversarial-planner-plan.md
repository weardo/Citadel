# Adversarial Planner Implementation Plan

**Goal:** Add multi-pass adversarial planner, task-level execution, and compounding knowledge to Citadel fork
**Spec:** docs/specs/adversarial-planner.md
**Phases:** 7 (4 parallel layers, ~24 files)


**Ordering note:** Phase ordering deviates from spec Section 8 for tighter parallelism: init-project moved to Layer 0 (co-located with template dependencies in Phase 2), /specify moved to Layer 1 (only depends on templates, not /architect). No real dependency violations introduced.

## Source Material Locations

Read BEFORE writing — never write from memory:

| Source | Location | What to take |
|--------|----------|-------------|
| Astra prompt templates | `/tmp/astra-explore/src/prompts/*.md` | Architect, adversary, refiner, validator, generator prompts (WITH {{PLACEHOLDERS}}) |
| Astra agent files | `/tmp/astra-explore/agents/*.md` | Frontmatter format (name, description, tools, model) |
| Astra references | `/tmp/astra-explore/references/` | failure-modes.md (43 lines), generator-recovery-protocol.md (33 lines) |
| Astra planner.py | `/tmp/astra-explore/src/core/planner.py` | `get_role_sequence()` adaptive depth logic (lines 68-95) |
| Brain vault /prime | `~/brain/.claude/skills/prime/SKILL.md` | 3-phase session startup |
| Brain vault /evolve | `~/brain/.claude/skills/evolve/SKILL.md` | 6-phase compounding engine |
| Brain vault /specify | `~/brain/.claude/skills/specify/SKILL.md` | 4-phase spec co-authoring |
| Brain vault MEMORY.md | `~/brain/docs/reference/MEMORY.md` | Navigation index format (13-row table) |
| Brain vault session-learnings | `~/brain/docs/reference/session-learnings.md` | Category-based gotcha format |
| Brain vault feature-dev-standards | `~/brain/docs/reference/feature-dev-standards.md` | Cross-cutting concerns (Observability, Error Handling, Testing) |
| Brain vault spec TEMPLATE | `~/brain/docs/specs/TEMPLATE.md` | 11-section spec template |
| Citadel architect | `~/Citadel/skills/architect/SKILL.md` (243 lines) | Frontmatter style, feature-mode detection, multi-candidate eval |
| Citadel archon | `~/Citadel/skills/archon/SKILL.md` (362 lines) | Steps 1, 2.5, 4-7 (keep), Steps 2+3 (replace) |
| Citadel init-project | `~/Citadel/hooks_src/init-project.js` (301 lines) | PLANNING_DIRS array at line 18 |
| Citadel campaign template | `~/Citadel/.planning/_templates/campaign.md` (111 lines) | Add Task Progress section |

## Citadel Conventions (from CLAUDE.md)

- Skills: `skills/{name}/SKILL.md`
- Agents: `agents/{name}.md`
- Hooks: `hooks_src/{name}.js`
- State: `.planning/` directories
- Config: `.claude/harness.json`
- Frontmatter: `name`, `description` (multiline `>-`), `user-invocable`, `auto-trigger`
- Tests: `node scripts/test-all.js` (hooks + skill structure, no LLM)

## Dependency Graph

```
Layer 0 (parallel):  Phase 1 ──┬── Phase 2
                                │
Layer 1 (parallel):  Phase 3 ──┼── Phase 4
                                │
Layer 2 (sequential):     Phase 5
                                │
Layer 3 (sequential):     Phase 6
```

---

## Phase 1: Port Planner Agents + Knowledge Base

**Goal:** Add the 4 adversarial planner agents and 2 reference files from astra.
**Files:** 7 new files in `agents/` and `references/`

### Task 1.0: Create architect agent

**Source:** Read BOTH files:
- `/tmp/astra-explore/agents/architect.md` (47 lines — has frontmatter)
- `/tmp/astra-explore/src/prompts/architect.md` (45 lines — has {{PLACEHOLDERS}})

**Write to:** `agents/architect.md`

**Adaptation:**
- Citadel-style frontmatter (name: architect, tools: Read/Grep/Glob/Bash, model: opus)
- Description: "Design hierarchical work plans from specs or prompts. Produces phases/epics/stories/tasks JSON with dependency graphs, target files, and acceptance criteria. Used by /architect skill during planning phase."
- Body: merge both versions. Use agents/ for structure, src/prompts/ for {{PLACEHOLDER}} references
- Keep JSON output format exactly (phases/epics/stories/tasks hierarchy)
- Keep rules: read codebase first, every task needs target_files, 3-8 tasks per epic, machine-verifiable AC

**Verify:** File exists at `agents/architect.md`. Has YAML frontmatter. Contains JSON output format.

### Task 1.1: Create adversary agent

**Source:** Read BOTH files:
- `/tmp/astra-explore/agents/adversary.md` (49 lines — has frontmatter)
- `/tmp/astra-explore/src/prompts/adversary.md` (46 lines — has {{PLACEHOLDERS}})

**Write to:** `agents/adversary.md`

**Adaptation:**
- Use astra `agents/` frontmatter structure (name, description, tools, model) but match Citadel's style:
  ```yaml
  ---
  name: adversary
  description: >-
    Critically review work plans for dependency conflicts, missing coverage,
    vague criteria, and AI failure modes. Produces structured issue list with
    fixes. Used by /architect during planning phase.
  tools: Read, Grep, Glob
  model: opus
  ---
  ```
- Body: merge content from BOTH files. Use `agents/` version as the base (it's the agent prompt). Incorporate any {{PLACEHOLDER}} references from `src/prompts/` version — particularly `{{WORK_PLAN}}` which should become an instruction: "The work plan JSON will be provided in your prompt by the /architect skill."
- Keep JSON output format exactly (issues array with severity/task_id/issue/fix)
- Keep all check categories: File Conflicts, Missing Dependencies, Scope Issues, AI Failure Modes
- Keep rule: "Minimum 3 issues total"

**Verify:** File exists at `agents/adversary.md`. Has YAML frontmatter with name, description, tools, model. Body contains "Output Format" with JSON schema. Contains all 4 check categories.

### Task 1.2: Create refiner agent

**Source:** Read BOTH:
- `/tmp/astra-explore/agents/refiner.md` (39 lines)
- `/tmp/astra-explore/src/prompts/refiner.md` (66 lines — richer)

**Write to:** `agents/refiner.md`

**Adaptation:**
- Citadel-style frontmatter (same pattern as 1.1)
- The `src/prompts/` version is richer (66 vs 39 lines) — use it as the body base
- Replace `{{WORK_PLAN}}` and `{{ADVERSARY_FEEDBACK}}` with instructions: "The work plan and adversary feedback will be provided in your prompt."
- Keep rules: address every issue, preserve structure, task quality requirements
- Keep output format: complete refined work_plan.json

**Verify:** File exists. Frontmatter valid. Contains "Address Every Issue" and "Preserve Structure" sections.

### Task 1.3: Create validator agent

**Source:** Read BOTH:
- `/tmp/astra-explore/agents/validator.md` (51 lines)
- `/tmp/astra-explore/src/prompts/validator.md` (86 lines — much richer)

**Write to:** `agents/validator.md`

**Adaptation:**
- Citadel-style frontmatter
- Use `src/prompts/` version as body (86 lines, more detailed)
- Replace {{PLACEHOLDERS}} with instructions
- Keep JSON output format: sign_off bool, issues array, coverage object (spec_requirements + covered/uncovered counts), dag object (valid, cycles, invalid_refs)
- Keep sign-off rules: false if uncovered requirements, DAG cycles, file conflicts, hardcoded acceptance criteria

**Verify:** File exists. Contains sign_off rules. Contains coverage and dag validation sections.

### Task 1.4: Create generator agent

**Source:** Read BOTH:
- `/tmp/astra-explore/agents/generator.md` (41 lines)
- `/tmp/astra-explore/src/prompts/generator.md` (44 lines)

**Write to:** `agents/generator.md`

**Adaptation:**
- Citadel-style frontmatter. Model: `sonnet` (not adaptive — adaptive routing is handled by /architect skill)
- Merge both versions
- Add instruction: "Read `references/failure-modes.md` before starting implementation"
- Add instruction: "Follow `references/generator-recovery-protocol.md` as your first step"
- Keep HARNESS_STATUS block format EXACTLY:
  ```
  ---HARNESS_STATUS---
  STATUS: WORKING|COMPLETE|BLOCKED
  FILES_MODIFIED: file1.ts, file2.ts
  TESTS_STATUS: N passing, N failing
  EXIT_SIGNAL: false
  RECOMMENDATION: next action
  ---END_HARNESS_STATUS---
  ```
- Keep rules: ONE task per session, never skip tests, follow target_files, git add specific files

**Verify:** File exists. Contains HARNESS_STATUS format. References failure-modes.md and recovery-protocol.md.

### Task 1.5: Create failure-modes knowledge base

**Source:** Read `/tmp/astra-explore/references/failure-modes.md` (43 lines)

**Write to:** `references/failure-modes.md` (create `references/` directory first)

**Adaptation:** None — these are universal patterns (FM-01 through FM-10). Copy as-is.

**Verify:** File exists at `references/failure-modes.md`. Contains FM-01 through FM-10.

### Task 1.6: Create generator recovery protocol

**Source:** Read `/tmp/astra-explore/references/generator-recovery-protocol.md` (33 lines)

**Write to:** `references/generator-recovery-protocol.md`

**Adaptation:**
- Replace `{{RUN_DIR}}` with `.planning/plans/` (where feedback files will live)
- Replace `{{TEST_COMMAND}}` with instruction: "Read the test command from CLAUDE.md or `.claude/harness.json`"
- Keep: Recovery Check (feedback.md), Regression Check (run tests first), Browser Verification sections

**Verify:** File exists. Contains "Recovery Check" and "Regression Check" sections. No unresolved {{PLACEHOLDERS}}.

### Phase 1 Validation

```bash
ls agents/ | wc -l   # Expected: 9 (4 existing + 5 new)
ls references/        # Expected: failure-modes.md, generator-recovery-protocol.md
node scripts/test-all.js  # Existing tests still pass
```

---

## Phase 2: Scaffold Templates + init-project

**Goal:** Create template files for the knowledge system and modify init-project to scaffold new directories.
**Files:** 6 new template files, 1 modified hook

### Task 2.1: Create spec template

**Source:** Read `~/brain/docs/specs/TEMPLATE.md`

**Write to:** `.planning/_templates/specs-scaffold/TEMPLATE.md`

**Adaptation:**
- Keep all 11 sections exactly
- Remove brain-vault-specific comments (if any reference vault paths)
- Add header comment: `<!-- Generated by Citadel init-project. Customize for your project. -->`

**Verify:** File exists. Has all 11 section headers (Goal through Out of Scope).

### Task 2.2: Create spec index

**Write to:** `.planning/_templates/specs-scaffold/INDEX.md`

**Content:** Empty registry — header only:
```markdown
# Feature Specs Index

| Spec | Status | Description |
|------|--------|-------------|
```

**Verify:** File exists. Has table header.

### Task 2.3: Create MEMORY.md template

**Source:** Read `~/brain/docs/reference/MEMORY.md` (format reference)

**Write to:** `.planning/_templates/reference-scaffold/MEMORY.md`

**Adaptation:** Generalized starter with 3 universal rows:
```markdown
# Reference Files — Navigation Index

Read this file at the start of every session to know what reference docs exist.

| File | Read When | Description |
|------|-----------|-------------|
| `session-learnings.md` | Every session (start) | Corrections, gotchas, things that surprised us |
| `feature-dev-standards.md` | Every implementation session | Cross-cutting concerns checklist |
| `architecture.md` | Starting any dev work | System overview, component map |
```

**Verify:** File exists. Has table with "Read When" column. Has 3 starter rows.

### Task 2.4: Create session-learnings.md template

**Source:** Read `~/brain/docs/reference/session-learnings.md` (first 30 lines — format only)

**Write to:** `.planning/_templates/reference-scaffold/session-learnings.md`

**Content:** Empty starter with format example:
```markdown
# Session Learnings

Corrections, gotchas, and things that surprised us during development. Read at the start of every session.

---

<!-- Format for new entries:

## Category Name

- **Short title**: Description of what happened and the lesson learned.
  Context: what triggered this, why it matters.

-->
```

**Verify:** File exists. Has format guidance. Is otherwise empty (no project-specific content).

### Task 2.5: Create feature-dev-standards.md template

**Source:** Read `~/brain/docs/reference/feature-dev-standards.md` (first 50 lines)

**Write to:** `.planning/_templates/reference-scaffold/feature-dev-standards.md`

**Adaptation:** Generalize to universal cross-cutting concerns. Remove brain-vault-specific items. Keep 3 sections:
1. **Observability** — structured logging, health checks
2. **Error Handling** — typed errors, input validation, no empty catches
3. **Testing** — unit tests for happy + error + edge cases, TDD-first

**Verify:** File exists. Has 3 sections. No project-specific references.

### Task 2.6: Create work plan JSON template

**Write to:** `.planning/_templates/work-plan-template.json`

**Source:** Read `docs/specs/adversarial-planner.md` lines 141-184 for the exact JSON structure.

**Content:** Copy the JSON example from the spec verbatim. Must contain ALL fields: `meta.slug`, `meta.spec`, `meta.created`, `meta.planner_depth`, `phases[].id`, `phases[].name`, `phases[].epics[].id`, `epics[].stories[].tasks[]` with fields: `id`, `description`, `acceptance_criteria`, `steps`, `depends_on`, `target_files`, `status`, `attempts`, `blocked_reason`.

**Verify:** Valid JSON parseable by `node -e "JSON.parse(require('fs').readFileSync('.planning/_templates/work-plan-template.json'))"`. Contains all fields listed above matching what /architect produces and Archon Step 3 reads.

### Task 2.7: Modify init-project.js to scaffold new directories

**Source:** Read `~/Citadel/hooks_src/init-project.js` — PLANNING_DIRS at line 18

**Modify:** `hooks_src/init-project.js`

**Changes:**

1. Add 3 entries to PLANNING_DIRS array (after line 32, before the closing `];`):
   ```javascript
   '.planning/plans',
   '.planning/specs',
   '.planning/reference',
   ```

2. Add template copying logic. Find the existing block that copies `_templates/` to the project (search for `copyDirIfMissing` or template copying). After it, add:
   ```javascript
   // Scaffold spec templates if not present
   const specsDir = path.join(PROJECT_ROOT, '.planning', 'specs');
   const specsTemplate = path.join(PLUGIN_ROOT, '.planning', '_templates', 'specs-scaffold');
   if (fs.existsSync(specsTemplate)) {
     for (const file of ['TEMPLATE.md', 'INDEX.md']) {
       const dest = path.join(specsDir, file);
       const src = path.join(specsTemplate, file);
       if (!fs.existsSync(dest) && fs.existsSync(src)) {
         fs.copyFileSync(src, dest);
       }
     }
   }
   
   // Scaffold reference templates if not present
   const refDir = path.join(PROJECT_ROOT, '.planning', 'reference');
   const refTemplate = path.join(PLUGIN_ROOT, '.planning', '_templates', 'reference-scaffold');
   if (fs.existsSync(refTemplate)) {
     for (const file of ['MEMORY.md', 'session-learnings.md', 'feature-dev-standards.md']) {
       const dest = path.join(refDir, file);
       const src = path.join(refTemplate, file);
       if (!fs.existsSync(dest) && fs.existsSync(src)) {
         fs.copyFileSync(src, dest);
       }
     }
   }
   ```

**Verify:**
```bash
# Test in temp dir
mkdir -p /tmp/citadel-scaffold-test
cd /tmp/citadel-scaffold-test && git init
CLAUDE_PROJECT_DIR=/tmp/citadel-scaffold-test node ~/Citadel/hooks_src/init-project.js
ls .planning/plans/          # dir exists
ls .planning/specs/          # TEMPLATE.md + INDEX.md
ls .planning/reference/      # MEMORY.md + session-learnings.md + feature-dev-standards.md
rm -rf /tmp/citadel-scaffold-test
```

### Phase 2 Validation

```bash
node scripts/test-all.js   # Existing tests still pass
ls .planning/_templates/specs-scaffold/     # TEMPLATE.md, INDEX.md
ls .planning/_templates/reference-scaffold/ # MEMORY.md, session-learnings.md, feature-dev-standards.md
```

---

## Phase 3: Rewrite /architect Skill

**Goal:** Replace Citadel's single-pass /architect with the 4-pass adversarial pipeline orchestrated by SKILL.md.
**Files:** 1 modified file (skills/architect/SKILL.md — 243 lines → ~350 lines)
**Depends on:** Phase 1 (agents must exist)

### Task 3.1a: Rewrite architect Steps 1-2 (input resolution + context gathering)

**Source:** Read `~/Citadel/skills/architect/SKILL.md` lines 1-100 (frontmatter + Steps 1-2)

**Modify:** `skills/architect/SKILL.md`

**Changes:** Rewrite the frontmatter (update description to mention adversarial pipeline) and Steps 1-2:
- Step 1: INPUT RESOLUTION — check `.planning/specs/` for spec, fall back to PRD, fall back to prompt
- Step 2: CONTEXT GATHERING — keep Citadel feature-mode detection (greenfield vs brownfield), add `.planning/reference/MEMORY.md` loading
- Preserve existing Mode Detection section (greenfield vs feature mode)

**Verify:** Frontmatter has updated description. Step 1 checks `.planning/specs/`. Step 2 loads MEMORY.md.

### Task 3.1b: Write architect Steps 3-5 (plan dispatch + adaptive depth + adversarial review)
**Depends on:** Task 3.1a

**Source:** Read `/tmp/astra-explore/src/core/planner.py` lines 68-95 (adaptive depth thresholds)

**Modify:** `skills/architect/SKILL.md` — append after Step 2

**Changes:** Write Steps 3-5:
- Step 3: PLAN — dispatch architect agent, save draft to `.planning/plans/{slug}-draft.json`
- Step 4: ADAPTIVE DEPTH — count tasks, select depth:
  - ≤5 tasks → skip to Step 6 (validator only)
  - 6-19 tasks → Step 5 once then Step 6
  - ≥20 tasks → Step 5 twice (adversary→refiner→adversary→refiner) then Step 6
  Step 4 MUST contain exactly 3 threshold branches with values 5, 19, 20.
- Step 5: ADVERSARIAL REVIEW — dispatch adversary agent, save issues, dispatch refiner agent, overwrite draft

**Verify:** Step 4 has exactly 3 depth branches (light/standard/double). Step 5 dispatches adversary then refiner. Issues saved to `-issues.json`.

### Task 3.1c: Write architect Steps 6-8 (validation + finalize + handoff)
**Depends on:** Task 3.1b

**Source:** Read `/tmp/astra-explore/agents/validator.md` for sign_off format

**Modify:** `skills/architect/SKILL.md` — append after Step 5

**Changes:** Write Steps 6-8:
- Step 6: VALIDATE — dispatch validator, check sign_off. If false and not retried → loop to Step 5. If false after retry → present to user for override.
- Step 7: FINALIZE — rename draft to final `.planning/plans/{slug}.json`. Generate campaign.md with Task Progress table. Map: phases→campaign phases, tasks→Task Progress rows, acceptance_criteria→Phase End Conditions.
- Step 8: HANDOFF — standard Citadel exit protocol
- Add Quality Gates section (every plan must pass validator, adversarial review mandatory for 6+ tasks)
- Add Fringe Cases section (0 adversary issues, agent fails to produce JSON, validator false after override)

**Verify:** Step 6 has retry logic with max 1 retry. Step 7 writes BOTH .json and campaign.md. Quality Gates section present. `node scripts/skill-lint.js` passes.

**Source:** Read ALL of these before writing:
- `~/Citadel/skills/architect/SKILL.md` (243 lines — current version, keep frontmatter + feature-mode + quality gates)
- `/tmp/astra-explore/src/core/planner.py` lines 68-95 (`get_role_sequence()` — adaptive depth)
- `/tmp/astra-explore/src/prompts/architect.md` (template with {{PLACEHOLDERS}})

**Modify:** `skills/architect/SKILL.md`

**Structure of the rewritten skill:**

```markdown
---
name: architect
description: >-
  Produce adversarially-reviewed implementation plans from specs or prompts.
  Dispatches architect→adversary→refiner→validator pipeline with adaptive depth.
  Outputs JSON work plan + Archon-executable campaign file.
user-invocable: true
auto-trigger: false
effort: high
---

# /architect — Adversarial Work Plan Design

## Identity
[Keep Citadel's identity section style. Update to describe the 4-pass pipeline.]

## When to Use
[Keep Citadel's existing section — after /prd or /specify, or with user direction]

## Inputs
[Keep Citadel's existing input resolution — PRD, spec, or description]

## Mode Detection
[Keep Citadel's feature-mode detection — greenfield vs feature mode. This is valuable.]

## Protocol

### Step 1: INPUT RESOLUTION
- Check `.planning/specs/` for linked spec. If found, read it as primary input.
- If no spec, check for PRD at `.planning/prd-*.md`
- If neither, use user prompt + codebase scan
- Read CLAUDE.md for project conventions
- Read `.planning/reference/MEMORY.md` — load relevant reference files

### Step 2: CONTEXT GATHERING
[Keep Citadel's existing Step 1 READ logic — scan file tree, read package.json, 
understand architecture. This is the codebase exploration step.]
- Feature mode: read existing file tree FIRST, understand current architecture
- Greenfield: skip, but note stack from detection if available

### Step 3: PLAN (dispatch architect agent)
- Dispatch Agent with subagent_type "astra:architect" (or just invoke the architect agent)
- Inject context: spec content (or prompt), codebase scan results, CLAUDE.md, reference files
- Agent outputs JSON work plan (phase/epic/story/task hierarchy)
- Save draft to `.planning/plans/{slug}-draft.json`
- Count total tasks in the draft

### Step 4: ADAPTIVE DEPTH
Based on task count from Step 3:
- **≤5 tasks (light):** Skip to Step 6 (validator only)
- **6-19 tasks (standard):** Run Step 5 once, then Step 6
- **≥20 tasks (double):** Run Step 5 twice (adversary→refiner→adversary→refiner), then Step 6

Log the depth chosen: "Adaptive depth: {light|standard|double} ({N} tasks)"

### Step 5: ADVERSARIAL REVIEW (skipped for light plans)
1. Dispatch adversary agent with the current draft plan
   - Input: full JSON plan content
   - Output: issues.json (severity/task_id/issue/fix array)
2. Save issues to `.planning/plans/{slug}-issues.json`
3. Log issue summary: "{N} critical, {N} warning, {N} suggestion"
4. Dispatch refiner agent with draft plan + issues
   - Input: full JSON plan + full issues list
   - Output: refined work_plan.json
5. Overwrite draft: save refined plan to `.planning/plans/{slug}-draft.json`

### Step 6: VALIDATE
1. Dispatch validator agent with final draft + spec (if exists)
   - Input: JSON plan + spec content
   - Output: sign_off.json (sign_off bool, coverage, dag validity)
2. Save to `.planning/plans/{slug}-signoff.json`
3. If sign_off is true: proceed to Step 7
4. If sign_off is false AND haven't retried:
   - Log validator issues
   - Loop back to Step 5 (one retry)
5. If sign_off is false after retry:
   - Present issues to user
   - Ask: "Override and proceed, or abort?"
   - If override: proceed to Step 7
   - If abort: exit with issues summary

### Step 7: FINALIZE
1. Rename draft to final: `.planning/plans/{slug}.json`
2. Generate campaign.md from the JSON plan:
   - Phases from plan become campaign phases
   - Tasks become Task Progress table
   - End conditions derived from task acceptance_criteria
   - Add standard campaign sections: Feature Ledger, Decision Log, Review Queue, Circuit Breakers, Active Context, Continuation State
3. Write campaign to `.planning/campaigns/{slug}.md`
4. Present summary:
   - Phase count, task count, dependency layers
   - Key decisions (from multi-candidate evaluation)
   - Estimated complexity
5. Ask: "Plan ready. Review `.planning/plans/{slug}.json`. Run `/archon` to execute."

### Step 8: HANDOFF
[Standard Citadel exit protocol format]

## Quality Gates
[Keep Citadel's existing quality gates + add:]
- Every plan must pass validator sign_off (or explicit user override)
- Adversarial review is mandatory for plans with 6+ tasks
- Every task in the plan must have target_files and acceptance_criteria

## Fringe Cases
[Keep Citadel's existing fringe cases + add:]
- Adversary finds 0 issues: proceed anyway (the plan may be genuinely clean)
- Validator sign_off false after retry + user override: log to Decision Log in campaign
- Agent fails to produce valid JSON: retry once, then present raw output for manual fix
```

**Key principles for the rewrite:**
- The SKILL.md orchestrates via sequential Agent tool calls (dispatch agent, read output, dispatch next agent)
- No Python, no bash scripts — pure SKILL.md instructions that Claude follows
- Each agent is dispatched with full context (plan content pasted into the prompt)
- Intermediate files (.planning/plans/*-draft.json, *-issues.json, *-signoff.json) provide audit trail

**Verify:** Read the rewritten file end-to-end. Confirm:
- Has 8 steps
- Step 4 has adaptive depth with correct thresholds (≤5, 6-19, ≥20)
- Step 5 dispatches adversary then refiner
- Step 6 dispatches validator with retry logic
- Step 7 writes both JSON plan and campaign.md
- Feature-mode detection preserved from original
- Quality gates section present
- `node scripts/skill-lint.js` passes

---

## Phase 4: Create /prime, /evolve, /specify Skills

**Goal:** Add the compounding knowledge skills adapted from brain vault.
**Files:** 3 new skill directories
**Depends on:** Phase 2 (templates must exist for path references)
**Parallel with:** Phase 3

### Task 4.1: Create /prime skill

**Source:** Read `~/brain/.claude/skills/prime/SKILL.md`

**Write to:** `skills/prime/SKILL.md`

**Adaptation:**
- Frontmatter: Citadel style (name: prime, description with >- multiline, user-invocable: true, auto-trigger: false)
- Description: "Session startup — load reference files, check recent activity, orient to project state and active campaigns. Run at the start of every session."
- Phase 1: Load Context
  - Change: `docs/reference/MEMORY.md` → `.planning/reference/MEMORY.md`
  - Change: `docs/ai-development-workflow.md` → `CLAUDE.md`
  - Change: `docs/reference/session-learnings.md` → `.planning/reference/session-learnings.md`
  - Change: `docs/specs/INDEX.md` → `.planning/specs/INDEX.md`
  - ADD: Check `.planning/campaigns/` for active campaigns (Citadel-native)
  - ADD: Check `.planning/telemetry/` for recent session costs
- Phase 2: Check Recent Activity — keep git log + git status
- Phase 3: Output Report — keep structured format, add "Active Campaigns" section
- Rules: keep "Do NOT start any implementation"

**Verify:** File exists at `skills/prime/SKILL.md`. References `.planning/` paths (not `docs/`). Has 3 phases. `node scripts/skill-lint.js` passes.

### Task 4.2: Create /evolve skill

**Source:** Read `~/brain/.claude/skills/evolve/SKILL.md`

**Write to:** `skills/evolve/SKILL.md`

**Adaptation:**
- Frontmatter: Citadel style (name: evolve, description, user-invocable: true)
- Description: "Post-implementation — detect changes, update reference files, capture session learnings, suggest CLAUDE.md improvements. Run after every commit."
- Phase 1: Detect What Changed — keep git log reading
- Phase 2: Update Reference Files — change ALL paths:
  - `docs/reference/db-schema.md` → `.planning/reference/db-schema.md`
  - `docs/reference/api-patterns.md` → `.planning/reference/api-patterns.md`
  - `docs/reference/session-learnings.md` → `.planning/reference/session-learnings.md`
  - etc.
  - ADD: "If the reference file doesn't exist yet, create it and add a row to MEMORY.md"
- Phase 3: Update Specs Index — change `docs/specs/INDEX.md` → `.planning/specs/INDEX.md`
- Phase 4: Check CLAUDE.md — keep (suggestions only, no auto-modify)
- Phase 5: AI Layer Improvement — keep
- Phase 6: Summary — keep
- ADD: "If `.planning/knowledge/` exists (Citadel's /learn output), also check for relevant patterns to cross-reference"
- **Explicit removal list:** Remove references to: MCP server, `vault/` paths, Obsidian, telegram capture, `docs/specs/` (replace with `.planning/specs/`), `docs/reference/` (replace with `.planning/reference/`), `docs/ai-development-workflow.md` (replace with `CLAUDE.md`). Keep: git log reading, file categorization logic, reference file update mappings, session-learnings append, CLAUDE.md suggestion mode, spec INDEX update.
- Rules: keep "Always update session-learnings", "Never auto-modify CLAUDE.md"
- Expected output: ~80-100 lines (brain vault version is 104 lines, removal of vault-specific content reduces it)

**Verify:** File exists. All paths reference `.planning/`. Has 6 phases. No references to brain-vault-specific paths (no `vault/`, no `docs/reference/`).

### Task 4.3: Create /specify skill

**Source:** Read `~/brain/.claude/skills/specify/SKILL.md`

**Write to:** `skills/specify/SKILL.md`

**Adaptation:**
- Frontmatter: Citadel style (name: specify, description, user-invocable: true, argument-hint: "[feature description]")
- Description: "Co-author a feature spec with research and clarifying questions. Outputs to .planning/specs/. Run before /architect."
- Phase 1: Research — keep 3 subagents (codebase exploration, reference files, web research)
  - Change reference file paths to `.planning/reference/`
- Phase 2: Clarifying Questions — keep exactly (10-20 questions, one at a time, AskUserQuestion)
- Phase 3: Write Spec — keep 11 sections
  - Change: "Read `docs/specs/TEMPLATE.md`" → "Read `.planning/specs/TEMPLATE.md`"
  - Change: "Read `docs/reference/db-schema.md`" → "Read `.planning/reference/db-schema.md`" (if exists)
  - Remove brain-vault-specific references (MCP tools, vault conventions)
- Phase 4: Save and Present
  - Change: save to `.planning/specs/{slug}.md`
  - Change: update `.planning/specs/INDEX.md`
  - Change: suggest "Run `/architect .planning/specs/{slug}.md` to create the implementation plan"
- Rules: keep all (never skip questions, never guess naming, etc.)

**Verify:** File exists. Outputs to `.planning/specs/`. References `.planning/` paths. Has 4 phases. `node scripts/skill-lint.js` passes.

### Phase 4 Validation

```bash
ls skills/prime/SKILL.md skills/evolve/SKILL.md skills/specify/SKILL.md  # All exist
node scripts/skill-lint.js  # All pass
grep -r "docs/reference/" skills/prime/ skills/evolve/ skills/specify/  # Should return NOTHING (all converted to .planning/)
```

---

## Phase 5: Modify Archon for Task-Level Execution

**Goal:** Replace Archon's Step 2 (DECOMPOSE) and Step 3 (EXECUTE PHASES) with planner-driven task-level execution.
**Files:** 1 modified file (skills/archon/SKILL.md — 362 lines → ~450 lines)
**Depends on:** Phases 1, 2, 3

### Task 5.1: Modify Archon Step 1 — add legacy conversion

**Source:** Read `~/Citadel/skills/archon/SKILL.md` lines 1-50 (Step 1: WAKE UP)

**Modify:** `skills/archon/SKILL.md` — Step 1

**Add to Step 1**, after checking for active campaigns (around line 45):
```markdown
6. **Legacy check**: If resuming a campaign that has NO "Plan:" line in its Work Plan section:
   - Read the campaign's Phases table
   - For each phase, create a task in JSON format:
     - id: "task-{phase-number}"
     - description: phase name
     - acceptance_criteria: extracted from Phase End Conditions
     - depends_on: previous phase's task id (sequential)
     - target_files: extracted from phase scope (if stated)
   - Write to `.planning/plans/{slug}.json`
   - Add "Plan: .planning/plans/{slug}.json" to campaign's Work Plan section
   - Log: "Converted legacy campaign to task-level plan"
```

**Verify:** Step 1 now has 6 items (was 5). Legacy conversion creates JSON plan from flat phases.

### Task 5.2: Replace Archon Step 2 — delegate to /architect
**Depends on:** Task 5.1 (same file — must be sequential)

**Source:** Read `~/Citadel/skills/archon/SKILL.md` lines 52-90 (Step 2: DECOMPOSE)

**Replace Step 2 entirely with:**
```markdown
### Step 2: PLAN (new campaigns only)

Delegate planning to /architect (which runs the adversarial pipeline):

1. Determine input for /architect:
   - If direction references a spec (`.planning/specs/*.md`): pass spec path
   - If direction is a prompt: pass prompt text
2. Invoke the /architect skill with the input
   - /architect runs the full pipeline: architect→adversary→refiner→validator
   - /architect produces `.planning/plans/{slug}.json` AND `.planning/campaigns/{slug}.md`
3. Read the produced campaign file
4. Present plan summary to user:
   - Phase count, task count per phase, total tasks
   - Dependency layer count
   - Estimated sessions (1 session per ~5 tasks)
5. **HITL gate**: "Plan ready with {N} tasks across {P} phases. Review `.planning/plans/{slug}.json`. Approve to begin execution? [y/approve/modify]"
   - If modify: user edits the plan file, then re-invokes /archon to continue
   - If approve: proceed to Step 2.5 (DAEMONIZE?) then Step 3

Note: /architect handles the full adversarial pipeline including adaptive depth,
adversary critique, refiner fixes, and validator sign-off. Archon does not need
to re-implement any of that — just invoke the skill and use its output.
```

**Verify:** Step 2 invokes /architect instead of self-decomposing. HITL gate present. No direct agent dispatching in Step 2 (that's /architect's job).

### Task 5.3: Replace Archon Step 3 — task-level execution
**Depends on:** Task 5.2 (same file — must be sequential)

**Source:** Read `~/Citadel/skills/archon/SKILL.md` lines 127-195 (Step 3: EXECUTE PHASES)

**Replace Step 3 inner loop with:**
```markdown
### Step 3: EXECUTE TASKS

Read `.planning/plans/{slug}.json` for the task DAG.

For each phase in the plan:

1. **Gather phase tasks**: Flatten all tasks across epics/stories in this phase.
   Filter to tasks with status "pending" or "failed" (skip "complete" and "blocked").

2. **Group by dependency layers**:
   - Layer 0: tasks where `depends_on` is empty OR all dependencies are "complete"
   - Layer N: tasks whose dependencies are all in layers 0..N-1 and all "complete"
   - Tasks with unresolvable dependencies (depend on "blocked" tasks): mark as "blocked"

3. **Execute each layer** (sequential between layers, parallel within):
   
   For each task in the current layer:
   
   a. **Prepare context**: Read the task's description, acceptance_criteria, steps, target_files.
      Read CLAUDE.md. Read `.planning/reference/MEMORY.md` and load relevant reference files.
      Read `references/failure-modes.md` and `references/generator-recovery-protocol.md`.
      If task has feedback from a previous attempt: include it.
   
   b. **Dispatch generator agent**:
      - Use Agent tool with the generator agent
      - If multiple independent tasks in this layer: use `isolation: "worktree"` for parallel execution
      - If single task: run in main worktree
      - Prompt includes: full task context + all references + "You MUST output a HARNESS_STATUS block"
   
   c. **Parse HARNESS_STATUS** from generator output:
      - `STATUS: COMPLETE` → proceed to review (step d)
      - `STATUS: BLOCKED` → mark task "blocked" in plan + campaign, log reason, continue to next task
      - `STATUS: WORKING` or missing → treat as incomplete, increment attempts, retry if under limit
   
   d. **Multi-reviewer verification** (for COMPLETE tasks):
      - Dispatch code-reviewer agent (reads changed files, checks patterns/security/scope)
      - Run test suite via Bash (`node scripts/run-with-timeout.js 300 <test-command>`)
      - If BOTH approve: mark task "complete" in JSON plan + campaign Task Progress
      - If EITHER rejects:
        - Write feedback to `.planning/plans/{slug}-feedback-{task-id}.md`
        - Increment task.attempts in JSON plan
        - If attempts < 3: re-dispatch generator with feedback appended to context
        - If attempts >= 3: mark task "blocked", add to campaign Review Queue
   
   e. **Merge worktrees** if Fleet was used for parallel tasks in this layer:
      - Before dispatching parallel tasks: check if any two tasks in this layer share a file in `target_files`. If yes, run sequentially instead of parallel.
      - If `git merge` fails on worktree rejoin: (1) log conflict details to `.planning/plans/{slug}-merge-conflict.md`, (2) mark ALL tasks in this layer as "blocked", (3) add to Review Queue for human resolution, (4) do NOT proceed to next layer.
   
   f. **Update state**:
      - Update task statuses in `.planning/plans/{slug}.json`
      - Update campaign.md Task Progress table
      - Compress task outputs to ~500-token discovery briefs
      - Append briefs to campaign.md § Discoveries section

4. **Run Step 4 checks** (existing — direction alignment, quality spot-check, regression guard)

5. **Phase complete** when all layers done and all tasks are "complete" or "blocked"
```

**Verify:** Step 3 reads JSON plan. Groups tasks by dependency layers. Dispatches generators per-task. Parses HARNESS_STATUS. Multi-reviewer verification with retry (max 3). Updates both JSON plan and campaign.md.

### Task 5.4: Enhance Archon Step 6 — add task position to continuation
**Depends on:** Task 5.3 (same file — must be sequential)

**Source:** Read `~/Citadel/skills/archon/SKILL.md` lines 277-295 (Step 6: CONTINUATION)

**Add to Continuation State format:**
```markdown
Current-plan: .planning/plans/{slug}.json
Current-phase: {phase-id}
Current-layer: {layer-number}
Last-completed-task: {task-id}
Tasks-complete: {N}/{total}
Tasks-blocked: {N}
```

**Verify:** Step 6 includes task-level position information.

### Phase 5 Validation

```bash
node scripts/skill-lint.js  # archon passes
# Read the full SKILL.md and manually trace the flow:
# 1. Step 1 includes legacy conversion
# 2. Step 2 invokes /architect (not self-decompose)
# 3. Step 3 reads JSON plan, groups by layers, dispatches per-task
# 4. Steps 4, 5, 6, 7 preserved from original
# 5. Quality gates and circuit breakers unchanged
wc -l skills/archon/SKILL.md  # Should be ~430-460 lines
```

---


---

## Phase 5.5: Write Tests for New Components

**Goal:** Write tests covering the spec's test plan (section 10). No untested code ships.
**Files:** New test files
**Depends on:** Phase 5

### Task 5.5.1: Write HARNESS_STATUS parsing test

**Write to:** `scripts/test-harness-status.js` (or extend existing test infrastructure)

**Content:** Test the HARNESS_STATUS block parsing that Archon Step 3 relies on:
- Valid block → parsed correctly (STATUS, FILES_MODIFIED, TESTS_STATUS extracted)
- Malformed block (missing delimiter) → detected as error
- Missing block entirely → detected as incomplete
- STATUS values: COMPLETE, BLOCKED, WORKING each handled correctly

**Verify:** `node scripts/test-harness-status.js` passes with 0 failures.

### Task 5.5.2: Write adaptive depth threshold test

**Write to:** `scripts/test-adaptive-depth.js`

**Content:** Test the adaptive depth selection logic from /architect Step 4:
- 3-task plan → light (architect → validator only)
- 5-task plan → light (boundary)
- 6-task plan → standard (architect → adversary → refiner → validator)
- 19-task plan → standard (boundary)
- 20-task plan → double (architect → adversary → refiner → adversary → refiner → validator)
- 25-task plan → double

**Verify:** `node scripts/test-adaptive-depth.js` passes. All 6 boundary cases correct.

### Task 5.5.3: Write init-project scaffolding test

**Write to:** `scripts/test-scaffold.js`

**Content:** Persistent test (not just inline bash) that verifies init-project creates all new directories and copies all template files:
- `.planning/plans/` exists
- `.planning/specs/TEMPLATE.md` exists and has 11 section headers
- `.planning/specs/INDEX.md` exists and has table header
- `.planning/reference/MEMORY.md` exists and has "Read When" column
- `.planning/reference/session-learnings.md` exists
- `.planning/reference/feature-dev-standards.md` exists and has 3 sections
- Runs in temp dir, cleans up after

**Verify:** `node scripts/test-scaffold.js` passes.

### Task 5.5.4: Add new tests to test-all.js

**Modify:** `scripts/test-all.js`

**Changes:** Add the 3 new test scripts to the test runner so they're included in CI:
```javascript
// Adversarial planner tests
runTest('scripts/test-harness-status.js');
runTest('scripts/test-adaptive-depth.js');
runTest('scripts/test-scaffold.js');
```

**Verify:** `node scripts/test-all.js` runs all new tests alongside existing tests. 0 failures.

### Phase 5.5 Validation

```bash
node scripts/test-all.js  # All tests pass (existing + 3 new)
```

## Phase 6: Campaign Template Update + Integration Verification

**Goal:** Update campaign template with Task Progress section. Run all tests. Verify end-to-end.
**Files:** 1 modified template
**Depends on:** Phase 5.5

### Task 6.1: Update campaign template

**Source:** Read `~/Citadel/.planning/_templates/campaign.md` (111 lines)

**Modify:** `.planning/_templates/campaign.md`

**Add after the existing `## Phases` section and `## Phase End Conditions` section:**
```markdown
## Work Plan
<!-- Linked JSON plan. Created by /architect, read by Archon Step 3. -->
Plan: .planning/plans/{slug}.json
Spec: .planning/specs/{slug}.md
Tasks: {N} total (0 complete, 0 in-progress, {N} pending)
Current Phase: phase-0
Current Layer: 0

## Task Progress
<!-- Updated by Archon after each task execution. -->
| Task | Phase | Layer | Status | Attempts | Model | Files |
|------|-------|-------|--------|----------|-------|-------|
```

Keep ALL existing sections below (Feature Ledger, Decision Log, Review Queue, Circuit Breakers, Active Context, Continuation State).

**Verify:** Template has both Phases table AND Task Progress table. Existing sections preserved. `wc -l` increased by ~15 lines.

### Task 6.2: Run full test suite

```bash
cd ~/Citadel
node scripts/test-all.js          # All existing tests pass
node scripts/skill-lint.js        # All 43 skills pass (40 existing + 3 new)
```

**Expected results:**
- test-all.js: 0 failures
- skill-lint.js: 43 skills validated

### Task 6.3: Verify file counts

```bash
ls agents/ | wc -l                # 9 (4 existing + 5 new)
ls references/ | wc -l            # 2 (failure-modes + recovery-protocol)
ls skills/ | wc -l                # 43 (40 existing + prime + evolve + specify)
```

### Task 6.4: Verify template scaffolding

```bash
mkdir -p /tmp/citadel-final-test && cd /tmp/citadel-final-test && git init
CLAUDE_PROJECT_DIR=/tmp/citadel-final-test node ~/Citadel/hooks_src/init-project.js
test -d .planning/plans           && echo "PASS: plans dir"
test -d .planning/specs           && echo "PASS: specs dir"  
test -d .planning/reference       && echo "PASS: reference dir"
test -f .planning/specs/TEMPLATE.md    && echo "PASS: spec template"
test -f .planning/specs/INDEX.md       && echo "PASS: spec index"
test -f .planning/reference/MEMORY.md  && echo "PASS: MEMORY.md"
test -f .planning/reference/session-learnings.md && echo "PASS: session-learnings"
test -f .planning/reference/feature-dev-standards.md && echo "PASS: feature-dev-standards"
rm -rf /tmp/citadel-final-test
```

### Phase 6 Validation

All tests pass. All file counts match. Template scaffolding creates expected files.

---

## Summary

| Phase | Layer | Files | Description |
|-------|-------|-------|-------------|
| 1 | 0 | 7 new | Port architect, adversary, refiner, validator, generator agents + failure-modes + recovery-protocol |
| 2 | 0 | 6 new, 1 mod | Spec/reference templates + init-project.js scaffolding |
| 3 | 1 | 1 mod | Rewrite /architect with 4-pass adversarial pipeline |
| 4 | 1 | 3 new | Create /prime, /evolve, /specify skills |
| 5 | 2 | 1 mod | Modify Archon Steps 1, 2, 3, 6 for task-level execution |
| 5.5 | 2 | 4 new | Write tests: HARNESS_STATUS parsing, adaptive depth, scaffolding |
| 6 | 3 | 1 mod | Campaign template update + integration verification |
| **Total** | | **21 new, 3 mod** | |

**Phases 1+2 are parallel. Phases 3+4 are parallel. Phase 5 is sequential. Phase 6 is sequential.**

**Critical path:** Phase 1 → Phase 3 → Phase 5 → Phase 6
