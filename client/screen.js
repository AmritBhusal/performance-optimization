// The projector view. Read-only, no controls, sized to be legible from
// the back of the room.

import { joinUrl, log } from '../app.js';
import {
  el,
  clear,
  fixCard,
  scenarioBrief,
  leaderboard,
  playedStrip,
  emptyState,
} from './render.js';

let root = null;
let lastKey = '';
let qrDrawn = false;

export function mount(node) {
  root = node;
  lastKey = '';
  qrDrawn = false;
}

function viewKey(state) {
  return [
    state.phase,
    state.round,
    state.playedCount,
    state.players.map((p) => p.id + ':' + p.score + ':' + (p.hasPlayed ? 1 : 0)).join(','),
    state.winner ? state.winner.playerId : '',
  ].join('|');
}

export function render(node, state) {
  root = node;
  const key = viewKey(state);
  if (key === lastKey) return;
  lastKey = key;
  clear(root);
  qrDrawn = false;
  log('screen repaint — phase ' + state.phase + ', round ' + state.round +
      ', ' + state.playedCount + '/' + state.players.length + ' committed' +
      (state.scenario ? ', showing "' + state.scenario.title + '"' : ''));

  if (state.phase === 'lobby') return root.append(lobby(state));
  if (state.phase === 'dealt') return root.append(dealt(state));
  if (state.phase === 'final') return root.append(final(state));
  if (state.phase === 'playing') return root.append(playing(state));
  return root.append(table(state)); // revealed | judged
}

function lobby(state) {
  const box = el('div', { class: 'qr-box', id: 'qrBox' });
  queueMicrotask(() => drawQr(box));

  return el('div', { class: 's-lobby' }, [
    el('div', { class: 's-lobby-left' }, [
      el('div', { class: 'kicker', text: 'Standup — Live Exercise' }),
      el('h1', { class: 's-title', text: 'Performance Optimization' }),
      el('p', { class: 's-blurb' }, [
        'Everyone gets a hand of real optimization fixes. Each round puts a broken site on this screen. ',
        el('strong', { text: 'Play the card that actually fixes it' }),
        ' — then defend it.',
      ]),
      el('div', { class: 's-meta' }, [
        el('span', null, [el('b', { text: '30' }), ' fix cards']),
        el('span', null, [el('b', { text: String(state.totalScenarios) }), ' scenarios']),
        el('span', null, [el('b', { text: String(state.players.length) }), ' joined']),
      ]),
    ]),
    el('div', { class: 's-lobby-right' }, [
      el('div', { class: 'kicker', text: 'Scan to join' }),
      box,
      el('p', { class: 'join-url', text: joinUrl().replace(/^https?:\/\//, '') }),
      state.players.length
        ? el(
            'div',
            { class: 'name-cloud' },
            state.players.map((p) => el('span', { class: 'chip is-in', text: p.name })),
          )
        : el('p', { class: 'muted', text: 'Waiting for the first player…' }),
    ]),
  ]);
}

function drawQr(box) {
  if (qrDrawn || !window.QRCode) return;
  qrDrawn = true;
  log('drawing join QR for ' + joinUrl());
  new window.QRCode(box, {
    text: joinUrl(),
    width: 320,
    height: 320,
    colorDark: '#0b1120',
    colorLight: '#ffffff',
    correctLevel: window.QRCode.CorrectLevel.M,
  });
}

function dealt(state) {
  return el('div', { class: 's-center' }, [
    el('div', { class: 'kicker', text: 'Cards are out' }),
    el('h1', { class: 's-title', text: state.players.length + ' hands dealt' }),
    el('p', { class: 's-blurb' }, [
      'Everyone holds ',
      el('b', { text: String(state.players[0] ? state.players[0].cardsLeft : 0) }),
      ' fixes. ',
      state.stackCount
        ? state.stackCount + ' cards stay in the stack, undealt.'
        : 'The whole deck is in play.',
    ]),
    playedStrip(state.players),
  ]);
}

function playing(state) {
  return el('div', { class: 's-playing' }, [
    scenarioBrief(state.scenario, { round: state.round, totalRounds: state.totalRounds }),
    el('aside', { class: 's-side' }, [
      el('div', { class: 'counter' }, [
        el('span', { class: 'counter-num', text: String(state.playedCount) }),
        el('span', { class: 'counter-den', text: '/ ' + state.players.length }),
        el('span', { class: 'counter-label', text: 'committed' }),
      ]),
      playedStrip(state.players),
      leaderboard(state.players, { title: 'Standings', showCards: true }),
    ]),
  ]);
}

function table(state) {
  const winnerId = state.winner ? state.winner.playerId : null;
  return el('div', { class: 's-table' }, [
    el('div', { class: 's-table-head' }, [
      el('div', { class: 'kicker', text: 'Round ' + state.round + ' — cards on the table' }),
      el('h2', { text: state.scenario ? state.scenario.title : '' }),
      winnerId
        ? el('div', { class: 'winner-banner', text: state.winner.name + ' takes the round' })
        : el('p', { class: 'muted', text: 'Make your case. The host awards the point.' }),
    ]),
    el(
      'div',
      { class: 'table-grid' },
      state.plays.map((p) =>
        fixCard(p.card, {
          state: winnerId ? (p.playerId === winnerId ? 'won' : 'lost') : null,
          footer: el('span', { class: 'fix-card-owner', text: p.name }),
        }),
      ),
    ),
    leaderboard(state.players, { title: 'Standings' }),
  ]);
}

function final(state) {
  const top = state.players.slice(0, 3);
  return el('div', { class: 's-center' }, [
    el('div', { class: 'kicker', text: 'That is the game' }),
    el('h1', { class: 's-title', text: top.length ? top[0].name + ' wins' : 'No players' }),
    el(
      'div',
      { class: 'podium' },
      top.map((p, i) =>
        el('div', { class: 'podium-slot rank-' + (i + 1) }, [
          el('span', { class: 'podium-rank', text: '#' + (i + 1) }),
          el('span', { class: 'podium-name', text: p.name }),
          el('span', { class: 'podium-score', text: p.score + ' pt' }),
        ]),
      ),
    ),
    leaderboard(state.players, { title: 'Everyone' }),
  ]);
}
