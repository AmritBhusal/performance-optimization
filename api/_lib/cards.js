// The 30 fix cards. Dealt to players at the start of the game.
// `category` drives the colour band on the card face.

const CATEGORIES = {
  images: { label: 'Images & Media', color: '#f59e0b' },
  network: { label: 'Network & Delivery', color: '#38bdf8' },
  caching: { label: 'Caching', color: '#a78bfa' },
  bundle: { label: 'JS Bundle', color: '#f472b6' },
  runtime: { label: 'JS Runtime', color: '#fb7185' },
  rendering: { label: 'Rendering', color: '#4ade80' },
  fonts: { label: 'Fonts', color: '#facc15' },
  backend: { label: 'Backend & Data', color: '#2dd4bf' },
};

const CARDS = [
  // ---- Images & Media ----
  {
    id: 'img-webp',
    category: 'images',
    title: 'Switch to WebP / AVIF',
    detail: 'Re-encode raster images into a modern format. Same visual quality, typically 25-50% fewer bytes than JPG or PNG.',
  },
  {
    id: 'img-srcset',
    category: 'images',
    title: 'Responsive images',
    detail: 'Add srcset and sizes so a phone downloads a phone-sized image instead of the desktop original.',
  },
  {
    id: 'img-lazy',
    category: 'images',
    title: 'Lazy-load below the fold',
    detail: 'loading="lazy" on off-screen images so they stop competing for bandwidth with what the user can actually see.',
  },
  {
    id: 'img-dimensions',
    category: 'images',
    title: 'Set width and height',
    detail: 'Explicit dimensions (or aspect-ratio) reserve the space before the image arrives, so nothing jumps when it does.',
  },
  {
    id: 'img-compress',
    category: 'images',
    title: 'Compress and resize assets',
    detail: 'Stop serving a 1920px original into a 360px slot. Resize to the real display size and compress to a sane quality.',
  },

  // ---- Network & Delivery ----
  {
    id: 'net-cdn',
    category: 'network',
    title: 'Put static assets on a CDN',
    detail: 'Serve images, CSS, JS and fonts from an edge node near the user instead of a single distant origin.',
  },
  {
    id: 'net-brotli',
    category: 'network',
    title: 'Enable Brotli compression',
    detail: 'Compress text assets at the server or CDN. Beats gzip on HTML, CSS, JS and JSON.',
  },
  {
    id: 'net-http2',
    category: 'network',
    title: 'Upgrade to HTTP/2 or HTTP/3',
    detail: 'Multiplex many resources over one connection, so the per-request cost that made bundling necessary mostly disappears.',
  },
  {
    id: 'net-preconnect',
    category: 'network',
    title: 'Preconnect to third-party origins',
    detail: '<link rel="preconnect"> pays the DNS, TCP and TLS cost early, so the real request starts downloading immediately.',
  },
  {
    id: 'net-concat',
    category: 'network',
    title: 'Concatenate all CSS and JS',
    detail: 'Merge many files into one bundle to cut the number of requests the browser has to make.',
    trap: true,
  },
  {
    id: 'net-prefetch',
    category: 'network',
    title: 'Prefetch the likely next route',
    detail: '<link rel="prefetch"> spends idle bandwidth now so the next navigation has nothing left to download.',
  },

  // ---- Caching ----
  {
    id: 'cache-headers',
    category: 'caching',
    title: 'Long cache lifetimes on versioned assets',
    detail: 'Cache-Control: immutable with a content hash in the filename. Repeat visitors skip the network entirely.',
  },
  {
    id: 'cache-sw',
    category: 'caching',
    title: 'Service worker, stale-while-revalidate',
    detail: 'Serve the cached copy instantly, refresh it in the background. Removes the network from the critical path.',
  },
  {
    id: 'cache-server',
    category: 'caching',
    title: 'Server-side cache (Redis / Memcached)',
    detail: 'Hold expensive query results and rendered output in memory so identical requests stop redoing the work.',
  },

  // ---- JS Bundle ----
  {
    id: 'js-split',
    category: 'bundle',
    title: 'Route-based code splitting',
    detail: 'Break one bundle into per-route chunks so users never download code for pages they do not visit.',
  },
  {
    id: 'js-dynamic-import',
    category: 'bundle',
    title: 'Dynamic-import on interaction',
    detail: 'Load the heavy library (chart, editor, chat widget) at the moment it is opened, not during first load.',
  },
  {
    id: 'js-treeshake',
    category: 'bundle',
    title: 'Tree shaking and dependency audit',
    detail: 'Drop unused exports, dead polyfills and libraries bundled twice. Ship only what is actually imported.',
  },
  {
    id: 'js-preload',
    category: 'bundle',
    title: 'Preload the critical resource',
    detail: '<link rel="preload"> tells the browser to start fetching something it would otherwise discover late.',
    trap: true,
  },
  {
    id: 'js-memleak',
    category: 'bundle',
    title: 'Fix the memory leaks',
    detail: 'Clean up listeners, timers, observers and subscriptions so long sessions stop getting progressively slower.',
  },

  // ---- JS Runtime ----
  {
    id: 'rt-debounce',
    category: 'runtime',
    title: 'Debounce / throttle handlers',
    detail: 'Stop running work on every scroll, resize and keystroke. Wait for a pause, or cap the rate.',
  },
  {
    id: 'rt-worker',
    category: 'runtime',
    title: 'Move computation to a Web Worker',
    detail: 'Run the expensive calculation on a background thread so the main thread stays free to respond to input.',
  },
  {
    id: 'rt-delegation',
    category: 'runtime',
    title: 'Event delegation',
    detail: 'One listener on the parent instead of thousands on children. Less memory, less setup cost per row.',
  },

  // ---- Rendering ----
  {
    id: 'rn-virtualize',
    category: 'rendering',
    title: 'Virtualize long lists',
    detail: 'Render only the rows in the viewport. A 12,000-row table becomes 30 DOM nodes instead of 12,000.',
  },
  {
    id: 'rn-critical-css',
    category: 'rendering',
    title: 'Inline critical CSS',
    detail: 'Inline what the first screen needs, load the rest asynchronously, so nothing blocks the first paint.',
  },
  {
    id: 'rn-defer',
    category: 'rendering',
    title: 'defer / async your scripts',
    detail: 'Stop synchronous scripts in <head> from holding the parser hostage while they download and execute.',
  },
  {
    id: 'rn-transform-opacity',
    category: 'rendering',
    title: 'Animate transform and opacity only',
    detail: 'Avoid animating width, top or box-shadow. Those trigger layout and paint on every frame; transform does not.',
  },
  {
    id: 'rn-dom-size',
    category: 'rendering',
    title: 'Cut DOM size, batch reads and writes',
    detail: 'Fewer nodes means cheaper style and layout. Batch DOM reads before writes so layout is not recalculated in a loop.',
  },

  // ---- Fonts ----
  {
    id: 'font-subset',
    category: 'fonts',
    title: 'Subset fonts, cut weights, swap',
    detail: 'Ship the weights you actually use, subset to the characters you need, and font-display: swap so text is never invisible.',
  },

  // ---- Backend & Data ----
  {
    id: 'be-nplusone',
    category: 'backend',
    title: 'Kill the N+1, add the index',
    detail: 'Batch the per-row queries into one join, and index the column the slow query is filtering on.',
  },
  {
    id: 'be-paginate',
    category: 'backend',
    title: 'Paginate the API response',
    detail: 'Return a page, not the whole collection. Response size stops growing with the dataset.',
  },
];

const CARDS_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

module.exports = { CATEGORIES, CARDS, CARDS_BY_ID };
