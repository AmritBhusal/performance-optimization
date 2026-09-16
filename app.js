// Router, polling loop and the API helper. Each view module owns its own
// DOM and decides when a repaint is actually needed.

import * as player from './client/player.js';
import * as screen from './client/screen.js';
import * as admin from './client/admin.js';

const POLL_MS = 1500;

// Wrapped because localStorage throws outright in private browsing on some
// phones, and a player losing their seat is the worst failure this app has.
const ls = {
  get(k) {
    try {
      return localStorage.getItem(k) || null;
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    } catch (e) {
      /* nothing to do — the seat is recoverable by name */
    }
  },
};

export const session = {
  get playerId() { return ls.get('fd:playerId'); },
  set playerId(v) { ls.set('fd:playerId', v); },
  // Kept so a player whose seat vanishes can be put back automatically.
  get playerName() { return ls.get('fd:playerName'); },
  set playerName(v) { ls.set('fd:playerName', v); },
  // Which game the seat belongs to, so a real reset by the host is told
  // apart from a seat that went missing for any other reason.
  get gameSession() { return ls.get('fd:session'); },
  set gameSession(v) { ls.set('fd:session', v); },
  get adminToken() { return ls.get('fd:adminToken'); },
  set adminToken(v) { ls.set('fd:adminToken', v); },
};

/** Tolerant on purpose: #/admin, #admin and #Admin all land on the host
 *  controls. Getting this wrong silently drops you on the join page, which
 *  is a bad thing to discover with a room watching. */
function route() {
  const h = location.hash.replace(/^#\/*/, '').toLowerCase();
  if (h.startsWith('screen')) return 'screen';
  if (h.startsWith('admin')) return 'admin';
  return 'player';
}

/** The URL the QR code points at — always the player view. */
export function joinUrl() {
  return location.origin + location.pathname;
}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (route() === 'admin' && session.adminToken) h['x-admin-token'] = session.adminToken;
  return h;
}

export async function post(op, payload) {
  const started = Date.now();
  log('POST ' + op, payload || {});
  const res = await fetch('/api/room', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(Object.assign({ op }, payload || {})),
  });
  const body = await res.json().catch(() => ({ error: 'Bad response from the server' }));
  const ms = Date.now() - started;
  if (!res.ok) {
    log('  <- ' + op + ' FAILED ' + res.status + ' in ' + ms + 'ms: ' + (body.error || 'unknown'));
    throw new Error(body.error || 'Request failed');
  }
  log('  <- ' + op + ' ok in ' + ms + 'ms', body);
  return body;
}

async function getState() {
  const qs = session.playerId && route() === 'player' ? '?pid=' + encodeURIComponent(session.playerId) : '';
  const res = await fetch('/api/room' + qs, { headers: headers() });
  const body = await res.json().catch(() => ({ error: 'Bad response from the server' }));
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

/** Everything interesting goes to the console, prefixed so it is easy to
 *  filter devtools by "fixdraft" during a game. */
export function log(...args) {
  console.log('[fixdraft ' + new Date().toTimeString().slice(0, 8) + ']', ...args);
}

let toastTimer = null;
export function toast(message, kind) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = 'toast' + (kind ? ' toast-' + kind : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3500);
}

const views = { player, screen, admin };
const root = document.getElementById('app');

let current = null;
let lastPayload = '';
let refreshNow = false;

/** Views call this after an action so the UI does not wait for the next tick. */
export function refresh() {
  refreshNow = true;
  tick();
}

let lastSeen = null;
let failures = 0;

/** Narrate the things that would otherwise be invisible during a game:
 *  who appears and disappears, when the host acts, when the game is reset. */
function narrate(s) {
  const prev = lastSeen;
  lastSeen = {
    phase: s.phase,
    round: s.round,
    session: s.session,
    names: s.players.map((p) => p.name).sort().join(','),
    count: s.players.length,
    hasSeat: !!s.you,
  };
  if (!prev) {
    log('connected — phase ' + s.phase + ', ' + s.players.length + ' player(s)', s.players.map((p) => p.name));
    return;
  }
  if (prev.session !== lastSeen.session) {
    log('GAME SESSION CHANGED', prev.session, '->', lastSeen.session, '— the host reset the game');
  }
  if (prev.phase !== lastSeen.phase || prev.round !== lastSeen.round) {
    log('phase ' + prev.phase + ' -> ' + lastSeen.phase + ', round ' + lastSeen.round);
  }
  if (prev.names !== lastSeen.names) {
    const before = prev.names ? prev.names.split(',') : [];
    const after = lastSeen.names ? lastSeen.names.split(',') : [];
    const added = after.filter((n) => !before.includes(n));
    const removed = before.filter((n) => !after.includes(n));
    if (added.length) log('PLAYER ADDED:', added, '(' + before.length + ' -> ' + after.length + ')');
    if (removed.length) log('PLAYER REMOVED:', removed, '(' + before.length + ' -> ' + after.length + ')');
  }
  if (prev.hasSeat && !lastSeen.hasSeat) log('YOUR SEAT DISAPPEARED from the server response');
}

async function tick() {
  try {
    const state = await getState();
    if (failures) {
      log('back online after ' + failures + ' failed poll(s)');
      failures = 0;
    }
    narrate(state);
    const json = JSON.stringify(state);
    if (json === lastPayload && !refreshNow) return;
    lastPayload = json;
    refreshNow = false;
    views[current].render(root, state);
    document.body.dataset.offline = '';
  } catch (e) {
    failures++;
    // Only shout once per outage, not every 1.5s.
    if (failures === 1) log('poll failed:', e.message, '— keeping the current screen');
    document.body.dataset.offline = '1';
  }
}

function mount() {
  const next = route();
  if (next === current) return;
  log('mounting "' + next + '" view for ' + location.href);
  current = next;
  document.body.dataset.view = next;
  root.innerHTML = '';
  lastPayload = '';
  lastSeen = null;
  views[current].mount(root);
  tick();
}

window.addEventListener('hashchange', () => {
  log('hash changed to "' + location.hash + '"');
  mount();
});

log('Performance Optimization starting — polling every ' + POLL_MS + 'ms. Stored identity:', {
  playerId: session.playerId,
  playerName: session.playerName,
  hasAdminToken: !!session.adminToken,
});
mount();
setInterval(tick, POLL_MS);
