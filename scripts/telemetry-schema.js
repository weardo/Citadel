#!/usr/bin/env node

/**
 * telemetry-schema.js — Canonical schema definitions for all telemetry writers.
 *
 * Defines the shape of every JSONL event written by the harness.
 * Import this in any script that reads or writes telemetry to ensure
 * consistent structure across all writers.
 */

'use strict';

// ── Schema version ────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 1;

// ── Agent run events (agent-runs.jsonl) ───────────────────────────────────────

/** Valid event type strings for agent-runs.jsonl. */
const AGENT_RUN_EVENT_TYPES = [
  'agent-start',
  'agent-complete',
  'agent-fail',
  'campaign-start',
  'campaign-complete',
  'wave-start',
  'wave-complete',
  'agent-timeout',
];

const AGENT_RUN_STATUS_VALUES = ['success', 'partial', 'failed'];

/**
 * Validate an agent-run event entry.
 * @param {object} entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAgentRunEvent(entry) {
  const errors = [];

  if (!entry || typeof entry !== 'object') {
    return { valid: false, errors: ['entry must be an object'] };
  }

  if (typeof entry.timestamp !== 'string' || !entry.timestamp) {
    errors.push('timestamp must be a non-empty string (ISO 8601)');
  }

  if (!AGENT_RUN_EVENT_TYPES.includes(entry.event)) {
    errors.push(`event must be one of: ${AGENT_RUN_EVENT_TYPES.join(', ')} — got: ${entry.event}`);
  }

  if (typeof entry.agent !== 'string' || !entry.agent) {
    errors.push('agent must be a non-empty string');
  }

  if (entry.session !== null && entry.session !== undefined && typeof entry.session !== 'string') {
    errors.push('session must be a string or null');
  }

  if (entry.duration_ms !== null && entry.duration_ms !== undefined && typeof entry.duration_ms !== 'number') {
    errors.push('duration_ms must be a number or null');
  }

  if (
    entry.status !== null &&
    entry.status !== undefined &&
    !AGENT_RUN_STATUS_VALUES.includes(entry.status)
  ) {
    errors.push(`status must be one of: ${AGENT_RUN_STATUS_VALUES.join(', ')} or null — got: ${entry.status}`);
  }

  if (entry.meta !== null && entry.meta !== undefined && typeof entry.meta !== 'object') {
    errors.push('meta must be an object or null');
  }

  return { valid: errors.length === 0, errors };
}

// ── Hook timing events (hook-timing.jsonl) ────────────────────────────────────

const HOOK_TIMING_EVENT_TYPES = ['timing', 'counter'];

/**
 * Validate a hook-timing event entry.
 * @param {object} entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateHookTimingEvent(entry) {
  const errors = [];

  if (!entry || typeof entry !== 'object') {
    return { valid: false, errors: ['entry must be an object'] };
  }

  if (typeof entry.timestamp !== 'string' || !entry.timestamp) {
    errors.push('timestamp must be a non-empty string (ISO 8601)');
  }

  if (typeof entry.hook !== 'string' || !entry.hook) {
    errors.push('hook must be a non-empty string');
  }

  // event field is optional — existing writers don't include it
  if (entry.event !== undefined && !HOOK_TIMING_EVENT_TYPES.includes(entry.event)) {
    errors.push(`event must be one of: ${HOOK_TIMING_EVENT_TYPES.join(', ')} — got: ${entry.event}`);
  }

  if (
    entry.metric !== null &&
    entry.metric !== undefined &&
    typeof entry.metric !== 'string'
  ) {
    errors.push('metric must be a string or null');
  }

  if (
    entry.duration_ms !== null &&
    entry.duration_ms !== undefined &&
    typeof entry.duration_ms !== 'number'
  ) {
    errors.push('duration_ms must be a number or null');
  }

  return { valid: errors.length === 0, errors };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  SCHEMA_VERSION,
  AGENT_RUN_EVENT_TYPES,
  validateAgentRunEvent,
  validateHookTimingEvent,
};
