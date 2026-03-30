#!/usr/bin/env node

/**
 * external-action-gate.js - PreToolUse hook (Bash)
 *
 * Uses the First-Encounter Consent pattern to handle external actions.
 *
 * Three tiers:
 *   SECRETS - Always blocked. Reading .env files via Bash.
 *   HARD    - Always blocked per-action. Irreversible by default (merge, close,
 *             delete, release, fork). Configurable via policy.externalActions.hard.
 *   SOFT    - Governed by consent preference. Reversible by default (push, PR
 *             create, comment). Configurable via policy.externalActions.soft.
 *
 * Policy overrides (harness.json):
 *   policy.externalActions.protectedBranches - branches that can never be deleted
 *   policy.externalActions.hard  - labels that are always per-action confirmed
 *   policy.externalActions.soft  - labels governed by consent preference
 *
 * When a label appears in both hard[] and soft[], hard wins.
 * When a label is in soft[] but was in default HARD, it moves to consent-gated.
 * This lets users unlock merge/close for autonomous workflows.
 *
 * Exit codes:
 *   0 = allowed
 *   2 = blocked - agent must get user approval first
 */

const health = require('./harness-health-util');
const {
  detectExternalAction,
  readExternalActionPolicy,
} = require('../core/policy/external-actions');

const CITADEL_UI = process.env.CITADEL_UI === 'true';

function hookOutput(hookName, action, message, data = {}) {
  if (CITADEL_UI) {
    process.stdout.write(JSON.stringify({
      hook: hookName,
      action,
      message,
      timestamp: new Date().toISOString(),
      data,
    }));
  } else {
    process.stdout.write(message);
  }
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      run(input);
    } catch {
      process.exit(0);
    }
  });
}

function run(input) {
  let event;
  try {
    event = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  if ((event.tool_name || '') !== 'Bash') process.exit(0);

  const command = event.tool_input?.command || '';
  if (!command) process.exit(0);

  const policy = readExternalActionPolicy(health.readConfig());
  const action = detectExternalAction(command, policy);

  if (!action) process.exit(0);

  if (action.kind === 'secret') {
    health.logBlock('external-action-gate', 'blocked', `${action.label}: ${command.slice(0, 200)}`);
    hookOutput(
      'external-action-gate',
      'blocked',
      `[external-action-gate] Blocked: "${action.label}" reads secrets. This is always blocked.`,
      { label: action.label, tier: action.tier }
    );
    process.exit(2);
  }

  if (action.kind === 'protected-branch') {
    health.logBlock('external-action-gate', 'blocked', `delete protected branch ${action.branch}: ${command.slice(0, 200)}`);
    hookOutput(
      'external-action-gate',
      'blocked',
      `[external-action-gate] Blocked: "${action.branch}" is a protected branch and cannot be deleted. ` +
      `This is configured in harness.json under policy.externalActions.protectedBranches.`,
      { label: action.label, tier: action.tier }
    );
    process.exit(2);
  }

  if (action.tier === 'allow') process.exit(0);

  if (action.tier === 'hard') {
    health.logBlock('external-action-gate', 'blocked', `${action.label}: ${command.slice(0, 200)}`);
    hookOutput(
      'external-action-gate',
      'blocked',
      `[external-action-gate] "${action.label}" requires approval. ` +
      `Show the user the exact content and get confirmation before executing.`,
      { label: action.label, tier: action.tier }
    );
    process.exit(2);
  }

  const consent = health.checkConsent('externalActions');
  if (consent.action === 'allow') process.exit(0);

  if (consent.action === 'first-encounter') {
    health.logBlock('external-action-gate', 'first-encounter', `${action.label}: ${command.slice(0, 200)}`);
    hookOutput(
      'external-action-gate',
      'first-encounter',
      `[external-action-gate] This is your first external action ("${action.label}").\n` +
      `Citadel can push branches, create PRs, and post comments on your behalf.\n\n` +
      `How would you like to handle this going forward?\n` +
      `  1. "always-ask"    - Ask me every time before any external action\n` +
      `  2. "session-allow" - Allow for this session, ask again next session\n` +
      `  3. "auto-allow"    - I trust the agent, don't ask again\n\n` +
      `Tell the user these three options and ask which they prefer.\n` +
      `Then write their choice to harness.json:\n` +
      `  node -e "require('./hooks_src/harness-health-util').writeConsent('externalActions', '<choice>')"` +
      `\nFor "session-allow", also run:\n` +
      `  node -e "require('./hooks_src/harness-health-util').grantSessionAllow('externalActions')"` +
      `\nThen retry the command.`,
      { label: action.label, tier: action.tier, consent: 'first-encounter' }
    );
    process.exit(2);
  }

  health.logBlock('external-action-gate', 'consent-block', `${action.label}: ${command.slice(0, 200)}`);

  const pref = health.readConsent('externalActions');
  if (pref === 'session-allow') {
    hookOutput(
      'external-action-gate',
      'consent-block',
      `[external-action-gate] New session: "${action.label}" needs approval.\n` +
      `Your preference is "session-allow" -- approve this to allow external actions for this session.\n` +
      `Ask the user for approval. If approved, run:\n` +
      `  node -e "require('./hooks_src/harness-health-util').grantSessionAllow('externalActions')"` +
      `\nThen retry.`,
      { label: action.label, tier: action.tier, consent: 'session-renew' }
    );
  } else {
    hookOutput(
      'external-action-gate',
      'consent-block',
      `[external-action-gate] "${action.label}" is an external action.\n` +
      `Show the user the exact content and get approval before executing.\n` +
      `After approval, run:\n` +
      `  node -e "require('./hooks_src/harness-health-util').grantOneTimeAllow('externalActions')"` +
      `\nThen retry the command.`,
      { label: action.label, tier: action.tier, consent: 'always-ask' }
    );
  }

  process.exit(2);
}

main();
