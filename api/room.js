// The whole game, held in Prisma Postgres as key/value rows.
// See _lib/store.js for the row layout and why there is one row per writer.
//
// GET  /api/room?pid=<id>   -> state redacted for that player
// POST /api/room  { op: 'join' | 'play' | 'deal' | 'scenario' | 'reveal'
//                     | 'pick' | 'reset', ... }
//
// The admin ops are token-gated: the page sits on a public URL, so without
// that check anyone with the link could deal, reveal and award points. Join
// and play stay open — both are harmless, and gating them would mean
// accounts.

const crypto = require('crypto');
const G = require('./_lib/game.js');
const store = require('./_lib/store.js');

const MAX_PLAYERS = 40;
const MAX_NAME = 24;
const ADMIN_OPS = new Set(['deal', 'scenario', 'reveal', 'pick', 'reset']);

const STATE_KEY = 'state';
const SEAT = 'seat:';
const PLAY = 'play:';

function isAdmin(supplied) {
  const expected = process.env.ADMIN_TOKEN;
  // No token configured means admin is locked out, never wide open.
  if (!expected) return false;
  if (typeof supplied !== 'string' || !supplied.length) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function readGame() {
  const rows = await store.readAll();

  let state = null;
  const players = [];
  const plays = [];

  for (const row of rows) {
    if (row.key === STATE_KEY) state = row.value;
    else if (row.key.startsWith(SEAT)) {
      players.push(Object.assign({ id: row.key.slice(SEAT.length), score: 0, hand: [] }, row.value));
    } else if (row.key.startsWith(PLAY)) {
      plays.push(row.value);
    }
  }

  players.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

  // Before the host's first action there is no stored state. Synthesize one
  // WITHOUT a session id — freshState() mints a new one every call, and a
  // session that changes on every request reads to the player page as the
  // host resetting the game over and over.
  if (!state) state = Object.assign(G.freshState(), { session: null });

  return { state: state, players: players, plays: plays };
}

function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw
    .split('')
    .filter(function (ch) {
      const c = ch.charCodeAt(0);
      return c >= 32 && c !== 127;
    })
    .join('')
    .trim()
    .slice(0, MAX_NAME);
  return name.length ? name : null;
}

async function handle(method, body, query, admin) {
  if (method !== 'POST') {
    const game = await readGame();
    return G.redact(game, query.pid || null, admin);
  }

  const op = body.op;
  if (ADMIN_OPS.has(op) && !admin) {
    const err = new Error('Admin token required');
    err.status = 403;
    throw err;
  }

  // ---- player ops -------------------------------------------------

  if (op === 'join') {
    const name = cleanName(body.name);
    if (!name) throw new Error('A name is required to join');

    const game = await readGame();
    const byId = body.playerId ? game.players.find((p) => p.id === body.playerId) : null;

    if (byId) {
      // Rejoin after a refresh or a locked screen — same seat, same hand.
      if (byId.name !== name) {
        await store.put(SEAT + byId.id, Object.assign({}, byId, { name: name }));
      }
      return { playerId: byId.id, name: name };
    }

    // Same name, but the device lost its id (cleared storage, a different
    // browser, a borrowed phone). Hand the seat back rather than locking
    // someone out of their own hand mid-game. It does mean a player could
    // take over a seat by typing somebody else's name — acceptable in a
    // room where everyone can see each other, and the alternative is a
    // full reset every time a phone misbehaves.
    const byName = game.players.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (byName) return { playerId: byName.id, name: byName.name };

    if (game.players.length >= MAX_PLAYERS) throw new Error('This game is full');

    const id = G.newId();
    await store.put(SEAT + id, {
      name: name,
      score: 0,
      hand: [],
      joinedAt: Date.now(),
      session: game.state.session || G.newId(),
    });
    return { playerId: id, name: name };
  }

  if (op === 'play') {
    const game = await readGame();
    const player = game.players.find((p) => p.id === body.playerId);
    if (!player) throw new Error('You are not in this game any more — rejoin');
    if (game.state.phase !== 'playing') throw new Error('Not taking plays right now');
    if (!player.hand.includes(body.cardId)) throw new Error('That card is not in your hand');

    const already = game.plays.some(
      (p) => p.round === game.state.round && p.playerId === body.playerId,
    );
    if (already) throw new Error('You already played this round');

    await store.putMany([
      [
        PLAY + game.state.round + ':' + body.playerId,
        { round: game.state.round, playerId: body.playerId, cardId: body.cardId },
      ],
      [
        SEAT + player.id,
        Object.assign({}, player, { hand: player.hand.filter((id) => id !== body.cardId) }),
      ],
    ]);
    return { ok: true };
  }

  // ---- admin ops --------------------------------------------------

  if (op === 'reset') {
    await store.deleteAll();
    await store.put(STATE_KEY, G.freshState());
    return { ok: true };
  }

  if (op === 'deal') {
    const game = await readGame();
    if (!game.players.length) throw new Error('Nobody has joined yet');

    const dealt = G.dealHands(game.players.map((p) => p.id), G.shuffle(G.DECK_IDS));

    const state = Object.assign(G.freshState(), {
      phase: 'dealt',
      perPlayer: dealt.perPlayer,
      totalRounds: G.totalRounds(dealt.perPlayer),
      stackCount: dealt.stack.length,
      session: game.state.session || G.newId(),
    });

    // Scores survive a re-deal; plays do not, or round 1 would inherit the
    // cards played in the previous game's round 1.
    await store.deletePrefix(PLAY);
    await store.putMany(
      [[STATE_KEY, state]].concat(
        game.players.map((p) => [SEAT + p.id, Object.assign({}, p, { hand: dealt.hands[p.id] })]),
      ),
    );
    return { ok: true };
  }

  if (op === 'scenario') {
    const game = await readGame();
    const next = game.state.round + 1;
    await store.put(
      STATE_KEY,
      Object.assign({}, game.state, {
        round: next,
        phase: next > game.state.totalRounds ? 'final' : 'playing',
        winner: null,
      }),
    );
    return { ok: true };
  }

  if (op === 'reveal') {
    const game = await readGame();
    await store.put(STATE_KEY, Object.assign({}, game.state, { phase: 'revealed' }));
    return { ok: true };
  }

  if (op === 'pick') {
    const game = await readGame();
    const winner = game.players.find((p) => p.id === body.playerId);
    if (!winner) throw new Error('No such player');

    const play = game.plays.find(
      (p) => p.round === game.state.round && p.playerId === winner.id,
    );

    await store.putMany([
      [
        STATE_KEY,
        Object.assign({}, game.state, {
          phase: 'judged',
          winner: {
            playerId: winner.id,
            name: winner.name,
            cardId: play ? play.cardId : null,
          },
        }),
      ],
      [SEAT + winner.id, Object.assign({}, winner, { score: (winner.score || 0) + 1 })],
    ]);
    return { ok: true };
  }

  throw new Error('Unknown op: ' + op);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!store.isConfigured && !store.allowMemory) {
    res.status(503).json({
      error:
        'No database connected. Add Prisma Postgres under Storage in the Vercel project so DATABASE_URL is set, then redeploy.',
    });
    return;
  }

  try {
    let body = {};
    if (req.method === 'POST') {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    }
    const admin = isAdmin(req.headers && req.headers['x-admin-token']);
    const out = await handle(req.method, body, req.query || {}, admin);
    res.status(200).json(Object.assign({ now: Date.now() }, out));
  } catch (e) {
    res.status(e && e.status ? e.status : 400).json({ error: String((e && e.message) || e) });
  }
};
