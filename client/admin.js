// The host's device. One big button that always says what happens next,
// plus the answer key — which only ever reaches a client holding a valid
// admin token.

import { session, post, refresh, toast } from '../app.js';
import {
  el,
  clear,
  fixCard,
  leaderboard,
  playedStrip,
  CATEGORY_LABELS,
} from './render.js';

let root = null;
let lastKey = '';
let keyOpen = true;

export function mount(node) {
  root = node;
  lastKey = '';
}

function viewKey(state) {
  return [
    state.phase,
    state.round,
    state.playedCount,
    keyOpen ? 'k' : '',
    state.players.map((p) => p.id + ':' + p.score + ':' + (p.hasPlayed ? 1 : 0)).join(','),
    state.winner ? state.winner.playerId : '',
    state.answerKey ? 'auth' : 'anon',
  ].join('|');
}

/** What the primary button does in each phase. */
function nextAction(state) {
  switch (state.phase) {
    case 'lobby':
      return { op: 'deal', label: 'Deal the cards', note: state.players.length + ' joined' };
    case 'dealt':
      return { op: 'scenario', label: 'Show scenario 1', note: 'Puts round 1 on the screen' };
    case 'playing':
      return {
        op: 'reveal',
        label: 'Reveal the cards',
        note: state.playedCount + ' of ' + state.players.length + ' committed',
      };
    case 'revealed':
      return { op: null, label: 'Tap a card to award the point', note: 'Let them argue first' };
    case 'judged':
      return state.round >= state.totalRounds
        ? { op: 'scenario', label: 'Show final scores', note: 'Last round is done' }
        : {
            op: 'scenario',
            label: 'Show scenario ' + (state.round + 1),
            note: 'Round ' + state.round + ' of ' + state.totalRounds + ' complete',
          };
    default:
      return { op: 'reset', label: 'Reset for a new game', note: 'Clears players and scores' };
  }
}

export function render(node, state) {
  root = node;
  const key = viewKey(state);
  if (key === lastKey) return;
  lastKey = key;
  clear(root);

  if (!session.adminToken) return root.append(tokenForm());

  // A stale or wrong token: the server answers, but never with a key.
  if (!state.answerKey && state.phase !== 'lobby' && state.phase !== 'dealt') {
    root.append(
      el('div', { class: 'a-warn' }, [
        'Admin token rejected — controls will fail. ',
        el('button', {
          class: 'btn-link',
          text: 'Enter it again',
          onclick: () => {
            session.adminToken = null;
            lastKey = '';
            refresh();
          },
        }),
      ]),
    );
  }

  const act = nextAction(state);

  root.append(
    el('header', { class: 'a-head' }, [
      el('div', null, [
        el('div', { class: 'kicker', text: 'Host controls' }),
        el('div', {
          class: 'a-phase',
          text:
            state.phase === 'lobby'
              ? 'Lobby'
              : 'Round ' + state.round + ' / ' + state.totalRounds + ' — ' + state.phase,
        }),
      ]),
      el('button', {
        class: 'btn-ghost',
        text: 'Reset',
        onclick: () => {
          if (confirm('Reset the game? Every player and every score is cleared.')) run('reset');
        },
      }),
    ]),
  );

  root.append(
    el('button', {
      class: 'btn-primary btn-huge',
      disabled: !act.op,
      text: act.label,
      onclick: act.op ? () => run(act.op) : null,
    }),
  );
  root.append(el('p', { class: 'a-note', text: act.note }));

  if (state.phase === 'playing' || state.phase === 'dealt') {
    root.append(playedStrip(state.players));
  }

  if (state.phase === 'revealed' || state.phase === 'judged') {
    const winnerId = state.winner ? state.winner.playerId : null;
    root.append(
      el(
        'div',
        { class: 'a-plays' },
        state.plays.map((p) =>
          fixCard(p.card, {
            compact: true,
            state: winnerId ? (p.playerId === winnerId ? 'won' : 'lost') : null,
            onClick: winnerId ? null : () => run('pick', { playerId: p.playerId }),
            footer: el('span', { class: 'fix-card-owner', text: p.name }),
          }),
        ),
      ),
    );
  }

  if (state.answerKey) root.append(answerKey(state));

  root.append(leaderboard(state.players, { title: 'Standings', showCards: true }));
}

function answerKey(state) {
  const k = state.answerKey;
  const byId = new Map(state.plays.map((p) => [p.card && p.card.id, p]));

  const list = (cards, cls) =>
    el(
      'ul',
      { class: 'key-list ' + cls },
      cards.map((c) =>
        el('li', { class: byId.has(c.id) ? 'was-played' : '' }, [
          el('span', { class: 'key-title', text: c.title }),
          byId.has(c.id) ? el('span', { class: 'key-flag', text: 'on the table' }) : null,
        ]),
      ),
    );

  return el('section', { class: 'a-key' }, [
    el('button', {
      class: 'a-key-toggle',
      text: (keyOpen ? '▾ ' : '▸ ') + 'Answer key — ' + state.scenario.title,
      onclick: () => {
        keyOpen = !keyOpen;
        lastKey = '';
        refresh();
      },
    }),
    keyOpen
      ? el('div', { class: 'a-key-body' }, [
          el('div', { class: 'key-col' }, [el('h4', { text: 'Strong plays' }), list(k.strong, 'is-strong')]),
          el('div', { class: 'key-col' }, [el('h4', { text: 'Weak plays' }), list(k.weak, 'is-weak')]),
          el('p', { class: 'key-argument', text: k.argument }),
        ])
      : null,
  ]);
}

function tokenForm() {
  const input = el('input', {
    class: 'field',
    type: 'password',
    placeholder: 'Admin token',
    autocomplete: 'off',
  });
  return el(
    'form',
    {
      class: 'join',
      onsubmit: (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!v) return toast('Enter the token', 'bad');
        session.adminToken = v;
        lastKey = '';
        refresh();
      },
    },
    [
      el('div', { class: 'kicker', text: 'Fix Draft' }),
      el('h1', { text: 'Host controls' }),
      el('p', {
        class: 'join-blurb',
        text: 'The value of ADMIN_TOKEN in the Vercel project. Stored on this device only.',
      }),
      input,
      el('button', { class: 'btn-primary', type: 'submit', text: 'Unlock' }),
    ],
  );
}

async function run(op, payload) {
  try {
    await post(op, payload);
    refresh();
  } catch (e) {
    toast(e.message, 'bad');
  }
}

export { CATEGORY_LABELS };
