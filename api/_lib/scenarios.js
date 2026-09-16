// Six scenarios, played in order.
//
// What goes on the big screen — context, question, metrics, findings — must
// describe the SITUATION and never name or imply a fix. No jargon, no
// "X is not configured", no "loading eagerly": those phrases hand the answer
// to the room and there is nothing left to argue about.
//
// `context` is an array of short paragraphs. Give the room a real picture:
// who uses this product, on what device and connection, what changed, and
// what the complaint actually feels like to the person making it. A player
// who cannot picture the user cannot judge which fix matters most.
//
// `findings` stay as flat measurements. The story explains the symptom; the
// findings are the evidence; the diagnosis is the players' job.
//
// `answerKey` is where the diagnosis lives. It is admin-only and never
// reaches a player or the projector.
//
// metric.status: 'bad' | 'warn' | 'ok' — drives the colour on screen.

const SCENARIOS = [
  {
    id: 'news-3g',
    title: 'Nepali news portal',
    tagline: 'Read on phones, on mobile data, on the morning commute',
    context: [
      'A news site read by about 40,000 people a day. Nine in ten of them open it on a phone, on mobile data, often on a crowded 3G connection on the way to work.',
      'The front page is a single column: one large photo for the lead story, then a list of eighteen smaller stories underneath it.',
      'Readers complain about two things. The screen stays blank for several seconds after they tap the link — long enough that some of them give up and close it. And when the text does appear, it jumps: they reach to tap a headline, the page moves under their thumb, and they open a different story than the one they wanted.',
    ],
    question: 'You can ship one fix this week. Which one, and why that one before the rest?',
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
        'LCP and CLS are both bad while INP and TTFB are fine — an image problem, not a JavaScript or server problem. The single biggest number is the 2.4 MB hero; resizing it alone probably halves LCP. The jumping is a separate fault caused by the missing dimensions, so a good answer names which complaint it is fixing. The Brotli and HTTP/2 cards are dead here because both are already on — a good moment to point out that "correct fix, already applied" scores nothing.',
    },
  },

  {
    id: 'admin-table',
    title: 'Internal admin dashboard',
    tagline: 'Twelve people, second monitor, nine to six every day',
    context: [
      'An operations team of twelve handle refunds and cancellations from one internal page. It sits open on their second monitor from nine in the morning until six at night, on office wifi, on ordinary desktop machines.',
      'The page shows every order in the system in a single long table, with a search box above it.',
      'Last month the company doubled the number of orders it processes. Nobody changed the page. But the team now says it "fights back". Opening it is fine — what hurts is using it. Clicking a row pauses before anything happens, and typing a customer name into the search box drops letters: they type eight characters and six arrive.',
    ],
    question: 'The team reckons they lose an hour a day to this. What do you fix first?',
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
        'LCP is fine and INP is catastrophic. Nothing about the network matters — the data arrives in 180ms. This is main-thread work, and virtualization dominates because it removes the cause of all three symptoms at once: the long task, the node count and the listener count. Debounce and delegation are real but smaller. Watch for someone playing a network card simply because it is a "performance card" — that habit is exactly what this round punishes.',
    },
  },

  {
    id: 'saas-landing',
    title: 'SaaS landing page',
    tagline: 'Paid traffic, every device, and two years of additions',
    context: [
      'This is the page every paid advert points at. Over two years the marketing team has added a testimonial carousel, a cookie banner, a live chat widget and three tracking scripts. In those two years nothing has ever been removed.',
      'Visitors arrive from ads on every kind of device and connection. The page looks more or less finished within a couple of seconds.',
      'Then something happens partway through loading: the whole page lurches downward. Someone who was about to click the signup button clicks an advert instead. Since the last redesign, more visitors leave without clicking anything at all, and the ads team is asking whether the page itself is the reason they are paying for traffic that bounces.',
    ],
    question: 'The ads team wants one change before the next campaign. Which one?',
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
      'The chat widget downloads 340 KB for every visitor. Roughly 2 in 100 visitors ever open it.',
      'The cookie banner appears about 1.2 seconds in and pushes everything below it further down the page.',
      'The images are already the right size and already in a modern format.',
    ],
    answerKey: {
      strong: ['rn-critical-css', 'rn-defer', 'js-dynamic-import', 'font-subset', 'js-treeshake', 'img-dimensions'],
      weak: ['rn-virtualize', 'rt-worker', 'be-nplusone', 'img-webp', 'img-compress', 'rt-delegation'],
      argument:
        'The "ship less code" round, and unusually many cards half-apply — that is the point, it should be the most argued. The blocking head is what holds LCP; the chat widget is the biggest single wasted download; the cookie banner is the entire CLS and the direct cause of the misclicks. img-dimensions is a legitimate sideways play if someone argues the banner needs reserved space — accept it if they argue it well. Note that js-preload is tempting here and wrong: preloading nine font files would make this worse.',
    },
  },

  {
    id: 'ecommerce-ttfb',
    title: 'Online shop, category page',
    tagline: 'Slow for everyone, everywhere, every single visit',
    context: [
      'The category page of an online shop, twenty-four products to a screen. It is the page most customers pass through before they buy anything.',
      'It is slow for everybody. Slow on the office gigabit line, slow on a phone in another country, slow on a first visit and slow on the hundredth. Everyone describes it the same way: you click the category, and then nothing happens for a couple of seconds — no spinner, no half-drawn page, just the old page sitting there — and then the new page appears all at once.',
      'During a sale, when everyone arrives at the same time, it gets dramatically worse. Last festival sale it stopped responding altogether for twenty minutes, in the middle of the busiest hour of the year.',
    ],
    question: 'The next sale is in three weeks. What do you fix first?',
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
        'TTFB is 2.1 seconds — the browser sits doing nothing for two full seconds before it can start, and no front-end card touches that. The "nothing happens, then everything at once" description is the giveaway, and this round tests whether anyone reads it. The N+1 is the root cause, server caching removes the repeat cost, pagination stops the payload growing. The sale collapse is the same fault under load. If someone plays cache-headers or cache-sw, push back: those help the second visit, and this page is slow on the first.',
    },
  },

  {
    id: 'react-spa',
    title: 'Logged-in dashboard',
    tagline: 'Four thousand users, four continents, mostly mid-range phones',
    context: [
      'A dashboard people log into to do their job. Around 4,000 users spread across four continents — many on mid-range Android phones, some on office laptops.',
      'Support keeps logging two complaints separately. The first: opening the app takes a very long time. People tap, get a blank white screen, and wait. The second: once it is finally open, moving between pages inside the app is also slow — which baffles people, because as far as they are concerned the app is already loaded.',
      'And the ones who use it every single day report the same thing: the second day is no faster than the first. Nothing they do seems to warm it up.',
    ],
    question: 'Three complaints, possibly three different causes. Which fix do you ship first?',
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
      'Fonts, analytics and a support widget come from three other companies. Each connection takes about 600ms to set up.',
      'Moving between pages inside the app fetches data the app already had moments earlier.',
      'Images and fonts are already optimised. The server responds in 180ms.',
    ],
    answerKey: {
      strong: ['js-split', 'js-dynamic-import', 'cache-headers', 'net-preconnect', 'cache-sw', 'net-prefetch', 'js-treeshake'],
      weak: ['img-compress', 'rn-virtualize', 'be-nplusone', 'img-dimensions', 'rn-transform-opacity'],
      argument:
        'The widest field in the game — most bundle and caching cards are genuinely playable, so judge on the argument rather than the category. The three complaints map to three different fixes: splitting fixes the first load, cache headers fix "the second day is no faster", prefetch or a service worker fix navigation. A strong answer says which of the three complaints it is aimed at. "Do not keep a copy" on every file is the most embarrassing line in the findings and somebody should say so out loud.',
    },
  },

  {
    id: 'trap-round',
    title: 'The one that looks obvious',
    tagline: 'Final round. Read every line before you play.',
    context: [
      'A content site that a previous team already spent three months making faster. They did good work, and most of it was the right work. It is still slower than it should be.',
      'In the meeting where this was discussed, the most senior engineer in the room proposed joining the 42 JavaScript files back into one file, to cut down the number of requests the browser has to make. Everybody nodded. It sounds obviously right.',
      'Before you agree with them, read the numbers below. All of them.',
    ],
    question: 'Is the suggestion on the table a good one — and if not, what would you do instead?',
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
        'The whole round is a trap. net-concat is the bait and it is wrong twice over: HTTP/3 already removed the per-request cost that made bundling worthwhile, and merging files that browsers cache individually means one small change invalidates all 180 KB. Every other infrastructure card is already applied. The real answer is sitting in plain sight — a 1.1 MB PNG displayed at 140x40, which is also the largest thing on screen, so it is the LCP element. Award the point to whoever ignores the senior engineer and reads the waterfall. If nobody does, that is the best possible ending to the session.',
    },
  },
];

const SCENARIOS_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

module.exports = { SCENARIOS, SCENARIOS_BY_ID };
