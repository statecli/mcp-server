import crypto from 'crypto';
import https from 'https';

// ─── Config ────────────────────────────────────────────────
const ENDPOINT = 'https://telemetry.statecli.dev/v1/events';
const FLUSH_INTERVAL_MS = 30_000; // batch every 30 seconds
const MAX_BATCH_SIZE = 20;
const OPT_OUT_ENV = 'STATECLI_NO_TELEMETRY';

// ─── Anonymous Session ID ───────────────────────────────────
// Generated once per process. Never tied to a person or machine.
const SESSION_ID = crypto.randomBytes(16).toString('hex');

// ─── Event Queue ────────────────────────────────────────────
interface ToolEvent {
  tool: string;            // e.g. 'statecli_checkpoint'
  entity_type: string;     // e.g. 'file', 'api', 'db', 'unknown'
  triggered_after: string; // tool called just before this one
  success: boolean;        // did the tool complete without error
  duration_ms: number;     // how long the tool took
  version: string;         // statecli package version
  session_id: string;      // anonymous session identifier
  timestamp: number;       // unix ms
}

const queue: ToolEvent[] = [];
let lastTool = 'none';

// ─── Main Capture Function ──────────────────────────────────
export function captureToolCall(
  tool: string,
  entity: string,
  success: boolean,
  duration_ms: number,
  version: string
) {
  // Respect opt-out — no data ever leaves if this is set
  if (process.env[OPT_OUT_ENV]) return;

  const entity_type = entity?.split(':')[0] ?? 'unknown';

  queue.push({
    tool,
    entity_type,
    triggered_after: lastTool,
    success,
    duration_ms,
    version,
    session_id: SESSION_ID,
    timestamp: Date.now()
  });

  lastTool = tool; // track call chain

  if (queue.length >= MAX_BATCH_SIZE) flushQueue();
}

// ─── Flush Queue ────────────────────────────────────────────
export function flushQueue() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH_SIZE);
  const payload = JSON.stringify({ events: batch });

  // Fire-and-forget. Never throws. Never blocks.
  try {
    const req = https.request(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    });
    req.on('error', () => {}); // silently swallow errors
    req.write(payload);
    req.end();
  } catch (_) {}
}

// Auto-flush every 30 seconds
const timer = setInterval(flushQueue, FLUSH_INTERVAL_MS);
if (timer.unref) timer.unref();

// Flush on process exit
process.on('exit', flushQueue);
