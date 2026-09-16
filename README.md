# Fix Draft

A card game for a standup session on web performance. Everyone gets a hand of
real optimization fixes; each round puts a broken site on the big screen; you
play the card that actually fixes *that* site, then argue for it. The host
awards the point.

Built from [`Performance-optimization.md`](./Performance-optimization.md) — the
scenarios and the answer keys are that document turned into rounds.

No dependencies, no build step, no `package.json`. Static files plus one Vercel
function, same shape as `../frontend-Security`.

---

## Run it locally

```bash
node dev.js
```

| View    | URL                              |
| ------- | -------------------------------- |
| Players | `http://localhost:3000/`         |
| Screen  | `http://localhost:3000/#/screen` |
| Admin   | `http://localhost:3000/#/admin`  |

With no Redis configured it keeps the game in memory and prints the admin token
it generated (`dev`). Set `PORT=3111` or similar if 3000 is busy. Drop a `.env`
with the usual `KV_REST_API_*` keys next to `dev.js` to run against real Upstash
instead.

Self-check for the game logic — dealing, the phase machine, and every secrecy
rule:

```bash
node api/room.test.js
```

## Deploy

1. `vercel` (or import the folder in the dashboard). Zero config — the repo root
   is served static, `api/room.js` becomes the function.
2. In the project: **Storage → Upstash for Redis → Connect**. That injects
   `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. **Settings → Environment Variables → `ADMIN_TOKEN`**, set it to anything you
   will remember for the length of one meeting.
4. Redeploy so both land.

Without `ADMIN_TOKEN` set, the host controls are locked out entirely — that is
deliberate, so a missing variable can never leave the game wide open.

## Running the session

Open `#/screen` on the projector and `#/admin` on your own phone or laptop.
Unlock the admin view once with the token; it is stored on that device only.

The screen shows a QR code. Everyone scans, types a name, and they are in.

Then it is one button. It always says what happens next:

| Phase    | Button                    | What is happening                                |
| -------- | ------------------------- | ------------------------------------------------ |
| Lobby    | Deal the cards            | 30 cards split evenly, remainder stays undealt   |
| Dealt    | Show scenario 1           | The briefing goes up on the screen               |
| Playing  | Reveal the cards          | Wait for the counter to reach everyone first     |
| Revealed | *tap a card*              | Let them argue, then tap the winning card        |
| Judged   | Show scenario 2…          | Point awarded, next round                        |
| Final    | Reset for a new game      | Clears players and scores                        |

**5 players → 6 cards each → 6 rounds, hands empty exactly at the end.** Other
counts work: everyone gets `floor(30 / players)` cards and the rounds stop when
hands or scenarios run out, whichever comes first. Leftover cards stay in the
stack. You can re-deal at any point — scores survive, plays are cleared.

The admin view carries an **answer key** for the live scenario: strong plays,
weak plays, and the argument to steer the discussion toward. Cards actually on
the table are flagged, so you can see at a glance who found the real fix. It
only ever reaches a client holding a valid token — the projector and the phones
never receive it.

### If something goes wrong

- **A phone lost its place** — rejoin with the same name. The seat and hand come
  back. (This also means anyone can take a seat by typing someone else's name,
  which is fine in a room where everyone can see each other.)
- **Someone joined late** — they can join any time, but they hold no cards until
  you re-deal.
- **Wrong card crowned** — no undo. Re-deal resets the round but keeps scores;
  a full Reset clears everything.
- **Screen looks stale** — every view polls once a second; a hard refresh is
  safe and loses nothing.

## The content

- `api/_lib/cards.js` — the 30 fix cards
- `api/_lib/scenarios.js` — the 6 scenarios and their answer keys

Both live under `api/_lib/` rather than the repo root on purpose: Vercel reserves
`api/` for functions and never serves it as static, so nobody can read the answer
keys by guessing a URL. `_`-prefixed paths are also skipped as routes.

The client never bundles either file. Card faces and scenario text arrive inside
the API payload, redacted per viewer — which is also how a player's hand stays
private and how played cards stay hidden until the reveal.

Editing either file changes the game immediately; the only coupling is that
`answerKey` entries reference card ids, and `node api/room.test.js` fails if one
does not exist.

## The rounds

1. **Nepali news portal** — 3G, oversized hero, no dimensions → images
2. **Admin dashboard** — 12k rows, INP 740ms → main thread
3. **SaaS landing page** — dead CSS/JS, six font weights, chat widget → ship less
4. **E-commerce listing** — TTFB 2.1s, N+1, no cache → server
5. **React SPA** — 1.4 MB bundle, `no-cache` on everything → split and cache
6. **The trap** — already on HTTP/3 + CDN + Brotli, and someone wants to
   concatenate 42 chunks. The real culprit is a 1.1 MB PNG logo sitting in the
   waterfall. Award the point to whoever ignores the bait and reads the numbers.
# performance-optimization
