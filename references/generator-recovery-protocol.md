# Generator Recovery Protocol

Injected into generator prompts at runtime. These steps run BEFORE implementation.

## Recovery Check (MANDATORY FIRST STEP)

1. Check if `.planning/plans/{slug}-feedback-{task-id}.md` exists for your current task.
   - If YES: Read it. This is evaluator feedback on your previous work. Address ALL issues before new work.
   - If NO: Continue.

2. Check your task's `attempts` field in the work plan.
   - If `attempts > 0`: this is a retry. Read previous feedback carefully. Do not repeat the same approach that failed.

## Regression Check (MANDATORY)

Before starting new work:
1. Read the test command from CLAUDE.md or `.claude/harness.json`
2. Run it to verify existing tests pass
3. If ANY test fails: fix the regression BEFORE starting new work

**If regression found:**
1. Fix the regression first
2. Re-verify all tests pass
3. Then proceed with the assigned task

## Browser Verification (web projects only)

After implementation, if the project has a web UI:
- Navigate to the app in browser
- Interact like a real user (click, type, scroll)
- Take screenshots at each step
- Check for: console errors, broken layouts, white-on-white text
- Do NOT only test with curl
