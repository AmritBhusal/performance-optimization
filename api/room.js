// The whole game, held in the Redis store Vercel provisions
// (Storage -> Upstash for Redis). Three keys, all on a TTL so an
// abandoned game disappears by itself:
//   fd:state    JSON  — phase machine
//   fd:players  hash  — player id -> JSON { name, score, hand[] }
//   fd:plays    hash  — "<round>:<playerId>" -> JSON { cardId }
//
// One field per writer, so two players playing at the same moment never
// clobber each other and no locking is needed.
//
// GET  /api/room?pid=<id>   -> state redacted for that player
// POST /api/room  { op: 'join' | 'play' | 'deal' | 'scenario' | 'reveal'
//                     | 'pick' | 'reset', ... }
//
// The admin ops are token-gated: the page sits on a public URL, so
// without that check anyone with the link could deal, reveal and award
// points. Join and play stay open — both are harmless, and gating them
// would mean accounts.

const crypto = require('crypto');
const G = require('./_lib/game.js');

const TTL_SECONDS = 6 * 60 * 60;
const STATE_KEY = 'fd:state';
const PLAYERS_KEY = 'fd:players';
const PLAYS_KEY = 'fd:plays';

const MAX_PLAYERS = 40;
const MAX_NAME = 24;
const ADMIN_OPS = new Set(['deal', 'scenario', 'reveal', 'pick', 'reset']);

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(commands) {
  const res = await fetch(REST_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + REST_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error('Redis returned ' + res.status + ': ' + (await res.text()));
  const rows = await res.json();
  const failed = rows.find((r) => r && r.error);
  if (failed) throw new Error(failed.error);
  return rows.map((r) => r.result);
}

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

// HGETALL comes back as a flat [field, value, ...] array on the REST API,
// but tolerate an object shape too.
function toRows(hash) {
  const out = [];
  const push = (field, raw) => {
    try {
      out.push({ field: field, value: JSON.parse(raw) });
    } catch (e) {
      /* skip corrupt row */
    }
  };
  if (Array.isArray(hash)) {
    for (let i = 0; i < hash.length; i += 2) push(hash[i], hash[i + 1]);
  } else if (hash && typeof hash === 'object') {
    Object.keys(hash).forEach((k) => push(k, hash[k]));
  }
  return out;
}

async function readGame() {
  const [stateRaw, playerHash, playHash] = await redis([
    ['GET', STATE_KEY],
    ['HGETALL', PLAYERS_KEY],
    ['HGETALL', PLAYS_KEY],
  ]);

  const state = stateRaw ? JSON.parse(stateRaw) : G.freshState();
  const players = toRows(playerHash)
    .map((r) => Object.assign({ id: r.field, score: 0, hand: [] }, r.value))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  const plays = toRows(playHash).map((r) => r.value);

  return { state: state, players: players, plays: plays };
}

function saveState(state) {
  return ['SET', STATE_KEY, JSON.stringify(state), 'EX', String(TTL_SECONDS)];
}

function savePlayer(id, player) {
  return [
    ['HSET', PLAYERS_KEY, id, JSON.stringify(player)],
    ['EXPIRE', PLAYERS_KEY, String(TTL_SECONDS)],
  ];
}

function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw
    .split("")
    .filter(function (ch) { var c = ch.charCodeAt(0); return c >= 32 && c !== 127; })
    .join("")
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
    const byId = body.playerId
      ? game.players.find((p) => p.id === body.playerId)
      : null;

    if (byId) {
      // Rejoin after a refresh or a locked screen — same seat, same hand.
      if (byId.name !== name) {
        await redis(savePlayer(byId.id, Object.assign({}, byId, { name: name })));
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
    await redis(
      savePlayer(id, {
        name: name,
        score: 0,
        hand: [],
        joinedAt: Date.now(),
        session: game.state.session,
      }),
    );
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

    const field = game.state.round + ':' + body.playerId;
    await redis(
      [
        ['HSET', PLAYS_KEY, field, JSON.stringify({
          round: game.state.round,
          playerId: body.playerId,
          cardId: body.cardId,
        })],
        ['EXPIRE', PLAYS_KEY, String(TTL_SECONDS)],
      ].concat(
        savePlayer(
          player.id,
          Object.assign({}, player, {
            hand: player.hand.filter((id) => id !== body.cardId),
          }),
        ),
      ),
    );
    return { ok: true };
  }

  // ---- admin ops --------------------------------------------------

  if (op === 'reset') {
    const state = G.freshState();
    await redis([['DEL', PLAYERS_KEY], ['DEL', PLAYS_KEY], saveState(state)]);
    return { ok: true };
  }

  if (op === 'deal') {
    const game = await readGame();
    if (!game.players.length) throw new Error('Nobody has joined yet');

    const ids = game.players.map((p) => p.id);
    const dealt = G.dealHands(ids, G.shuffle(G.DECK_IDS));

    const state = Object.assign(G.freshState(), {
      phase: 'dealt',
      perPlayer: dealt.perPlayer,
      totalRounds: G.totalRounds(dealt.perPlayer),
      stackCount: dealt.stack.length,
      session: game.state.session,
    });

    // Scores survive a re-deal; plays do not, or round 1 would inherit
    // the cards played in the previous game's round 1.
    const cmds = [['DEL', PLAYS_KEY], saveState(state)];
    for (const p of game.players) {
      cmds.push(['HSET', PLAYERS_KEY, p.id, JSON.stringify(
        Object.assign({}, p, { hand: dealt.hands[p.id] }),
      )]);
    }
    cmds.push(['EXPIRE', PLAYERS_KEY, String(TTL_SECONDS)]);
    await redis(cmds);
    return { ok: true };
  }

  if (op === 'scenario') {
    const game = await readGame();
    const next = game.state.round + 1;
    const state = Object.assign({}, game.state, {
      round: next,
      phase: next > game.state.totalRounds ? 'final' : 'playing',
      winner: null,
    });
    await redis([saveState(state)]);
    return { ok: true };
  }

  if (op === 'reveal') {
    const game = await readGame();
    await redis([saveState(Object.assign({}, game.state, { phase: 'revealed' }))]);
    return { ok: true };
  }

  if (op === 'pick') {
    const game = await readGame();
    const winner = game.players.find((p) => p.id === body.playerId);
    if (!winner) throw new Error('No such player');

    const play = game.plays.find(
      (p) => p.round === game.state.round && p.playerId === winner.id,
    );
    const state = Object.assign({}, game.state, {
      phase: 'judged',
      winner: { playerId: winner.id, name: winner.name, cardId: play ? play.cardId : null },
    });
    await redis(
      [saveState(state)].concat(
        savePlayer(winner.id, Object.assign({}, winner, { score: (winner.score || 0) + 1 })),
      ),
    );
    return { ok: true };
  }

  throw new Error('Unknown op: ' + op);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!REST_URL || !REST_TOKEN) {
    res.status(503).json({
      error:
        'No Redis store connected. Add Upstash for Redis under Storage in the Vercel project, then redeploy.',
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
