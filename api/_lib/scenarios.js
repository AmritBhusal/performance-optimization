// Six scenarios, played in order. `answerKey` is admin-only — it never
// reaches a player or the projector screen.
//
// metric.status: 'bad' | 'warn' | 'ok' — drives the colour on screen.

const SCENARIOS = [
  {
    id: 'news-3g',
    title: 'Nepali news portal',
    tagline: 'Most readers are on 3G, mid-range Android, in Kathmandu',
    context:
      'A regional news site. Traffic is 84% mobile. The homepage is a grid of article cards with a large hero story on top. Readers complain that the page is blank for ages and then "jumps around" while they are trying to tap a headline.',
    metrics: [
      { label: 'LCP', value: '6.8s', status: 'bad' },
      { label: 'INP', value: '180ms', status: 'ok' },
      { label: 'CLS', value: '0.31', status: 'bad' },
      { label: 'TTFB', value: '380ms', status: 'ok' },
    ],
    findings: [
      'Hero image is a 2.4 MB JPEG at 1920×1080, displayed in a 360px-wide viewport',
      '18 article thumbnails below the fold, all loading eagerly on page load',
      'No width or height attribute on any <img> on the page',
      'JS bundle is 210 KB gzipped — parses in 340ms on the target device',
      'Origin server is in Singapore; CDN is not configured',
      'Brotli is already enabled, HTTP/2 already on',
    ],
    answerKey: {
      strong: ['img-compress', 'img-srcset', 'img-webp', 'img-dimensions', 'img-lazy', 'net-cdn'],
      weak: ['rt-worker', 'rn-virtualize', 'be-nplusone', 'rt-delegation', 'net-brotli', 'net-http2'],
      argument:
        'LCP and CLS are both bad, INP and TTFB are fine — this is an image problem, not a JavaScript or server problem. The single biggest number is the 2.4 MB hero: resizing it alone probably halves LCP. CLS is separately caused by the missing dimensions. Brotli and HTTP/2 cards are dead here because both are already on — a good moment to point out that "correct fix, already applied" scores nothing.',
    },
  },

  {
    id: 'admin-table',
    title: 'Internal admin dashboard',
    tagline: 'Office wifi, desktop Chrome, staff use it all day',
    context:
      'An internal tool for the ops team. One screen shows every order in the system in a single table with a filter box on top. The page loads acceptably, but everyone describes it as "laggy" — clicking a row takes a visible moment, and typing into the filter drops frames.',
    metrics: [
      { label: 'LCP', value: '1.9s', status: 'ok' },
      { label: 'INP', value: '740ms', status: 'bad' },
      { label: 'CLS', value: '0.00', status: 'ok' },
      { label: 'TTFB', value: '210ms', status: 'ok' },
    ],
    findings: [
      '12,400 rows rendered into the DOM at once — 38,000 total DOM nodes',
      'Performance tab: one 900ms long task during render, 2.3s total scripting',
      'Every row attaches its own click listener on mount',
      'The filter input runs the full filter + re-render on every keystroke',
      'All data arrives in a single API response in 180ms — the network is not the problem',
      'Assets are already on a CDN, already compressed, already cached',
    ],
    answerKey: {
      strong: ['rn-virtualize', 'rt-debounce', 'rt-delegation', 'be-paginate', 'rn-dom-size'],
      weak: ['img-webp', 'net-cdn', 'net-preconnect', 'net-brotli', 'cache-headers', 'img-lazy'],
      argument:
        'LCP is fine, INP is catastrophic. Nothing about the network matters here — the API responds in 180ms. This is main-thread work, and virtualization is the dominant fix because it removes the cause of all three symptoms at once (long task, node count, listener count). Debounce and delegation are real but smaller. Watch for someone playing a network card because it is a "performance card" — that is exactly the habit this round is designed to punish.',
    },
  },

  {
    id: 'saas-landing',
    title: 'SaaS marketing landing page',
    tagline: 'Paid ad traffic, mixed devices, bounce rate is climbing',
    context:
      'The main marketing page for a B2B product. Marketing has been adding tools to it for two years and nobody has removed any. The page looks finished within a couple of seconds but content visibly shifts down partway through load, and the ad team says bounce rate went up after the last redesign.',
    metrics: [
      { label: 'LCP', value: '4.2s', status: 'bad' },
      { label: 'INP', value: '150ms', status: 'ok' },
      { label: 'CLS', value: '0.24', status: 'bad' },
      { label: 'TTFB', value: '290ms', status: 'ok' },
    ],
    findings: [
      'Coverage tab: 71% of shipped CSS and 64% of shipped JS is never executed',
      'Three render-blocking <link rel="stylesheet"> plus a synchronous analytics <script> in <head>',
      'Six weights of one font family, nine font files, 320 KB total',
      'Chat widget downloads 340 KB on every page load — 2% of visitors ever open it',
      'Cookie banner is injected at ~1.2s and pushes all page content down',
      'Images are already WebP and already sized correctly',
    ],
    answerKey: {
      strong: ['rn-critical-css', 'rn-defer', 'js-dynamic-import', 'font-subset', 'js-treeshake', 'img-dimensions'],
      weak: ['rn-virtualize', 'rt-worker', 'be-nplusone', 'img-webp', 'img-compress', 'rt-delegation'],
      argument:
        'This is the "ship less code" round, and unusually many cards half-apply — that is the point, it should be the most argued round. The render-blocking head is what holds LCP; the chat widget is the biggest single wasted download; the cookie banner is the entire CLS. img-dimensions is a legitimate sideways play if someone argues the banner needs reserved space — accept the argument if they make it well. Note that js-preload is tempting here and wrong: preloading nine font files would make it worse, not better.',
    },
  },

  {
    id: 'ecommerce-ttfb',
    title: 'E-commerce product listing',
    tagline: 'Same catalogue page for every visitor, traffic is growing',
    context:
      'The category listing page of an online store. It shows 24 products per screen. The page is slow for everyone, everywhere, on every device and connection — including on the office gigabit line — and it gets dramatically worse during sale traffic.',
    metrics: [
      { label: 'LCP', value: '3.4s', status: 'bad' },
      { label: 'INP', value: '120ms', status: 'ok' },
      { label: 'CLS', value: '0.02', status: 'ok' },
      { label: 'TTFB', value: '2.1s', status: 'bad' },
    ],
    findings: [
      'Server logs show 84 database queries per page load',
      'The page queries the product list, then runs one stock-check query per product',
      'No caching layer anywhere — every request recomputes the identical result',
      'The API returns all 2,400 products; the page renders 24 of them',
      'Every visitor gets byte-identical HTML, rendered fresh per request',
      'Front-end bundle is 90 KB gzipped and images are already optimised',
    ],
    answerKey: {
      strong: ['be-nplusone', 'cache-server', 'be-paginate'],
      weak: ['img-lazy', 'img-webp', 'font-subset', 'rt-worker', 'rn-virtualize', 'net-preconnect'],
      argument:
        'TTFB is 2.1 seconds. The browser is sitting idle doing nothing for two full seconds before it can start — no front-end card can fix that, and this round exists to test whether people actually read TTFB before reaching for a familiar fix. The N+1 is the root cause, server caching removes the repeat cost, pagination stops the payload growing. If a player plays cache-headers or cache-sw, push back: those help the second visit, and this page is slow on the first.',
    },
  },

  {
    id: 'react-spa',
    title: 'React SPA, global user base',
    tagline: 'Users in four continents, many on mid-range Android',
    context:
      'A logged-in product dashboard. Users complain about two separate things: the first load takes forever, and moving between pages inside the app also feels slow even though they have "already loaded the app". Returning users say it is no faster the second day than the first.',
    metrics: [
      { label: 'LCP', value: '5.1s', status: 'bad' },
      { label: 'INP', value: '210ms', status: 'warn' },
      { label: 'CLS', value: '0.04', status: 'ok' },
      { label: 'TTI', value: '8.2s', status: 'bad' },
    ],
    findings: [
      'Single JS bundle, 1.4 MB — TTI is 8.2s on a mid-range Android device',
      'Charting library is 480 KB and is bundled into every route; one page uses it',
      'Every asset is served with Cache-Control: no-cache — repeat visits re-download everything',
      'Three third-party origins (fonts, analytics, support widget) each add ~600ms of DNS + TLS',
      'Navigating between routes refetches data the app already had',
      'Images and fonts are already optimised, server TTFB is 180ms',
    ],
    answerKey: {
      strong: ['js-split', 'js-dynamic-import', 'cache-headers', 'net-preconnect', 'cache-sw', 'net-prefetch', 'js-treeshake'],
      weak: ['img-compress', 'rn-virtualize', 'be-nplusone', 'img-dimensions', 'rn-transform-opacity'],
      argument:
        'The widest field of the game — most bundle and caching cards are genuinely playable, so judge on the argument rather than the category. The three separate complaints map to three separate fixes: splitting fixes first load, cache headers fix the second visit, prefetch/service-worker fix navigation. Cache-Control: no-cache on everything is the most embarrassing line in the findings and someone should say so out loud.',
    },
  },

  {
    id: 'trap-round',
    title: 'The one that looks obvious',
    tagline: 'Final round. Read every line before you play.',
    context:
      'A content site that a previous team already spent a quarter optimising. It is on HTTP/3 behind a CDN, Brotli is on, assets are content-hashed with long cache lifetimes, and the JS is split into 42 route-level chunks. It is still slow. A senior engineer in the room has proposed bundling those 42 chunks back into one file to "cut the request count".',
    metrics: [
      { label: 'LCP', value: '3.1s', status: 'bad' },
      { label: 'INP', value: '90ms', status: 'ok' },
      { label: 'CLS', value: '0.01', status: 'ok' },
      { label: 'TTFB', value: '140ms', status: 'ok' },
    ],
    findings: [
      'HTTP/3, CDN, Brotli, content-hashed filenames with immutable cache headers — all already in place',
      '42 JS chunks, total 180 KB gzipped, all loaded over one multiplexed connection',
      'Waterfall, sorted by size: the site logo is a 1.1 MB PNG, loaded in the header on every page',
      'The logo renders at 140×40 and is the largest contentful paint element on most pages',
      'Second-largest asset is a 96 KB chunk. Everything else is under 20 KB',
      'No layout shift, no long tasks, no slow queries',
    ],
    answerKey: {
      strong: ['img-compress', 'img-webp'],
      weak: ['net-concat', 'net-http2', 'net-brotli', 'cache-headers', 'js-split', 'net-cdn', 'cache-sw'],
      argument:
        'The whole round is a trap. net-concat is the bait and it is wrong twice over: HTTP/3 multiplexing already removed the per-request cost that made bundling worthwhile, and merging content-hashed chunks destroys caching granularity so one small change invalidates all 180 KB. Every other infrastructure card is already applied. The actual answer is sitting in plain sight in the waterfall — a 1.1 MB PNG being displayed at 140×40, which is also the LCP element. Award the point to whoever ignores the senior engineer and reads the waterfall. If nobody does, that is the best possible ending to the session.',
    },
  },
];

const SCENARIOS_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

module.exports = { SCENARIOS, SCENARIOS_BY_ID };
