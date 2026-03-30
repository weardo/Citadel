#!/usr/bin/env node

/**
 * test-all.js - Full fast test suite for Citadel
 *
 * Runs both hook smoke tests and skill lint checks in sequence.
 * Fast (no network, no LLM calls). Suitable for CI and pre-commit.
 *
 * For execution-based scenario testing (requires claude CLI):
 *   node scripts/skill-bench.js --execute
 *
 * Usage:
 *   node scripts/test-all.js           # hooks + skills
 *   node scripts/test-all.js --strict  # treat skill WARNs as failures
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const SMOKE_TEST = path.join(PLUGIN_ROOT, 'hooks_src', 'smoke-test.js');
const SKILL_LINT = path.join(PLUGIN_ROOT, 'scripts', 'skill-lint.js');
const DEMO_TEST = path.join(PLUGIN_ROOT, 'scripts', 'test-demo.js');
const SECURITY_TEST = path.join(PLUGIN_ROOT, 'scripts', 'test-security.js');
const RUNTIME_CONTRACT_TEST = path.join(PLUGIN_ROOT, 'scripts', 'test-runtime-contracts.js');

const STRICT = process.argv.includes('--strict');

console.log('\nCitadel Full Test Suite\n' + '='.repeat(40));
console.log('Running: hook smoke test + security tests + runtime contract test + skill lint + demo routing check\n');

function run(label, scriptPath, extraArgs = []) {
  console.log(`\n> ${label}`);
  console.log('-'.repeat(40));

  try {
    execFileSync(process.execPath, [scriptPath, ...extraArgs], {
      cwd: PLUGIN_ROOT,
      stdio: 'inherit',
      encoding: 'utf8',
    });
    return true;
  } catch (_err) {
    return false;
  }
}

const hooksPassed = run('Hook Smoke Test', SMOKE_TEST);
const securityPassed = run('Security Tests', SECURITY_TEST);
const contractsPassed = run('Runtime Contract Tests', RUNTIME_CONTRACT_TEST);
const lintArgs = STRICT ? ['--warn-as-fail'] : [];
const skillsPassed = run('Skill Lint', SKILL_LINT, lintArgs);
const demoPassed = run('Demo Routing Check', DEMO_TEST);

console.log('\n' + '='.repeat(40));
console.log('SUMMARY');
console.log(`  Hook smoke test:    ${hooksPassed ? 'PASS' : 'FAIL'}`);
console.log(`  Security tests:     ${securityPassed ? 'PASS' : 'FAIL'}`);
console.log(`  Runtime contracts:  ${contractsPassed ? 'PASS' : 'FAIL'}`);
console.log(`  Skill lint:         ${skillsPassed ? 'PASS' : 'FAIL'}`);
console.log(`  Demo routing check: ${demoPassed ? 'PASS' : 'FAIL'}`);
console.log('');

if (hooksPassed && securityPassed && contractsPassed && skillsPassed && demoPassed) {
  console.log('All tests pass.\n');
  console.log('Next steps:');
  console.log('  node scripts/skill-bench.js --list      see benchmark scenarios');
  console.log('  node scripts/skill-bench.js             validate scenario files');
  console.log('  node scripts/skill-bench.js --execute   run against claude CLI\n');
  process.exit(0);
}

const hookFail = !hooksPassed ? 1 : 0;
const securityFail = !securityPassed ? 2 : 0;
const contractFail = !contractsPassed ? 4 : 0;
const skillFail = !skillsPassed ? 8 : 0;
const demoFail = !demoPassed ? 16 : 0;
const code = hookFail | securityFail | contractFail | skillFail | demoFail;

if (!hooksPassed) console.log('Hook smoke test failed. Fix hook issues before proceeding.');
if (!securityPassed) console.log('Security tests failed. DO NOT SHIP - critical vulnerabilities present.');
if (!contractsPassed) console.log('Runtime contract tests failed. Fix the contract skeleton before proceeding.');
if (!skillsPassed) console.log('Skill lint failed. Fix FAIL-level issues before shipping.');
if (!demoPassed) console.log('Demo routing check failed. Fix routing bugs in docs/index.html before shipping.');
console.log('');
process.exit(code);
