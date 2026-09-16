// Six scenarios, played in order.
//
// What goes on the big screen — context, question, metrics, findings — must
// describe the SITUATION in plain words and never name or imply a fix. No
// jargon, no "X is not configured", no "loading eagerly": those phrases hand
// the answer to the room and there is nothing left to argue about. State raw
// observations and let the players interpret them. That interpretation is
// the whole game.
//
// `answerKey` is where the diagnosis lives. It is admin-only and never
// reaches a player or the projector.
//
// metric.status: 'bad' | 'warn' | 'ok' — drives the colour on screen.

const SCENARIOS = [
  {
    id: 'news-3g',
    title: 'Nepali news portal',
    tagline: 'Read mostly on phones, on slow mobile data, in Kathmandu',
    context:
      'A news website for readers in Nepal. Almost everyone opens it on a phone over mobile data. The front page is a list of stories with one large photo at the top. Readers say the screen stays empty for a long time, and then the page shifts under their finger while they are trying to tap a headline.',
    question: 'What would you fix first?',
    metrics: [
      { label: 'LCP', value: '6.8s', status: 'bad' },
      { label: 'INP', value: '180ms', status: 'ok' },
      { label: 'CLS', value: '0.31', status: 'bad' },
      { label: 'TTFB', value: '380ms', status: 'ok' },
    ],
    findings: [
      'The large photo at the top of the page is 2.4 MB and 1920 pixels wide. The phones loading it have screens about 360 pixels wide.',
      'There are 18 smaller story photos further down. All of them download the moment the page opens, before anyone has scrolled.',
      'None of the images tell the browser how much space to leave for them before they arrive.',
      'The JavaScript file is 210 KB, and a typical phone here spends 340ms working through it.',
      'Every file is served from a single server in Singapore. Nearly all readers are in Kathmandu.',
      'Text files are already compressed before being sent, and the server already uses HTTP/2.',
    ],
    answerKey: {
      strong: ['img-compress', 'img-srcset', 'img-webp', 'img-dimensions', 'img-lazy', 'net-cdn'],
      weak: ['rt-worker', 'rn-virtualize', 'be-nplusone', 'rt-delegation', 'net-brotli', 'net-http2'],
      argument:
        'LCP and CLS are both bad while INP and TTFB are fine — an image problem, not a JavaScript or server problem. The single biggest number is the 2.4 MB hero; resizing it alone probably halves LCP. CLS is a separate fault caused by the missing dimensions. The Brotli and HTTP/2 cards are dead here because both are already on — a good moment to point out that "correct fix, already applied" scores nothing.',
    },
  },

  {
    id: 'admin-table',
    title: 'Internal admin dashboard',
    tagline: 'Office wifi, desktop browsers, staff live in it all day',
    context:
      'An internal tool the operations team uses all day. One screen lists every order in the system in a single long table, with a search box above it. The page appears quickly enough. But clicking a row takes a visible moment, and typing in the search box makes the whole page stutter.',
    question: 'What would you fix first?',
    metrics: [
      { label: 'LCP', value: '1.9s', status: 'ok' },
      { label: 'INP', value: '740ms', status: 'bad' },
      { label: 'CLS', value: '0.00', status: 'ok' },
      { label: 'TTFB', value: '210ms', status: 'ok' },
    ],
    findings: [
      'The table puts all 12,400 orders on the page at once — about 38,000 elements in total.',
      'While the table is being built, the browser is busy for 900ms without a break and cannot respond to anything during it.',
      'Each of the 12,400 rows sets up its own click handler.',
      'The search box re-filters and redraws the entire table on every keystroke.',
      'All the data arrives from the server in 180ms.',
      'The files are already served from a CDN, already compressed, and already cached.',
    ],
    answerKey: {
      strong: ['rn-virtualize', 'rt-debounce', 'rt-delegation', 'be-paginate', 'rn-dom-size'],
      weak: ['img-webp', 'net-cdn', 'net-preconnect', 'net-brotli', 'cache-headers', 'img-lazy'],
      argument:
        'LCP is fine and INP is catastrophic. Nothing about the network matters — the API answers in 180ms. This is main-thread work, and virtualization dominates because it removes the cause of all three symptoms at once: the long task, the node count and the listener count. Debounce and delegation are real but smaller. Watch for someone playing a network card simply because it is a "performance card" — that habit is exactly what this round punishes.',
    },
  },

  {
    id: 'saas-landing',
    title: 'SaaS marketing landing page',
    tagline: 'Paid ad traffic, mixed devices, more people leaving than before',
    context:
      'The main marketing page for a product. Two years of additions and nothing ever removed. It looks finished within a couple of seconds, but partway through loading the content jumps downwards. Since the last redesign, more visitors leave without clicking anything.',
    question: 'What would you fix first?',
    metrics: [
      { label: 'LCP', value: '4.2s', status: 'bad' },
      { label: 'INP', value: '150ms', status: 'ok' },
      { label: 'CLS', value: '0.24', status: 'bad' },
      { label: 'TTFB', value: '290ms', status: 'ok' },
    ],
    findings: [
      'Of the CSS the page downloads, 71% is never used. Of the JavaScript, 64% is never used.',
      'Three stylesheets and one script sit at the top of the page, and the browser draws nothing at all until every one of them has finished downloading.',
      'The page loads nine font files totalling 320 KB — six different weights of the same typeface.',
      'A chat widget downloads 340 KB for every visitor. Roughly 2 in 100 visitors ever open it.',
      'A cookie banner appears about 1.2 seconds in and pushes everything below it further down the page.',
      'The images are already the right size and already in a modern format.',
    ],
    answerKey: {
      strong: ['rn-critical-css', 'rn-defer', 'js-dynamic-import', 'font-subset', 'js-treeshake', 'img-dimensions'],
      weak: ['rn-virtualize', 'rt-worker', 'be-nplusone', 'img-webp', 'img-compress', 'rt-delegation'],
      argument:
        'The "ship less code" round, and unusually many cards half-apply — that is the point, it should be the most argued. The blocking head is what holds LCP; the chat widget is the biggest single wasted download; the cookie banner is the entire CLS. img-dimensions is a legitimate sideways play if someone argues the banner needs reserved space — accept it if they argue it well. Note that js-preload is tempting here and wrong: preloading nine font files would make this worse.',
    },
  },

  {
    id: 'ecommerce-ttfb',
    title: 'Online shop, category page',
    tagline: 'Slow for everyone, everywhere, first visit or hundredth',
    context:
      'The category page of an online shop, showing 24 products at a time. It is slow for everybody — on fast office wifi and on phones, in every country, on a first visit and on a repeat visit. During a sale it gets dramatically worse.',
    question: 'What would you fix first?',
    metrics: [
      { label: 'LCP', value: '3.4s', status: 'bad' },
      { label: 'INP', value: '120ms', status: 'ok' },
      { label: 'CLS', value: '0.02', status: 'ok' },
      { label: 'TTFB', value: '2.1s', status: 'bad' },
    ],
    findings: [
      'The browser waits 2.1 seconds before the server sends back anything at all.',
      'Serving one page runs 84 separate database queries.',
      'The page asks the database for the list of products, then asks again once per product to check whether it is in stock.',
      'The server builds the page from scratch for every visitor, and every visitor receives an identical result.',
      'The server sends all 2,400 products to the browser. The page displays 24 of them.',
      'The JavaScript is 90 KB and the images are already optimised.',
    ],
    answerKey: {
      strong: ['be-nplusone', 'cache-server', 'be-paginate'],
      weak: ['img-lazy', 'img-webp', 'font-subset', 'rt-worker', 'rn-virtualize', 'net-preconnect'],
      argument:
        'TTFB is 2.1 seconds — the browser sits doing nothing for two full seconds before it can start, and no front-end card touches that. This round exists to test whether people read TTFB before reaching for a familiar fix. The N+1 is the root cause, server caching removes the repeat cost, pagination stops the payload growing. If someone plays cache-headers or cache-sw, push back: those help the second visit, and this page is slow on the first.',
    },
  },

  {
    id: 'react-spa',
    title: 'Logged-in dashboard, users worldwide',
    tagline: 'Four continents, many on mid-range Android phones',
    context:
      'A dashboard people log into for work, used from four continents and often on mid-range Android phones. There are two separate complaints. The first load takes a very long time. And moving between pages inside the app feels slow too, even though the app is already open. Daily users say the second day is no faster than the first.',
    question: 'What would you fix first?',
    metrics: [
      { label: 'LCP', value: '5.1s', status: 'bad' },
      { label: 'INP', value: '210ms', status: 'warn' },
      { label: 'CLS', value: '0.04', status: 'ok' },
      { label: 'TTI', value: '8.2s', status: 'bad' },
    ],
    findings: [
      'The whole app arrives as one 1.4 MB JavaScript file. On a mid-range Android phone it is 8.2 seconds before the page responds to taps.',
      'A charting library of 480 KB is inside that file. One page in the app uses charts.',
      'Every file is sent with instructions telling the browser not to keep a copy, so people who return download all of it again.',
      'The page contacts three other companies’ servers for fonts, analytics and a support widget. Each connection takes about 600ms to set up before any data moves.',
      'Moving between pages inside the app fetches data the app already had moments earlier.',
      'Images and fonts are already optimised, and the server responds in 180ms.',
    ],
    answerKey: {
      strong: ['js-split', 'js-dynamic-import', 'cache-headers', 'net-preconnect', 'cache-sw', 'net-prefetch', 'js-treeshake'],
      weak: ['img-compress', 'rn-virtualize', 'be-nplusone', 'img-dimensions', 'rn-transform-opacity'],
      argument:
        'The widest field in the game — most bundle and caching cards are genuinely playable, so judge on the argument rather than the category. The three complaints map to three different fixes: splitting fixes the first load, cache headers fix the second visit, prefetch or a service worker fix navigation. "Do not keep a copy" on every file is the most embarrassing line in the findings and somebody should say so out loud.',
    },
  },

  {
    id: 'trap-round',
    title: 'The one that looks obvious',
    tagline: 'Final round. Read every line before you play.',
    context:
      'A content site that a previous team already spent three months making faster. It is still slow. Someone senior has proposed joining the 42 JavaScript files back into one file, to cut down the number of requests the browser has to make. Before anyone agrees with them, read the numbers.',
    question: 'What would you fix first — and is the suggestion on the table a good one?',
    metrics: [
      { label: 'LCP', value: '3.1s', status: 'bad' },
      { label: 'INP', value: '90ms', status: 'ok' },
      { label: 'CLS', value: '0.01', status: 'ok' },
      { label: 'TTFB', value: '140ms', status: 'ok' },
    ],
    findings: [
      'The site already uses HTTP/3, already serves through a CDN, already compresses text, and already tells browsers to keep copies of files for a long time.',
      'There are 42 JavaScript files totalling 180 KB, and they all arrive over a single shared connection.',
      'Sorted by size, the largest thing the page downloads is the site logo: a 1.1 MB PNG.',
      'That logo is displayed at 140 by 40 pixels, and it is the largest thing visible when the page first appears.',
      'The second largest file is 96 KB. Everything else is under 20 KB.',
      'Nothing moves on the page while it loads, no single task blocks the browser, and no database query is slow.',
    ],
    answerKey: {
      strong: ['img-compress', 'img-webp'],
      weak: ['net-concat', 'net-http2', 'net-brotli', 'cache-headers', 'js-split', 'net-cdn', 'cache-sw'],
      argument:
        'The whole round is a trap. net-concat is the bait and it is wrong twice over: HTTP/3 already removed the per-request cost that made bundling worthwhile, and merging files that browsers cache individually means one small change invalidates all 180 KB. Every other infrastructure card is already applied. The real answer is sitting in plain sight — a 1.1 MB PNG displayed at 140x40, which is also the largest thing on screen. Award the point to whoever ignores the senior engineer and reads the waterfall. If nobody does, that is the best possible ending to the session.',
    },
  },
];

const SCENARIOS_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

module.exports = { SCENARIOS, SCENARIOS_BY_ID };
