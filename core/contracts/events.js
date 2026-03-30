#!/usr/bin/env node

'use strict';

const CIT_EVENT_IDS = Object.freeze({
  SESSION_START: 'session_start',
  PRE_TOOL: 'pre_tool',
  POST_TOOL: 'post_tool',
  POST_TOOL_FAILURE: 'post_tool_failure',
  USER_PROMPT: 'user_prompt',
  STOP: 'stop',
  STOP_FAILURE: 'stop_failure',
  SESSION_END: 'session_end',
  PRE_COMPACT: 'pre_compact',
  POST_COMPACT: 'post_compact',
  SUBAGENT_STOP: 'subagent_stop',
  TASK_CREATED: 'task_created',
  TASK_COMPLETED: 'task_completed',
  WORKTREE_CREATE: 'worktree_create',
  WORKTREE_REMOVE: 'worktree_remove',
});

const CIT_EVENT_ORDER = Object.freeze([
  CIT_EVENT_IDS.SESSION_START,
  CIT_EVENT_IDS.PRE_TOOL,
  CIT_EVENT_IDS.POST_TOOL,
  CIT_EVENT_IDS.POST_TOOL_FAILURE,
  CIT_EVENT_IDS.USER_PROMPT,
  CIT_EVENT_IDS.STOP,
  CIT_EVENT_IDS.STOP_FAILURE,
  CIT_EVENT_IDS.SESSION_END,
  CIT_EVENT_IDS.PRE_COMPACT,
  CIT_EVENT_IDS.POST_COMPACT,
  CIT_EVENT_IDS.SUBAGENT_STOP,
  CIT_EVENT_IDS.TASK_CREATED,
  CIT_EVENT_IDS.TASK_COMPLETED,
  CIT_EVENT_IDS.WORKTREE_CREATE,
  CIT_EVENT_IDS.WORKTREE_REMOVE,
]);

const REQUIRED_EVENT_FIELDS = Object.freeze([
  'event_id',
  'runtime',
  'timestamp',
]);

function isKnownCitadelEvent(eventId) {
  return CIT_EVENT_ORDER.includes(eventId);
}

module.exports = Object.freeze({
  CIT_EVENT_IDS,
  CIT_EVENT_ORDER,
  REQUIRED_EVENT_FIELDS,
  isKnownCitadelEvent,
});
