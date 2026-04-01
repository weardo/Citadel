---
name: specify
description: >-
  Co-author a feature spec with codebase research and clarifying questions.
  Outputs structured spec to .planning/specs/. Run before /architect to
  produce high-quality planner input.
user-invocable: true
auto-trigger: false
argument-hint: "[feature description]"
---

# /specify — Feature Spec Co-Author

## Identity

Create a complete feature spec by researching the codebase, asking clarifying questions, and filling an 11-section template. The goal is to reduce assumptions to near zero before any code is planned.

**Feature:** $ARGUMENTS (if empty, ask the user what feature to specify)

## Protocol

### Phase 1: Research (Subagents)

Spin off these subagents in parallel:

**Subagent 1: Codebase Exploration**
- What files and patterns are relevant to this feature?
- Are there similar features already implemented? (grep for related functions, routes, components)
- What existing patterns should this feature follow?

**Subagent 2: Reference Files**
- Read `.planning/reference/MEMORY.md` — load relevant reference files
- Read any domain-specific reference files that match the feature area (db-schema, api-patterns, etc.)

**Subagent 3: Web Research** (if applicable)
- Only if the feature involves external integrations or unfamiliar technology

### Phase 2: Clarifying Questions

Based on research findings, ask the user questions to eliminate assumptions:

- Use the AskUserQuestion tool with multiple choice options (2-4 options per question)
- Ask ONE question at a time
- Aim for 10-20 questions covering:
  - Scope boundaries (what's in, what's out)
  - Data model decisions (what to store, where)
  - API design choices (endpoints, auth, pagination)
  - UI layout preferences (if applicable)
  - Edge cases (what happens when X fails, what if Y is empty)
  - Testing priorities (what's critical to verify)
- Stop asking when you're confident you understand the full scope

### Phase 3: Write Spec

Read `.planning/specs/TEMPLATE.md` for the exact section structure.

Fill ALL 11 sections:

1. **Goal** — 1-2 sentences
2. **Background** — why needed, context, pain points
3. **Architecture** — data flow diagram (ASCII), key interfaces
4. **Data Model / DB Schema** — exact schema changes, follow existing conventions
5. **API Contract** — full endpoint table with request/response examples
6. **Business Logic** — rules, edge cases, validation, authorization
7. **UI Changes** — pages, routes, components (if applicable)
8. **Dependencies & Ordering** — implementation sequence
9. **Migration Plan** — backward compatibility, feature flags
10. **Test Plan** — unit, integration, E2E scenarios
11. **Out of Scope** — what this does NOT include

### Phase 4: Save and Present

1. Save spec to `.planning/specs/{slug}.md`
2. Update `.planning/specs/INDEX.md` — add new row with status "Draft"
3. Output the complete spec for human review
4. Ask: "Review each section. I'll revise anything that doesn't match your intent. Once approved, run `/architect .planning/specs/{slug}.md`."

## Rules
- NEVER skip the clarifying questions phase. This is the most valuable step.
- NEVER guess database naming — follow existing conventions from reference files.
- NEVER write generic descriptions — reference specific existing patterns found in Phase 1.
- If the feature is too large for one spec, suggest splitting and explain the split.

## Quality Gates

- Report must be factual — never fabricate file contents or test results
- Reference files loaded must actually exist (skip missing files gracefully)
- All file paths must be verified before referencing

## Exit Protocol

```
---HANDOFF---
- Spec: .planning/specs/{slug}.md
- Status: Draft (awaiting review)
- Sections: 11/11 complete
- Next: review spec, then /architect .planning/specs/{slug}.md
---
```
