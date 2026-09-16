// Pure game logic. No I/O — run the self-check with: node api/room.test.js

const { CARDS, CARDS_BY_ID } = require('./cards.js');
const { SCENARIOS } = require('./scenarios.js');

const PHASES = ['lobby', 'dealt', 'playing', 'revealed', 'judged', 'final'];
const DECK_IDS = CARDS.map((c) => c.id);

function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Fisher-Yates. `rand` is injectable so the test can be deterministic. */
function shuffle(arr, rand) {
  const r = rand || Math.random;
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

/**
 * Split the deck evenly. Every player gets the same number of cards;
 * whatever does not divide evenly stays in the stack, unused.
 */
function dealHands(playerIds, deck) {
  const perPlayer = Math.floor(deck.length / playerIds.length);
  if (perPlayer < 1) {
    throw new Error('Too many players for a ' + deck.length + '-card deck');
  }
  const hands = {};
  let i = 0;
  for (const pid of playerIds) {
    hands[pid] = deck.slice(i, i + perPlayer);
    i += perPlayer;
  }
  return { hands: hands, stack: deck.slice(i), perPlayer: perPlayer };
}

/** Rounds are capped by whichever runs out first: cards in hand, or scenarios. */
function totalRounds(perPlayer) {
  return Math.min(perPlayer, SCENARIOS.length);
}

function freshState() {
  return {
    phase: 'lobby',
    round: 0,
    totalRounds: 0,
    perPlayer: 0,
    stackCount: 0,
    winner: null,
    session: newId(),
  };
}

/** The scenario for a round (1-indexed), or null outside a round. */
function scenarioForRound(round) {
  return round >= 1 && round <= SCENARIOS.length ? SCENARIOS[round - 1] : null;
}

/**
 * Build the payload one client is allowed to see.
 *
 * The only place secrecy is enforced, so the only place worth testing for
 * it: a player sees their own hand and nobody else's, no played card
 * reaches anyone until the admin reveals, and the answer key never leaves
 * the server without a valid admin token.
 */
function redact(game, pid, isAdmin) {
  const state = game.state;
  const players = game.players;
  const revealed = state.phase === 'revealed' || state.phase === 'judged';
  const scenario = scenarioForRound(state.round);
  const roundPlays = game.plays.filter((p) => p.round === state.round);
  const played = new Set(roundPlays.map((p) => p.playerId));

  const out = {
    v: state.v || 0,
    session: state.session,
    phase: state.phase,
    round: state.round,
    totalRounds: state.totalRounds,
    stackCount: state.stackCount || 0,
    playedCount: roundPlays.length,
    winner: state.winner,
    totalScenarios: SCENARIOS.length,
    players: players
      .map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score || 0,
        cardsLeft: (p.hand || []).length,
        hasPlayed: played.has(p.id),
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    scenario: scenario
      ? {
          id: scenario.id,
          title: scenario.title,
          tagline: scenario.tagline,
          context: scenario.context,
          metrics: scenario.metrics,
          findings: scenario.findings,
        }
      : null,
    // Card faces only enter the payload once the admin has revealed.
    plays: revealed
      ? roundPlays.map((p) => {
          const owner = players.find((x) => x.id === p.playerId);
          return {
            playerId: p.playerId,
            name: owner ? owner.name : '?',
            card: CARDS_BY_ID[p.cardId] || null,
          };
        })
      : [],
    you: null,
  };

  if (isAdmin && scenario) {
    // Send titles, not ids — the host reads this while people are arguing
    // and should not have to map "cache-headers" onto a card on the table.
    const name = (id) => {
      const c = CARDS_BY_ID[id];
      return { id: id, title: c ? c.title : id, category: c ? c.category : null };
    };
    out.answerKey = {
      strong: scenario.answerKey.strong.map(name),
      weak: scenario.answerKey.weak.map(name),
      argument: scenario.answerKey.argument,
    };
  }

  const me = players.find((p) => p.id === pid);
  if (me) {
    const mine = roundPlays.find((p) => p.playerId === pid);
    out.you = {
      id: me.id,
      name: me.name,
      score: me.score || 0,
      hand: (me.hand || []).map((id) => CARDS_BY_ID[id]).filter(Boolean),
      playedCardId: mine ? mine.cardId : null,
    };
  }

  return out;
}

module.exports = {
  PHASES,
  DECK_IDS,
  SCENARIOS,
  CARDS,
  CARDS_BY_ID,
  newId,
  shuffle,
  dealHands,
  totalRounds,
  freshState,
  scenarioForRound,
  redact,
};
