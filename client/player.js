// The phone view: join, hold a hand, commit one card per round.
//
// Committing is two-tap on purpose — tap to select, tap again to confirm.
// A single tap is far too easy to fire by accident while scrolling a hand
// of six cards on a phone.

import { session, post, refresh, toast } from '../app.js';
import { el, clear, fixCard, leaderboard, emptyState } from './render.js';

let root = null;
let selected = null;
let lastKey = '';
let rejoining = false;

export function mount(node) {
  root = node;
  selected = null;
  lastKey = '';
  rejoining = false;
}

/**
 * The seat went missing while we still believe we are in the game.
 * Put the player back rather than dropping them on the join form — being
 * bounced to a name prompt mid-round is the worst thing that can happen
 * here. A genuine reset by the host is handled by the caller, which checks
 * the game session first, so this only ever recovers an unexpected loss.
 */
async function autoRejoin() {
  if (rejoining) return;
  rejoining = true;
  try {
    const res = await post('join', { name: session.playerName, playerId: session.playerId });
    session.playerId = res.playerId;
    lastKey = '';
    refresh();
  } catch (e) {
    // A refusal the server means (game full, bad name) — stop looping.
    session.playerId = null;
    session.playerName = null;
    lastKey = '';
    toast(e.message, 'bad');
  } finally {
    setTimeout(() => {
      rejoining = false;
    }, 3000);
  }
}

/** Rebuild only when something structural changed, so a half-typed name
 *  or a mid-scroll selection is not thrown away every poll. */
function viewKey(state) {
  const you = state.you;
  return [
    you ? 'in' : rejoining ? 'rejoining' : 'out',
    state.phase,
    state.round,
    you ? you.hand.map((c) => c.id).join(',') : '',
    you ? you.playedCardId : '',
    you ? you.score : '',
    selected || '',
    state.winner ? state.winner.playerId : '',
  ].join('|');
}

export function render(node, state) {
  root = node;
  const key = viewKey(state);
  if (key === lastKey) return;
  lastKey = key;
  clear(root);

  if (!state.you) {
    const hadSeat = session.playerId && session.playerName;
    const wasReset = session.gameSession && state.session && session.gameSession !== state.session;

    if (hadSeat && wasReset) {
      // The host started a new game. Forget the old seat and ask again.
      session.playerId = null;
      session.playerName = null;
      session.gameSession = null;
      return root.append(joinForm());
    }
    if (hadSeat) {
      autoRejoin();
      return root.append(emptyState('Getting you back in…', 'Stay on this screen.'));
    }
    return root.append(joinForm());
  }

  // Remember which game this seat belongs to, so a later reset is detectable.
  if (state.session) session.gameSession = state.session;

  root.append(
    el('header', { class: 'p-head' }, [
      el('span', { class: 'p-name', text: state.you.name }),
      el('span', { class: 'p-score', text: state.you.score + ' pt' }),
    ]),
  );

  if (state.phase === 'lobby' || (state.phase === 'dealt' && !state.you.hand.length)) {
    return root.append(
      emptyState('You are in.', 'Watch the big screen. Cards arrive when the host deals.'),
    );
  }

  if (state.phase === 'final') {
    return root.append(
      el('div', { class: 'p-final' }, [
        emptyState('That is the game.', 'Final scores are on the screen.'),
        leaderboard(state.players, { highlightId: state.you.id, title: 'Final' }),
      ]),
    );
  }

  if (state.phase === 'dealt') {
    root.append(emptyState('Your hand is ready.', 'The host will put up the first scenario.'));
    return root.append(hand(state, false));
  }

  // playing / revealed / judged
  if (state.scenario) {
    root.append(
      el('div', { class: 'p-scenario' }, [
        el('div', { class: 'kicker', text: 'Round ' + state.round + ' of ' + state.totalRounds }),
        el('h2', { text: state.scenario.title }),
        el('p', { class: 'p-tagline', text: state.scenario.tagline }),
        el('p', { class: 'p-hint', text: 'Full briefing is on the big screen.' }),
      ]),
    );
  }

  if (state.phase !== 'playing') {
    const won = state.winner && state.winner.playerId === state.you.id;
    root.append(
      emptyState(
        won ? 'Your card took the round.' : 'Cards are on the screen.',
        state.phase === 'judged' ? 'Next scenario coming up.' : 'Make your case out loud.',
      ),
    );
    return root.append(hand(state, false));
  }

  if (state.you.playedCardId) {
    root.append(emptyState('Card committed.', 'Look up — the reveal happens on the screen.'));
    return root.append(hand(state, false));
  }

  root.append(
    el('div', { class: 'p-prompt' }, [
      el('strong', { text: selected ? 'Tap again to commit' : 'Pick your play' }),
      el('span', { text: state.playedCount + ' of ' + state.players.length + ' committed' }),
    ]),
  );
  root.append(hand(state, true));
}

function hand(state, live) {
  const cards = state.you.hand;
  if (!cards.length) return emptyState('No cards left.', 'You played your whole hand.');

  return el(
    'div',
    { class: 'hand' },
    cards.map((card) =>
      fixCard(card, {
        state: selected === card.id ? 'selected' : null,
        onClick: live
          ? () => {
              if (selected !== card.id) {
                selected = card.id;
                lastKey = '';
                render(root, state);
                return;
              }
              commit(card.id);
            }
          : null,
      }),
    ),
  );
}

async function commit(cardId) {
  try {
    await post('play', { playerId: session.playerId, cardId });
    selected = null;
    refresh();
  } catch (e) {
    toast(e.message, 'bad');
    selected = null;
    lastKey = '';
  }
}

function joinForm() {
  const input = el('input', {
    class: 'field',
    type: 'text',
    placeholder: 'Your name',
    maxlength: '24',
    autocomplete: 'off',
    autocapitalize: 'words',
  });

  const submit = async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return toast('Type your name first', 'bad');
    try {
      const res = await post('join', { name, playerId: session.playerId });
      session.playerId = res.playerId;
      session.playerName = res.name;
      lastKey = '';
      refresh();
    } catch (err) {
      toast(err.message, 'bad');
    }
  };

  return el('form', { class: 'join', onsubmit: submit }, [
    el('div', { class: 'kicker', text: 'Performance Optimization' }),
    el('h1', { text: 'Fix Draft' }),
    el('p', {
      class: 'join-blurb',
      text: 'You get a hand of fixes. Each round shows a broken site. Play the card that actually solves it, then argue your case.',
    }),
    input,
    el('button', { class: 'btn-primary', type: 'submit', text: 'Join the game' }),
  ]);
}
