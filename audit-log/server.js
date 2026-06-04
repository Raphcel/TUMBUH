/**
 * TUMBUH Audit Log Server
 *
 * Lightweight Express server that receives audit events via POST /log,
 * writes structured JSON log files with Winston, and serves an operations
 * dashboard for the accounting layer.
 */

const express = require('express');
const cors = require('cors');
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const logsDir = path.join(__dirname, 'logs');
const chainStateFile = path.join(logsDir, 'audit-chain-state.json');
const DASHBOARD_KEY = process.env.AUDIT_DASHBOARD_KEY || '';
const DASHBOARD_COOKIE = 'tumbuh_audit_auth';
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000/api/v1';

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function loadLastHash() {
  try {
    const state = JSON.parse(fs.readFileSync(chainStateFile, 'utf-8'));
    return state.lastHash || 'GENESIS';
  } catch (_err) {
    return 'GENESIS';
  }
}

function canonicalJson(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function parseCookies(req) {
  return String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf('=');
      if (index === -1) return acc;
      acc[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return acc;
    }, {});
}

function isDashboardAuthorized(req) {
  if (!DASHBOARD_KEY) return true;
  const cookies = parseCookies(req);
  return cookies[DASHBOARD_COOKIE] === DASHBOARD_KEY || req.get('x-audit-dashboard-key') === DASHBOARD_KEY;
}

function requireDashboardAuth(req, res, next) {
  if (isDashboardAuthorized(req)) return next();
  if (req.path === '/' && req.method === 'GET') return renderLogin(res, Boolean(req.query.failed));
  return res.status(401).json({ error: 'Audit dashboard authorization required' });
}

function renderLogin(res, failed = false) {
  res.status(401).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TUMBUH Audit Access</title>
  <style>
    body { min-height:100vh; margin:0; display:grid; place-items:center; font-family:Inter,system-ui,sans-serif; background:#eef4f0; color:#111827; }
    .card { width:min(420px, calc(100% - 32px)); padding:28px; border:1px solid #dfe8e3; border-radius:24px; background:#fff; box-shadow:0 20px 60px rgba(11,28,45,.12); }
    .mark { width:44px; height:44px; border-radius:14px; display:grid; place-items:center; background:#1a8754; color:white; font-weight:900; font-size:24px; }
    h1 { margin:18px 0 8px; font-size:28px; letter-spacing:-.04em; }
    p { margin:0 0 18px; color:#667085; line-height:1.5; }
    input { width:100%; box-sizing:border-box; border:1px solid #dfe8e3; border-radius:14px; padding:13px 14px; font:600 14px Inter,system-ui,sans-serif; }
    button { width:100%; margin-top:12px; border:0; border-radius:14px; padding:13px 14px; color:white; background:#1a8754; font-weight:800; cursor:pointer; }
    .error { margin-bottom:12px; padding:10px 12px; border-radius:12px; color:#991b1b; background:#fef2f2; font-size:13px; font-weight:700; }
  </style>
</head>
<body>
  <form class="card" method="POST" action="/dashboard-login">
    <div class="mark">T</div>
    <h1>Audit access</h1>
    <p>Enter the audit dashboard key to view security operations.</p>
    ${failed ? '<div class="error">Invalid dashboard key.</div>' : ''}
    <input name="key" type="password" placeholder="Audit dashboard key" autocomplete="current-password" autofocus />
    <button type="submit">Open dashboard</button>
  </form>
</body>
</html>`);
}

function chainAuditEvent(event) {
  const previousHash = loadLastHash();
  const eventHash = crypto
    .createHash('sha256')
    .update(`${previousHash}:${canonicalJson(event)}`)
    .digest('hex');

  fs.writeFileSync(
    chainStateFile,
    JSON.stringify({ lastHash: eventHash, updatedAt: new Date().toISOString() }, null, 2)
  );

  return { ...event, previousHash, eventHash, integrityAlgorithm: 'SHA-256 hash chain' };
}

const auditFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, action, userId, detail, success }) => {
    const status = success ? 'OK' : 'FAIL';
    const user = userId ? `[user:${userId}]` : '[anonymous]';
    return `${timestamp} ${level} ${status} ${action} ${user} - ${detail || ''}`;
  })
);

const logger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'tumbuh-audit' },
  transports: [
    new winston.transports.DailyRotateFile({
      dirname: logsDir,
      filename: 'audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: auditFormat,
      zippedArchive: true,
    }),
    new winston.transports.DailyRotateFile({
      dirname: logsDir,
      filename: 'audit-errors-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      level: 'warn',
      format: auditFormat,
      zippedArchive: true,
    }),
    new winston.transports.Console({ format: consoleFormat }),
  ],
});

const app = express();
const PORT = process.env.AUDIT_PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.post('/dashboard-login', (req, res) => {
  if (!DASHBOARD_KEY || req.body.key === DASHBOARD_KEY) {
    res.setHeader('Set-Cookie', `${DASHBOARD_COOKIE}=${encodeURIComponent(req.body.key || '')}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
    return res.redirect('/');
  }
  return res.redirect('/?failed=1');
});

app.post('/log', (req, res) => {
  const {
    action = 'UNKNOWN_ACTION',
    level = 'info',
    userId = null,
    userRole = 'anonymous',
    userEmail = null,
    ip = null,
    resource = null,
    resourceId = null,
    detail = '',
    success = true,
  } = req.body;

  const validLevels = ['error', 'warn', 'info', 'debug'];
  const logLevel = validLevels.includes(level) ? level : 'info';

  const chainedEvent = chainAuditEvent({
    action,
    userId,
    userRole,
    userEmail,
    ip,
    resource,
    resourceId,
    success,
  });

  logger.log(logLevel, detail, chainedEvent);

  res.status(201).json({ status: 'logged', eventHash: chainedEvent.eventHash });
});

app.get('/', requireDashboardAuth, (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TUMBUH Audit Network</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --brand: #1a8754;
      --brand-light: #22a96a;
      --brand-dark: #146c43;
      --brand-muted: #e8f5e9;
      --navy: #0b1c2d;
      --surface: #ffffff;
      --surface-2: #f8faf9;
      --surface-3: #eef4f0;
      --border: #dfe8e3;
      --text: #111827;
      --muted: #667085;
      --green: #16a34a;
      --amber: #d97706;
      --red: #dc2626;
      --shadow: 0 18px 45px rgba(11, 28, 45, 0.10);
    }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, system-ui, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(34,169,106,.14), transparent 35rem),
        linear-gradient(180deg, #f7fbf8 0%, #eef4f0 100%);
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background:
        linear-gradient(rgba(11,28,45,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(11,28,45,.035) 1px, transparent 1px);
      background-size: 32px 32px;
      pointer-events: none;
    }
    .shell { max-width: 1480px; margin: 0 auto; padding: 28px; position: relative; z-index: 1; }
    .topbar {
      position: relative;
      overflow: hidden;
      margin-bottom: 20px;
      padding: 24px;
      color: white;
      border-radius: 28px;
      background: linear-gradient(135deg, var(--navy) 0%, #12365a 58%, var(--brand-dark) 100%);
      box-shadow: var(--shadow);
    }
    .topbar::after {
      content: "";
      position: absolute;
      right: -90px;
      top: -110px;
      width: 320px;
      height: 320px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.15);
      background: rgba(255,255,255,.06);
    }
    .topbar-grid { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 24px; align-items: center; position: relative; z-index: 2; }
    .brand-row { display: flex; gap: 14px; align-items: center; }
    .mark {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: var(--brand);
      font-size: 25px;
      font-weight: 800;
      box-shadow: 0 12px 30px rgba(0,0,0,.22);
    }
    .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: .12em; color: rgba(255,255,255,.72); font-weight: 800; }
    h1 { margin: 20px 0 0; font-size: clamp(28px, 4vw, 46px); line-height: 1; letter-spacing: -.045em; }
    .subtitle { max-width: 720px; margin: 12px 0 0; color: rgba(255,255,255,.78); font-size: 15px; line-height: 1.55; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; align-items: center; }
    .refresh-btn, .ghost-btn {
      border-radius: 12px;
      padding: 10px 14px;
      font: 800 13px Inter, sans-serif;
      cursor: pointer;
    }
    .refresh-btn { border: 0; color: white; background: var(--brand); }
    .ghost-btn { color: rgba(255,255,255,.88); background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.16); }
    .status-panel {
      min-width: 300px;
      padding: 18px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 22px;
      background: rgba(255,255,255,.10);
      backdrop-filter: blur(12px);
    }
    .mesh { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0; }
    .node {
      position: relative;
      height: 42px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(255,255,255,.08);
    }
    .node::after {
      content: "";
      position: absolute;
      top: 10px;
      right: 10px;
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #86efac;
      box-shadow: 0 0 16px rgba(134,239,172,.85);
    }
    .node.warn::after { background: #facc15; box-shadow: 0 0 16px rgba(250,204,21,.85); }
    .node.error::after { background: #fb7185; box-shadow: 0 0 16px rgba(251,113,133,.85); }
    .panel-meta { display: flex; justify-content: space-between; font: 12px "JetBrains Mono", monospace; color: rgba(255,255,255,.76); }
    .layout { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 20px; }
    .card { background: rgba(255,255,255,.94); border: 1px solid var(--border); border-radius: 22px; box-shadow: 0 12px 35px rgba(11,28,45,.07); }
    .side { height: fit-content; padding: 18px; position: sticky; top: 18px; }
    .section-title { margin-bottom: 12px; color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }
    .stat-list { display: grid; gap: 10px; margin-bottom: 18px; }
    .metric { padding: 14px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface-2); }
    .metric strong { display: block; font-size: 28px; line-height: 1; letter-spacing: -.04em; }
    .metric span { display: block; margin-top: 6px; color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .metric.ok strong { color: var(--brand); }
    .metric.warn strong { color: var(--amber); }
    .metric.error strong { color: var(--red); }
    .activity { display: grid; grid-template-columns: repeat(18, 1fr); gap: 5px; height: 72px; align-items: end; margin: 8px 0 20px; }
    .bar { min-height: 8px; border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, var(--brand-light), var(--brand)); opacity: .9; }
    .filters { display: grid; gap: 9px; }
    .filter-btn {
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 11px 12px;
      background: white;
      color: var(--muted);
      text-align: left;
      font: 800 13px Inter, sans-serif;
      cursor: pointer;
    }
    .filter-btn.active { background: var(--brand-muted); color: var(--brand-dark); border-color: rgba(26,135,84,.35); }
    .nav-links { display: grid; gap: 8px; margin-bottom: 18px; }
    .nav-link { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 14px; color: var(--muted); text-decoration: none; font-size: 13px; font-weight: 800; }
    .nav-link.active, .nav-link:hover { background: var(--brand-muted); color: var(--brand-dark); }
    .main { overflow: hidden; }
    .security-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; padding: 16px; border-bottom: 1px solid var(--border); background: linear-gradient(180deg,#fff,#fbfdfc); }
    .verify-card { border: 1px solid var(--border); border-radius: 18px; background: white; padding: 16px; }
    .verify-card h2 { margin: 0 0 6px; font-size: 16px; letter-spacing: -.02em; }
    .verify-card p { margin: 0 0 14px; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .form-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px; margin-bottom: 10px; }
    .input {
      min-width: 0;
      border: 1px solid var(--border);
      border-radius: 13px;
      padding: 11px 12px;
      background: var(--surface-2);
      font: 600 13px Inter, sans-serif;
      outline: none;
    }
    .input:focus { border-color: rgba(26,135,84,.5); box-shadow: 0 0 0 4px rgba(34,169,106,.12); }
    .small-btn { border: 0; border-radius: 13px; padding: 11px 13px; color: white; background: var(--brand); font: 800 13px Inter, sans-serif; cursor: pointer; }
    .result-box { min-height: 46px; border: 1px solid var(--border); border-radius: 14px; padding: 12px; background: var(--surface-2); color: var(--muted); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
    .result-box.ok { border-color: rgba(22,163,74,.25); background: #ecfdf3; color: #166534; }
    .result-box.fail { border-color: rgba(220,38,38,.25); background: #fef2f2; color: #991b1b; }
    .toolbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); background: var(--surface); }
    .search-input {
      width: min(520px, 100%);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px 14px;
      background: var(--surface-2);
      outline: none;
      font: 600 14px Inter, sans-serif;
    }
    .search-input:focus { border-color: rgba(26,135,84,.5); box-shadow: 0 0 0 4px rgba(34,169,106,.12); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; min-width: 980px; border-collapse: collapse; }
    th { padding: 13px 16px; text-align: left; color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; background: #fbfdfc; border-bottom: 1px solid var(--border); }
    td { padding: 14px 16px; border-bottom: 1px solid #edf2ef; vertical-align: top; font-size: 13px; }
    tr:hover td { background: #fbfdfc; }
    .timestamp, .mono { font-family: "JetBrains Mono", monospace; font-size: 12px; }
    .timestamp { color: var(--muted); white-space: nowrap; }
    .badge { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 5px 9px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
    .badge-info { color: var(--brand-dark); background: var(--brand-muted); }
    .badge-warn { color: #92400e; background: #fff7ed; }
    .badge-error { color: #991b1b; background: #fef2f2; }
    .result-ok { color: var(--green); background: #ecfdf3; }
    .result-fail { color: var(--red); background: #fef2f2; }
    .action-tag { color: var(--navy); font-weight: 800; letter-spacing: -.01em; }
    .resource-pill { display: inline-flex; border-radius: 999px; padding: 4px 9px; background: #eef4f0; color: var(--brand-dark); font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: .07em; }
    .user-email { display: block; font-weight: 800; color: var(--text); }
    .user-role, .ip-text { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; }
    .detail-text { display: block; max-width: 520px; color: #344054; line-height: 1.45; }
    .empty-state { padding: 76px 20px; text-align: center; color: var(--muted); }
    .footer { margin-top: 18px; text-align: center; color: var(--muted); font-size: 12px; }
    .footer a { color: var(--brand-dark); font-weight: 800; text-decoration: none; }
    @media (max-width: 980px) {
      .topbar-grid, .layout { grid-template-columns: 1fr; }
      .security-grid { grid-template-columns: 1fr; }
      .side { position: static; }
      .status-panel { min-width: 0; }
    }
    @media (max-width: 640px) {
      .shell { padding: 16px; }
      .topbar { border-radius: 22px; }
      .toolbar { align-items: stretch; flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="topbar">
      <div class="topbar-grid">
        <div>
          <div class="brand-row">
            <div class="mark">T</div>
            <div>
              <div class="eyebrow">TUMBUH Security Operations</div>
              <div style="font-weight:800">Audit Network Dashboard</div>
            </div>
          </div>
          <h1>Real-time accountability layer</h1>
          <p class="subtitle">Live backend security and activity events.</p>
          <div class="actions">
            <button class="refresh-btn" onclick="fetchLogs()">Refresh events</button>
          </div>
        </div>
        <aside class="status-panel">
          <div class="panel-meta"><span>EDGE</span><span id="stat-total-small">0 EVENTS</span></div>
          <div class="mesh">
            <div class="node"></div><div class="node"></div><div class="node warn"></div><div class="node"></div>
            <div class="node"></div><div class="node"></div><div class="node"></div><div class="node error"></div>
          </div>
          <div class="panel-meta"><span>Winston ingest</span><span id="last-sync">syncing</span></div>
        </aside>
      </div>
    </section>

    <div class="layout">
      <aside class="card side">
        <div class="section-title">Operations</div>
        <nav class="nav-links">
          <a class="nav-link active" href="#events">Event stream</a>
          <a class="nav-link" href="#signature-check">Signature check</a>
          <a class="nav-link" href="#chain-check">Chain integrity</a>
          <a class="nav-link" href="/health">Service health</a>
        </nav>
        <div class="section-title">Traffic summary</div>
        <div class="stat-list">
          <div class="metric"><strong id="stat-total">0</strong><span>Total events</span></div>
          <div class="metric ok"><strong id="stat-success">0%</strong><span>Success rate</span></div>
          <div class="metric warn"><strong id="stat-warn">0</strong><span>Warnings</span></div>
          <div class="metric error"><strong id="stat-error">0</strong><span>Errors</span></div>
        </div>
        <div class="section-title">Event volume</div>
        <p style="margin:-4px 0 12px;color:var(--muted);font-size:12px;line-height:1.45">Recent audit activity.</p>
        <div class="activity" id="activity-bars"></div>
        <div class="section-title">Filters</div>
        <div class="filters">
          <button class="filter-btn active" data-filter="all" onclick="setFilter('all', this)">All events</button>
          <button class="filter-btn" data-filter="info" onclick="setFilter('info', this)">Information</button>
          <button class="filter-btn" data-filter="warn" onclick="setFilter('warn', this)">Warnings</button>
          <button class="filter-btn" data-filter="error" onclick="setFilter('error', this)">Errors</button>
        </div>
      </aside>

      <main class="card main">
        <section class="security-grid">
          <div class="verify-card" id="signature-check">
            <h2>Application signature</h2>
            <p>Admin-only verification for signed application events.</p>
            <input class="input" id="admin-token" type="password" placeholder="Paste admin access token" style="width:100%;margin-bottom:10px" />
            <div class="form-row">
              <input class="input" id="application-id" type="number" min="1" placeholder="Application ID" />
              <button class="small-btn" onclick="verifyApplicationSignature()">Verify</button>
            </div>
            <div class="result-box" id="signature-result">Waiting for an application ID.</div>
          </div>

          <div class="verify-card" id="chain-check">
            <h2>Audit chain integrity</h2>
            <p>Checks every audit event hash against the previous event.</p>
            <div class="form-row">
              <div class="input" style="color:var(--muted)">SHA-256 hash chain</div>
              <button class="small-btn" onclick="verifyAuditChain()">Verify</button>
            </div>
            <div class="result-box" id="chain-result">Waiting for chain verification.</div>
          </div>
        </section>

        <div class="toolbar">
          <div>
            <span id="events"></span>
            <div class="section-title" style="margin:0">Event stream</div>
            <div style="font-size:13px;color:var(--muted);margin-top:4px">Refreshes every 5s</div>
          </div>
          <input type="text" class="search-input" id="search" placeholder="Search action, actor, resource, IP, detail..." oninput="applyFilters()" />
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Signal</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Resource</th>
                <th>Source</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody id="log-body">
              <tr><td colspan="7"><div class="empty-state"><h3>Loading audit events...</h3><p>Waiting for the Winston log stream.</p></div></td></tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>

    <div class="footer">Winston audit service - TUMBUH AAA Accounting - <a href="/health">Health check</a></div>
  </div>

  <script>
    const BACKEND_API_URL = ${JSON.stringify(BACKEND_API_URL)};
    let allEntries = [];
    let activeFilter = 'all';

    async function fetchLogs() {
      try {
        const res = await fetch('/logs/recent?limit=200');
        const data = await res.json();
        allEntries = data.entries || [];
        updateStats();
        applyFilters();
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      }
    }

    function updateStats() {
      const total = allEntries.length;
      const success = allEntries.filter(e => e.success === true).length;
      const warn = allEntries.filter(e => e.level === 'warn').length;
      const error = allEntries.filter(e => e.level === 'error').length;
      const rate = total ? Math.round((success / total) * 100) : 0;
      document.getElementById('stat-total').textContent = total;
      document.getElementById('stat-total-small').textContent = total + ' EVENTS';
      document.getElementById('stat-success').textContent = rate + '%';
      document.getElementById('stat-warn').textContent = warn;
      document.getElementById('stat-error').textContent = error;
      document.getElementById('last-sync').textContent = formatJakartaTime(new Date());
      renderActivity();
    }

    function renderActivity() {
      const wrap = document.getElementById('activity-bars');
      const buckets = new Array(18).fill(0);
      allEntries.slice(0, 90).forEach((_, index) => {
        buckets[Math.min(17, Math.floor(index / 5))] += 1;
      });
      const max = Math.max(1, ...buckets);
      wrap.innerHTML = buckets.map(count => {
        const height = Math.max(8, Math.round((count / max) * 72));
        return '<div class="bar" style="height:' + height + 'px"></div>';
      }).join('');
    }

    function setFilter(filter, btn) {
      activeFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    }

    async function verifyApplicationSignature() {
      const result = document.getElementById('signature-result');
      const token = document.getElementById('admin-token').value.trim();
      const applicationId = document.getElementById('application-id').value.trim();
      if (!token || !applicationId) {
        setResult(result, false, 'Admin token and application ID are required.');
        return;
      }
      result.className = 'result-box';
      result.textContent = 'Checking signature...';
      try {
        const res = await fetch(BACKEND_API_URL + '/admin/security/applications/' + encodeURIComponent(applicationId) + '/signature', {
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error || 'Signature check failed');
        const status = data.valid ? 'VALID' : 'INVALID';
        setResult(
          result,
          data.valid,
          status + ' - ' + data.reason + '\\nAlgorithm: ' + (data.algorithm || '-') + '\\nPayload: ' + JSON.stringify(data.payload || {}, null, 2)
        );
      } catch (err) {
        setResult(result, false, err.message || 'Signature check failed.');
      }
    }

    async function verifyAuditChain() {
      const result = document.getElementById('chain-result');
      result.className = 'result-box';
      result.textContent = 'Checking audit chain...';
      try {
        const res = await fetch('/audit/verify-chain');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Chain verification failed');
        const detail = data.valid
          ? 'VALID - ' + data.total + ' events checked. Legacy skipped: ' + data.legacySkipped + '. Latest hash: ' + data.latestHash
          : 'INVALID - first failure: ' + JSON.stringify(data.firstFailure);
        setResult(result, data.valid, detail);
      } catch (err) {
        setResult(result, false, err.message || 'Chain verification failed.');
      }
    }

    function setResult(el, ok, text) {
      el.className = 'result-box ' + (ok ? 'ok' : 'fail');
      el.textContent = text;
    }

    function applyFilters() {
      const search = document.getElementById('search').value.toLowerCase();
      let filtered = allEntries;

      if (activeFilter !== 'all') filtered = filtered.filter(e => e.level === activeFilter);
      if (search) {
        filtered = filtered.filter(e =>
          (e.action || '').toLowerCase().includes(search) ||
          (e.userEmail || '').toLowerCase().includes(search) ||
          (e.userRole || '').toLowerCase().includes(search) ||
          (e.ip || '').toLowerCase().includes(search) ||
          (e.resource || '').toLowerCase().includes(search) ||
          String(e.resourceId || '').toLowerCase().includes(search) ||
          (e.message || '').toLowerCase().includes(search) ||
          (e.detail || '').toLowerCase().includes(search)
        );
      }
      renderTable(filtered);
    }

    function levelBadge(level) {
      const map = {
        info: '<span class="badge badge-info">Info</span>',
        warn: '<span class="badge badge-warn">Warn</span>',
        error: '<span class="badge badge-error">Error</span>',
      };
      return map[level] || '<span class="badge badge-info">' + escHtml(level || 'info') + '</span>';
    }

    function resultBadge(success) {
      return success
        ? '<span class="badge result-ok">Allowed</span>'
        : '<span class="badge result-fail">Blocked</span>';
    }

    function renderTable(entries) {
      const body = document.getElementById('log-body');
      if (!entries.length) {
        body.innerHTML = '<tr><td colspan="7"><div class="empty-state"><h3>No matching events</h3><p>Try another signal filter or perform an action in the app.</p></div></td></tr>';
        return;
      }

      body.innerHTML = entries.map((e) => {
        const timestamp = e.timestamp || '';
        const time = formatJakartaTime(parseLogTimestamp(timestamp));
        const actor = e.userEmail
          ? '<span class="user-email">' + escHtml(e.userEmail) + '</span><span class="user-role">' + escHtml(e.userRole || 'unknown') + '</span>'
          : '<span class="user-email">' + escHtml(e.userRole || 'anonymous') + '</span><span class="user-role">system context</span>';
        const resource = '<span class="resource-pill">' + escHtml(e.resource || 'system') + '</span>' +
          (e.resourceId ? '<span class="user-role mono">#' + escHtml(String(e.resourceId)) + '</span>' : '');
        const source = '<span class="ip-text mono">' + escHtml(e.ip || 'internal') + '</span>';
        const detail = escHtml(e.message || e.detail || '-');

        return '<tr>' +
          '<td class="timestamp" title="' + escHtml(timestamp) + '">' + escHtml(time) + '</td>' +
          '<td>' + levelBadge(e.level) + '<div style="margin-top:6px">' + resultBadge(e.success) + '</div></td>' +
          '<td><span class="action-tag">' + escHtml(e.action || '-') + '</span></td>' +
          '<td>' + actor + '</td>' +
          '<td>' + resource + '</td>' +
          '<td>' + source + '</td>' +
          '<td><span class="detail-text" title="' + detail + '">' + detail + '</span></td>' +
          '</tr>';
      }).join('');
    }

    function escHtml(str) {
      const d = document.createElement('div');
      d.textContent = str || '';
      return d.innerHTML;
    }

    function parseLogTimestamp(timestamp) {
      if (!timestamp) return null;
      const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T') + 'Z';
      const date = new Date(normalized);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatJakartaTime(date) {
      if (!date) return '-';
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(date);
    }

    fetchLogs();
    setInterval(fetchLogs, 5000);
  </script>
</body>
</html>`);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'tumbuh-audit-log' });
});

function getAuditLogFiles() {
  return fs.readdirSync(logsDir)
    .filter((name) => /^audit-\d{4}-\d{2}-\d{2}\.log$/.test(name))
    .sort()
    .map((name) => path.join(logsDir, name));
}

function computeEventHash(entry) {
  const event = {
    action: entry.action,
    userId: entry.userId ?? null,
    userRole: entry.userRole ?? 'anonymous',
    userEmail: entry.userEmail ?? null,
    ip: entry.ip ?? null,
    resource: entry.resource ?? null,
    resourceId: entry.resourceId ?? null,
    success: entry.success ?? true,
  };
  return crypto
    .createHash('sha256')
    .update(`${entry.previousHash}:${canonicalJson(event)}`)
    .digest('hex');
}

function verifyAuditChain() {
  const files = getAuditLogFiles();
  let expectedPreviousHash = 'GENESIS';
  let total = 0;
  let legacySkipped = 0;
  const failures = [];
  const tamperedEntries = [];
  let latestHash = expectedPreviousHash;

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean);
    for (const [index, line] of lines.entries()) {
      total += 1;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        failures.push({ file: path.basename(file), line: index + 1, reason: 'Invalid JSON log line' });
        continue;
      }

      if (!entry.eventHash || !entry.previousHash) {
        if (latestHash === 'GENESIS') {
          legacySkipped += 1;
          continue;
        }
        failures.push({ file: path.basename(file), line: index + 1, reason: 'Missing hash-chain fields after hash chain started' });
        continue;
      }

      let isCurrentLineFailed = false;

      if (total === 1 + legacySkipped && expectedPreviousHash === 'GENESIS') {
        expectedPreviousHash = entry.previousHash;
      }

      if (entry.previousHash !== expectedPreviousHash) {
        failures.push({
          file: path.basename(file),
          line: index + 1,
          reason: 'previousHash does not match the previous eventHash',
          expectedPreviousHash,
          actualPreviousHash: entry.previousHash,
        });
        tamperedEntries.push({
          eventHash: entry.eventHash,
          action: entry.action || null,
          timestamp: entry.timestamp || null,
          userEmail: entry.userEmail || null,
          userRole: entry.userRole || null,
          userId: entry.userId || null,
          resource: entry.resource || null,
          resourceId: entry.resourceId || null,
        });
        isCurrentLineFailed = true;
      }

      const recomputedHash = computeEventHash(entry);
      if (recomputedHash !== entry.eventHash) {
        if (!isCurrentLineFailed) {
          failures.push({
            file: path.basename(file),
            line: index + 1,
            reason: 'eventHash does not match log contents',
            expectedEventHash: recomputedHash,
            actualEventHash: entry.eventHash,
          });
          tamperedEntries.push({
            eventHash: entry.eventHash,
            action: entry.action || null,
            timestamp: entry.timestamp || null,
            userEmail: entry.userEmail || null,
            userRole: entry.userRole || null,
            userId: entry.userId || null,
            resource: entry.resource || null,
            resourceId: entry.resourceId || null,
          });
        }
      }

      expectedPreviousHash = entry.eventHash;
      latestHash = entry.eventHash;
    }
  }

  return {
    valid: failures.length === 0,
    total,
    legacySkipped,
    files: files.map((file) => path.basename(file)),
    latestHash,
    failures,
    tamperedEntries,
    firstFailure: failures[0] || null,
    tamperedEntry: tamperedEntries[0] || null,
    checkedAt: new Date().toISOString(),
  };
}

app.post('/audit/edit-entry', requireDashboardAuth, express.json(), (req, res) => {
  // DEV TOOLS: edit a log entry by eventHash without recomputing the hash (breaks the chain).
  const { eventHash, changes } = req.body || {};
  if (!eventHash || !changes || typeof changes !== 'object') {
    return res.status(400).json({ error: 'Provide eventHash and changes object.' });
  }

  const files = getAuditLogFiles();
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      let entry;
      try { entry = JSON.parse(lines[i]); } catch { continue; }
      if (entry.eventHash === eventHash) {
        // Auto-backup on first edit
        const backupFile = file + '.bak';
        if (!fs.existsSync(backupFile)) {
          fs.copyFileSync(file, backupFile);
        }
        const original = { ...entry };
        // Apply changes but never touch hash fields
        for (const [key, value] of Object.entries(changes)) {
          if (key !== 'eventHash' && key !== 'previousHash' && key !== 'integrityAlgorithm') {
            let finalValue = value;
            if (key === 'userEmail' && typeof value === 'string' && value.trim() === '') {
              finalValue = null;
            }
            entry[key] = finalValue;
          }
        }
        lines[i] = JSON.stringify(entry);
        fs.writeFileSync(file, lines.join('\n') + '\n', 'utf-8');
        found = true;
        return res.json({
          success: true,
          file: path.basename(file),
          line: i + 1,
          eventHash,
          original: { action: original.action, userEmail: original.userEmail, success: original.success },
          updated: { action: entry.action, userEmail: entry.userEmail, success: entry.success },
        });
      }
    }
    if (found) break;
  }
  res.status(404).json({ error: 'Entry with that eventHash not found.' });
});

app.post('/audit/reset-logs', requireDashboardAuth, (_req, res) => {
  // DEV TOOLS: restore all log files from .bak backups.
  const files = getAuditLogFiles();
  let restored = 0;
  for (const file of files) {
    const backupFile = file + '.bak';
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, file);
      fs.unlinkSync(backupFile);
      restored++;
    }
  }
  res.json({ success: true, restoredFiles: restored });
});

app.post('/audit/clear-all-logs', requireDashboardAuth, (_req, res) => {
  // DEV TOOLS: delete/clear all log files.
  if (fs.existsSync(chainStateFile)) {
    try {
      fs.unlinkSync(chainStateFile);
    } catch (_err) {
      try {
        fs.writeFileSync(chainStateFile, JSON.stringify({ lastHash: 'GENESIS' }), 'utf-8');
      } catch (e) {}
    }
  }

  let cleared = 0;
  try {
    const files = fs.readdirSync(logsDir);
    for (const file of files) {
      if (file === '.gitkeep') continue;
      const filePath = path.join(logsDir, file);
      
      if (file.endsWith('.log')) {
        // Truncate Winston logs so the open handles remain valid
        try {
          fs.writeFileSync(filePath, '', 'utf-8');
          cleared++;
        } catch (e) {
          console.error(`Failed to truncate log file ${file}:`, e);
        }
      } else {
        // Delete backups, dotfiles, and temporary files
        try {
          fs.unlinkSync(filePath);
          cleared++;
        } catch (err) {
          // Fallback to truncate if somehow locked
          try {
            fs.writeFileSync(filePath, '', 'utf-8');
            cleared++;
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read/clear logs directory: ' + err.message });
  }

  res.json({ success: true, clearedFiles: cleared });
});

app.get('/audit/verify-chain', requireDashboardAuth, (_req, res) => {
  res.json(verifyAuditChain());
});

app.get('/logs/recent', requireDashboardAuth, (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 50;

  const files = getAuditLogFiles().reverse(); // newest files first
  if (files.length === 0) {
    return res.json({ entries: [], total: 0 });
  }

  let allEntries = [];
  let total = 0;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8').trim();
    if (!content) continue;
    const lines = content.split('\n').filter(Boolean);
    total += lines.length;
    const parsed = lines
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean)
      .reverse(); // newest entries first within each file
    allEntries = allEntries.concat(parsed);
    if (allEntries.length >= limit) break; // stop reading older files once we have enough
  }

  res.json({ entries: allEntries.slice(0, limit), total });
});

function writeChainState(hash) {
  try {
    fs.writeFileSync(
      chainStateFile,
      JSON.stringify({ lastHash: hash, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch (e) {
    console.error('Failed to write chain state file:', e);
  }
}

function initializeChainState() {
  try {
    const files = getAuditLogFiles();
    if (files.length === 0) {
      writeChainState('GENESIS');
      return;
    }

    // Scan backwards from the newest file to find the last valid JSON entry with an eventHash
    for (let i = files.length - 1; i >= 0; i--) {
      const file = files[i];
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf-8').trim();
      if (!content) continue;

      const lines = content.split('\n').filter(Boolean);
      for (let j = lines.length - 1; j >= 0; j--) {
        try {
          const entry = JSON.parse(lines[j]);
          if (entry && entry.eventHash) {
            writeChainState(entry.eventHash);
            return;
          }
        } catch (_) {
          // Ignore JSON parse errors for incomplete/malformed lines
        }
      }
    }

    writeChainState('GENESIS');
  } catch (err) {
    console.error('Failed to initialize chain state from log files:', err);
    writeChainState('GENESIS');
  }
}

app.listen(PORT, () => {
  initializeChainState();
  logger.info('Audit log server started', chainAuditEvent({
    action: 'AUDIT_SERVER_START',
    userId: null,
    userRole: 'system',
    userEmail: null,
    ip: null,
    resource: 'audit-log',
    resourceId: null,
    success: true,
  }));
  console.log(`\nTUMBUH Audit Log Server running on http://localhost:${PORT}\n`);
});
