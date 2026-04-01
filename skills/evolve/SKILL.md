---
name: evolve
description: >-
  Post-implementation — detect changes from git, update reference files,
  capture session learnings, suggest CLAUDE.md improvements. Run after
  every commit to compound project knowledge.
user-invocable: true
auto-trigger: false
---

# /evolve — Knowledge Compounding Engine

## Identity

You are the evolution engine. After every implementation session, you detect what changed and update the project's knowledge base so the next session is faster and more accurate.

## Protocol

### Phase 1: Detect What Changed

Read `git log --stat` since the last evolve (check `.planning/reference/.last-evolve` for the marker commit, or use the last 1-2 commits if no marker exists).

Categorize each change:
- **DB schema**: new tables, migrations, schema changes
- **API endpoints**: new routes, changed request/response formats
- **UI patterns**: new components, layout changes
- **External services**: new integrations, API key additions
- **Bugs/gotchas**: fixes that revealed non-obvious behavior
- **Test patterns**: new testing approaches or conventions

### Phase 2: Update Reference Files

For each category of change detected, update the corresponding reference file in `.planning/reference/`:

| Change Type | Reference File |
|-------------|---------------|
| DB schema changes | `db-schema.md` |
| API endpoints | `api-patterns.md` |
| External service integration | `external-services.md` |
| UI patterns | `ui-patterns.md` |
| Test patterns | `testing-strategy.md` |
| Bug, gotcha, or correction | `session-learnings.md` (always append) |

**If the reference file doesn't exist yet:** create it with a descriptive header, then add the content. Also add a new row to `MEMORY.md` with an appropriate "Read When" annotation.

**Always append to `session-learnings.md`:** Every session should capture at least one learning, even if it's "no surprises this session."

### Phase 3: Update Specs Index

If a spec was implemented this session:
- Update `.planning/specs/INDEX.md` — change status to "Complete" or "In Progress"

### Phase 4: Check CLAUDE.md

Review what was learned this session. Suggest additions to CLAUDE.md if:
- A new build/test command was discovered
- A new convention was established
- A gotcha would be prevented by a CLAUDE.md rule

**Present suggestions to the user — never auto-modify CLAUDE.md.**

### Phase 5: AI Layer Improvement

Reflect on the implementation session:
- Were there hallucinations? → Suggest adding a reference file with correct patterns
- Was output quality poor? → Suggest adding design pattern docs
- Were tests missing? → Suggest updating testing strategy
- Struggling with patterns? → Capture in session-learnings.md

### Phase 6: Summary

Output:
```
## Evolve Summary

### Reference Files Updated
- session-learnings.md: added "{learning title}"
- db-schema.md: added table "users_permissions"

### Specs Index
- add-auth.md: status changed to "Complete"

### CLAUDE.md Suggestions
- [ ] Add "npm run test:auth" to test commands
- [ ] Add "JWT tokens use RS256, not HS256" to conventions

### Marker
Last evolve: {commit hash}
```

Write the commit hash to `.planning/reference/.last-evolve`.

## Rules
- Always update session-learnings.md — every session has at least one learning
- Never auto-modify CLAUDE.md — only suggest
- If `.planning/knowledge/` exists (Citadel's /learn output), cross-reference for relevant campaign patterns
- Reference files should stay under 500 lines — split if growing too large
- Remove explicit references to: MCP servers, vault/ paths, Obsidian, telegram

## Quality Gates

- Report must be factual — never fabricate file contents or test results
- Reference files loaded must actually exist (skip missing files gracefully)
- All file paths must be verified before referencing

## Exit Protocol

```
---HANDOFF---
- Reference files updated: {count}
- Session learnings added: {count}
- CLAUDE.md suggestions: {count}
- Specs updated: {list}
---
```
