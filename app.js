// Router, polling loop and the API helper. Each view module owns its own
// DOM and decides when a repaint is actually needed.

import * as player from './client/player.js';
import * as screen from './client/screen.js';
import * as admin from './client/admin.js';

const POLL_MS = 1000;

export const session = {
  get playerId() {
    return localStorage.getItem('fd:playerId') || null;
  },
  set playerId(v) {
    if (v) localStorage.setItem('fd:playerId', v);
    else localStorage.removeItem('fd:playerId');
  },
  get adminToken() {
    return localStorage.getItem('fd:adminToken') || null;
  },
  set adminToken(v) {
    if (v) localStorage.setItem('fd:adminToken', v);
    else localStorage.removeItem('fd:adminToken');
  },
};

function route() {
  const h = location.hash;
  if (h.startsWith('#/screen')) return 'screen';
  if (h.startsWith('#/admin')) return 'admin';
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
  const res = await fetch('/api/room', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(Object.assign({ op }, payload || {})),
  });
  const body = await res.json().catch(() => ({ error: 'Bad response from the server' }));
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

async function getState() {
  const qs = session.playerId && route() === 'player' ? '?pid=' + encodeURIComponent(session.playerId) : '';
  const res = await fetch('/api/room' + qs, { headers: headers() });
  const body = await res.json().catch(() => ({ error: 'Bad response from the server' }));
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
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

async function tick() {
  try {
    const state = await getState();
    const json = JSON.stringify(state);
    if (json === lastPayload && !refreshNow) return;
    lastPayload = json;
    refreshNow = false;
    views[current].render(root, state);
    document.body.dataset.offline = '';
  } catch (e) {
    document.body.dataset.offline = '1';
  }
}

function mount() {
  const next = route();
  if (next === current) return;
  current = next;
  document.body.dataset.view = next;
  root.innerHTML = '';
  lastPayload = '';
  views[current].mount(root);
  tick();
}

window.addEventListener('hashchange', mount);
mount();
setInterval(tick, POLL_MS);
