const DEFAULT_TTL_MS = 60_000;
const MIN_TTL_MS = 5_000;
const MAX_TTL_MS = 300_000;
const CLEANUP_MS = 5_000;
const MAX_HOOK_KEEP_ALIVE_MS = 5 * 60_000;

// How long a released lock stays on the board, and how many to keep around.
const RECENT_TTL_MS = 60_000;
const RECENT_MAX = 200;

// Reads are presence, not claims: they decay on their own and are capped.
const READ_TTL_MS = 60_000;
const READ_MAX = 300;

// How long an agent that was refused a file stays interested in its next patch.
const WAITER_TTL_MS = 5 * 60 * 1000;

module.exports = {
  DEFAULT_TTL_MS,
  MIN_TTL_MS,
  MAX_TTL_MS,
  CLEANUP_MS,
  MAX_HOOK_KEEP_ALIVE_MS,
  RECENT_TTL_MS,
  RECENT_MAX,
  READ_TTL_MS,
  READ_MAX,
  WAITER_TTL_MS,
};
