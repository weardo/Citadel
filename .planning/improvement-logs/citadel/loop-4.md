# Loop 4 — Level 2, Iteration 1

> Date: 2026-03-28
> Rubric version: 2 (Level 2, first loop)
> Axis attacked: security_posture
> Level 2 activated axes: decomposition_quality, scope_appropriateness, verification_depth, compound_value_visibility, team_adoption_friction, skill_authoring_quality

## Scorecard (Level 2, pre-attack)

| Axis | A | B | C | Cap | Final |
|------|---|---|---|-----|-------|
| security_posture | 7 | 7 | 6 | PCAP→5 | 5 |
| onboarding_friction | 7 | 6 | 7 | PASS | 6 |
| documentation_accuracy | 7 | 7 | 6 | PASS | 6 |
| differentiation_clarity | 5 | 5 | 5 | PASS | 5 |
| decomposition_quality | 6 | 6 | 6 | PASS | 6 |
| documentation_coverage | 5 | 5 | 5 | PASS | 5 |
| test_coverage | 4 | 5 | 4 | PASS | 4 |
| demo_page_effectiveness | 5 | 5 | 5 | PASS | 5 |
| verification_depth | 5 | 5 | 5 | PASS | 5 |
| error_recovery | 5 | 4 | 4 | PASS | 4 |
| hook_reliability | 7 | 6 | 7 | PASS | 6 |
| readme_quality | 6 | 5 | 5 | PASS | 5 |
| compound_value_visibility | 3 | 3 | 3 | PASS | 3 |
| scope_appropriateness | 7 | 7 | 6 | PASS | 6 |
| command_discoverability | 5 | 5 | 5 | PASS | 5 |
| competitive_feature_coverage | 5 | 4 | 4 | PASS | 4 |
| team_adoption_friction | 3 | 3 | 3 | PASS | 3 |
| api_surface_consistency | 7 | 7 | 7 | PASS | 7 |
| skill_authoring_quality | 4 | 4 | 4 | PASS | 4 |
| visual_coherence | 7 | 6 | 7 | PASS | 6 |

## Selection

Winner: **security_posture** — 5 × 0.95 × 1.0 = 4.75

Reason for PCAP: `hooks_src/issue-monitor.js:11` imported `{ execSync, execFileSync }`.
The security_posture programmatic check requires grep for `execSync` in hooks_src/ to return 0.
execSync was never called — stale leftover from earlier version of the file.

## Attack Summary

**Root cause**: unused execSync import. Not a behavioral risk (never called) but a structural violation that failed the programmatic audit and capped the axis at 5 regardless of real security quality.

**Alternatives considered**:
- Comment it out as documented non-use — rejected (grep still finds it, comment is noise)
- Remove the whole import and add execFileSync separately — identical outcome, unnecessary restructure
- Remove only execSync from the destructure — chosen (minimal diff)

**Chosen approach**: single-token change to destructure: `{ execSync, execFileSync }` → `{ execFileSync }`

**Files modified**: `hooks_src/issue-monitor.js` (1 line)

## Verification

**Programmatic**: `grep -r "execSync" hooks_src/` — 0 matches. Structural violation resolved.
**Smoke tests**: 70 passed, 0 failed (`node hooks_src/smoke-test.js`)
**Change-specific**: the specific import line was the target; its absence is directly verified by the grep result.
**Behavioral**: SKIPPED (Windows temp dir constraints; behavioral sim not yet set up)

## Post-attack score: security_posture

| A | B | C | Cap | Final |
|---|---|---|-----|-------|
| 7 | 7 | 6 | PASS | **6** |

Δ: 5 → 6 (+1). Programmatic cap lifted.

## Notes for next loop

Remaining security_posture gap to Level 2 10: SHA-256 verification for external skills, full audit.jsonl coverage for all block events, recursive glob support in protect-files. These are medium-high effort; verification_depth (5) and skill_authoring_quality (4) may be higher selection score next loop.

Level 2 baseline established: 20 axes scored, lowest = team_adoption_friction and compound_value_visibility at 3.
