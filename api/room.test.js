// Self-check for the room handler: node api/room.test.js
// Runs against the in-memory store, so no database is needed.
const assert = require('assert');

// Runs in memory by default. Point DATABASE_URL at any Postgres to run the
// same checks through the real SQL path:
//   DATABASE_URL=postgres://... node api/room.test.js
process.env.FIXDRAFT_ALLOW_MEMORY = '1';
process.env.ADMIN_TOKEN = 'test-token';
console.log(process.env.DATABASE_URL ? 'Running against Postgres' : 'Running in memory');

const handler = require('./room.js');
const { SCENARIOS } = require('./_lib/scenarios.js');
const { CARDS } = require('./_lib/cards.js');

function call(method, body, query, token) {
  return new Promise((resolve) => {
    const req = { method, body, query: query || {}, headers: token ? { 'x-admin-token': token } : {} };
    const res = {
      statusCode: 0,
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
    };
    handler(req, res);
  });
}

const ADMIN = 'test-token';

(async () => {
  // ---- deck integrity -------------------------------------------------
  assert.strictEqual(CARDS.length, 30, 'deck must be exactly 30 cards');
  assert.strictEqual(new Set(CARDS.map((c) => c.id)).size, 30, 'card ids must be unique');
  assert.strictEqual(SCENARIOS.length, 6, 'six scenarios');

  const cardIds = new Set(CARDS.map((c) => c.id));
  for (const s of SCENARIOS) {
    for (const id of s.answerKey.strong.concat(s.answerKey.weak)) {
      assert.ok(cardIds.has(id), `scenario ${s.id} references unknown card ${id}`);
    }
  }

  // ---- lobby ----------------------------------------------------------
  await call('POST', { op: 'reset' }, {}, ADMIN);

  let r = await call('GET');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.phase, 'lobby');

  // ---- admin gate -----------------------------------------------------
  r = await call('POST', { op: 'deal' });
  assert.strictEqual(r.status, 403, 'deal without a token must be refused');
  r = await call('POST', { op: 'deal' }, {}, 'wrong-token');
  assert.strictEqual(r.status, 403, 'deal with a bad token must be refused');

  // ---- join -----------------------------------------------------------
  const ids = [];
  for (const name of ['Amrit', 'Bikash', 'Chirag', 'Deepa', 'Esha']) {
    const j = await call('POST', { op: 'join', name });
    assert.strictEqual(j.status, 200, 'join should succeed: ' + JSON.stringify(j.body));
    ids.push(j.body.playerId);
  }
  // Rejoin keeps the same seat.
  r = await call('POST', { op: 'join', name: 'Amrit', playerId: ids[0] });
  assert.strictEqual(r.body.playerId, ids[0], 'rejoin by id returns the same seat');

  // A phone that lost its id gets the seat back by name rather than being
  // locked out, and does not create a sixth player.
  r = await call('POST', { op: 'join', name: 'amrit' });
  assert.strictEqual(r.body.playerId, ids[0], 'rejoin by name returns the same seat');
  const after = await call('GET');
  assert.strictEqual(after.body.players.length, 5, 'rejoining never adds a duplicate player');

  // ---- deal -----------------------------------------------------------
  r = await call('POST', { op: 'deal' }, {}, ADMIN);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));

  r = await call('GET', null, { pid: ids[0] });
  assert.strictEqual(r.body.phase, 'dealt');
  assert.strictEqual(r.body.totalRounds, 6, '5 players -> 6 cards each -> 6 rounds');
  assert.strictEqual(r.body.you.hand.length, 6);
  assert.strictEqual(r.body.stackCount, 0, '30 / 5 divides evenly, nothing left in the stack');

  // Every hand is disjoint — no card dealt twice.
  const seen = new Set();
  for (const id of ids) {
    const s = await call('GET', null, { pid: id });
    for (const c of s.body.you.hand) {
      assert.ok(!seen.has(c.id), 'card ' + c.id + ' was dealt twice');
      seen.add(c.id);
    }
  }
  assert.strictEqual(seen.size, 30);

  // ---- secrecy: nobody sees another hand ------------------------------
  const asA = await call('GET', null, { pid: ids[0] });
  assert.strictEqual(asA.body.you.id, ids[0]);
  const serialized = JSON.stringify(asA.body.players);
  assert.ok(!serialized.includes('hand'), 'other players expose no hand field');

  // ---- round 1 --------------------------------------------------------
  await call('POST', { op: 'scenario' }, {}, ADMIN);
  r = await call('GET', null, { pid: ids[0] });
  assert.strictEqual(r.body.phase, 'playing');
  assert.strictEqual(r.body.round, 1);
  assert.strictEqual(r.body.scenario.id, SCENARIOS[0].id);

  // The answer key is admin-only.
  assert.strictEqual(r.body.answerKey, undefined, 'players never receive the answer key');
  const adminView = await call('GET', null, {}, ADMIN);
  assert.ok(adminView.body.answerKey, 'admin receives the answer key');

  // ---- play -----------------------------------------------------------
  const hands = {};
  for (const id of ids) {
    const s = await call('GET', null, { pid: id });
    hands[id] = s.body.you.hand.map((c) => c.id);
  }

  r = await call('POST', { op: 'play', playerId: ids[0], cardId: hands[ids[1]][0] });
  assert.strictEqual(r.status, 400, 'cannot play a card from somebody else\'s hand');

  for (const id of ids) {
    r = await call('POST', { op: 'play', playerId: id, cardId: hands[id][0] });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  }

  r = await call('POST', { op: 'play', playerId: ids[0], cardId: hands[ids[0]][1] });
  assert.strictEqual(r.status, 400, 'cannot play twice in one round');

  // ---- secrecy: plays stay hidden until the reveal ---------------------
  r = await call('GET', null, { pid: ids[0] });
  assert.strictEqual(r.body.plays.length, 0, 'no card faces before the reveal');
  assert.strictEqual(r.body.playedCount, 5, 'but the count is visible');
  assert.strictEqual(r.body.you.hand.length, 5, 'the played card left the hand');

  const adminBeforeReveal = await call('GET', null, {}, ADMIN);
  assert.strictEqual(adminBeforeReveal.body.plays.length, 0, 'not even the admin peeks early');

  // ---- reveal and judge ------------------------------------------------
  await call('POST', { op: 'reveal' }, {}, ADMIN);
  r = await call('GET', null, { pid: ids[0] });
  assert.strictEqual(r.body.plays.length, 5);
  assert.ok(r.body.plays[0].card.title, 'revealed plays carry the full card');

  await call('POST', { op: 'pick', playerId: ids[2] }, {}, ADMIN);
  r = await call('GET', null, { pid: ids[2] });
  assert.strictEqual(r.body.phase, 'judged');
  assert.strictEqual(r.body.winner.playerId, ids[2]);
  assert.strictEqual(r.body.you.score, 1, 'the winner gained a point');
  assert.strictEqual(r.body.players[0].id, ids[2], 'leaderboard is sorted by score');

  // ---- run out the remaining rounds ------------------------------------
  for (let round = 2; round <= 6; round++) {
    await call('POST', { op: 'scenario' }, {}, ADMIN);
    const s = await call('GET', null, { pid: ids[0] });
    assert.strictEqual(s.body.round, round);
    assert.strictEqual(s.body.phase, 'playing');
    assert.strictEqual(s.body.scenario.id, SCENARIOS[round - 1].id);
    assert.strictEqual(s.body.plays.length, 0, 'round ' + round + ' starts with no plays');
  }

  // Round 7 does not exist — the game ends.
  await call('POST', { op: 'scenario' }, {}, ADMIN);
  r = await call('GET', null, { pid: ids[0] });
  assert.strictEqual(r.body.phase, 'final');

  // ---- re-deal clears plays but keeps scores ---------------------------
  await call('POST', { op: 'deal' }, {}, ADMIN);
  r = await call('GET', null, { pid: ids[2] });
  assert.strictEqual(r.body.phase, 'dealt');
  assert.strictEqual(r.body.you.score, 1, 'scores survive a re-deal');
  assert.strictEqual(r.body.you.hand.length, 6, 'and everyone is dealt a fresh full hand');
  await call('POST', { op: 'scenario' }, {}, ADMIN);
  r = await call('GET', null, { pid: ids[2] });
  assert.strictEqual(r.body.playedCount, 0, 'round 1 does not inherit the old plays');

  // ---- reset ------------------------------------------------------------
  await call('POST', { op: 'reset' }, {}, ADMIN);
  r = await call('GET');
  assert.strictEqual(r.body.phase, 'lobby');
  assert.strictEqual(r.body.players.length, 0);

  console.log('All checks passed.');
  process.exit(0); // the pg pool would otherwise hold the process open
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
