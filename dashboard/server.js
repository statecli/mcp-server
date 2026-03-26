/**
 * StateCLI Dashboard Server
 * Reads local .statecli storage and serves a real-time analytics API
 * Run: node dashboard/server.js
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 4000;

// Serve the dashboard UI
app.use(express.static(path.join(__dirname)));

// ─── Helpers ──────────────────────────────────────────────────

function readStateCLIEvents(dir) {
  const events = [];
  if (!fs.existsSync(dir)) return events;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const raw = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
          const data = JSON.parse(raw);
          if (Array.isArray(data)) events.push(...data);
          else if (data && typeof data === 'object') events.push(data);
        } catch (_) {}
      }
    }
  } catch (_) {}
  return events;
}

function getStorageDirs() {
  const cwd = process.cwd();
  const home = os.homedir();
  const candidates = [
    path.join(cwd, '.statecli'),
    path.join(home, '.statecli'),
  ];
  return candidates.filter(d => fs.existsSync(d));
}

function getAllEvents() {
  const events = [];
  for (const dir of getStorageDirs()) {
    events.push(...readStateCLIEvents(dir));
    // Also check subdirectories (sessions)
    try {
      const subs = fs.readdirSync(dir, { withFileTypes: true });
      for (const sub of subs) {
        if (sub.isDirectory()) {
          events.push(...readStateCLIEvents(path.join(dir, sub.name)));
        }
      }
    } catch (_) {}
  }
  return events.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

// ─── API Routes ────────────────────────────────────────────────

// Summary stats
app.get('/api/stats', (req, res) => {
  const events = getAllEvents();
  const toolCounts = {};
  const entityTypes = {};
  let successCount = 0;
  let totalDuration = 0;
  let durationCount = 0;
  const sessions = new Set();

  for (const e of events) {
    if (e.tool) toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1;
    if (e.entity_type) entityTypes[e.entity_type] = (entityTypes[e.entity_type] || 0) + 1;
    if (e.success === true) successCount++;
    if (typeof e.duration_ms === 'number') { totalDuration += e.duration_ms; durationCount++; }
    if (e.session_id) sessions.add(e.session_id);
  }

  res.json({
    total_events: events.length,
    unique_sessions: sessions.size,
    success_rate: events.length ? Math.round((successCount / events.length) * 100) : 0,
    avg_duration_ms: durationCount ? Math.round(totalDuration / durationCount) : 0,
    top_tools: Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
    entity_types: Object.entries(entityTypes).sort((a, b) => b[1] - a[1]),
  });
});

// Recent events feed
app.get('/api/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const events = getAllEvents().slice(0, limit);
  res.json(events);
});

// Web searches
app.get('/api/searches', (req, res) => {
  const events = getAllEvents()
    .filter(e => e.tool === 'statecli_search_web' || e.tool === 'statecli_read_url')
    .slice(0, 100);
  res.json(events);
});

// Tool timeline (hourly buckets for last 24h)
app.get('/api/timeline', (req, res) => {
  const events = getAllEvents();
  const now = Date.now();
  const buckets = {};
  for (let i = 23; i >= 0; i--) {
    const h = new Date(now - i * 3600000);
    const key = `${h.getHours()}:00`;
    buckets[key] = 0;
  }
  for (const e of events) {
    if (!e.timestamp) continue;
    const age = now - e.timestamp;
    if (age > 86400000) continue;
    const h = new Date(e.timestamp);
    const key = `${h.getHours()}:00`;
    if (key in buckets) buckets[key]++;
  }
  res.json(Object.entries(buckets).map(([hour, count]) => ({ hour, count })));
});

// Sessions list
app.get('/api/sessions', (req, res) => {
  const events = getAllEvents();
  const sessionMap = {};
  for (const e of events) {
    const sid = e.session_id || 'unknown';
    if (!sessionMap[sid]) sessionMap[sid] = { session_id: sid, events: 0, first_seen: e.timestamp, last_seen: e.timestamp, tools: new Set() };
    sessionMap[sid].events++;
    if (e.timestamp < sessionMap[sid].first_seen) sessionMap[sid].first_seen = e.timestamp;
    if (e.timestamp > sessionMap[sid].last_seen) sessionMap[sid].last_seen = e.timestamp;
    if (e.tool) sessionMap[sid].tools.add(e.tool);
  }
  res.json(Object.values(sessionMap).map(s => ({ ...s, tools: s.tools.size })).slice(0, 50));
});

app.listen(PORT, () => {
  console.log(`\n🚀 StateCLI Dashboard running at http://localhost:${PORT}\n`);
});
