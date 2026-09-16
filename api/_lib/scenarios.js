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
      'A news website is read by around 40,000 people every day. About 90% of readers use a phone and mobile data, often on a busy 3G connection while travelling to work.',
      'The homepage has a single-column layout. It starts with one large photo for the main story, followed by 18 smaller news stories.',
      'Readers are complaining about two things. First, after tapping the link, the screen stays blank for several seconds. Some readers give up and close the page before it appears. Second, once the content appears, the page suddenly moves. A reader may try to tap a headline, but the page shifts underneath their finger and they end up opening the wrong story.',
    ],
    question:
      'You can make only one improvement to this page this week. Which card or cards would you choose first, and what evidence from the situation supports your choice?',
    metrics: [
      { label: 'LCP', value: '6.8s', status: 'bad' },
      { label: 'INP', value: '180ms', status: 'ok' },
      { label: 'CLS', value: '0.31', status: 'bad' },
      { label: 'TTFB', value: '380ms', status: 'ok' },
    ],
    findings: [
      'The large photo at the top of the page is 2.4 MB and 1920 pixels wide. Most phones loading the page have screens around 360 pixels wide.',
      'There are 18 smaller photos further down the page. All of them start downloading as soon as the page opens, even though the reader may never scroll down to them.',
      'The browser is not given any information about how much space the images will need before they finish loading.',
      'The JavaScript file is 210 KB, and a typical phone spends about 340ms processing it.',
      'All files are served from one server in Singapore, while nearly all readers are located in Kathmandu.',
      'Text files are already compressed before being sent, and the server already uses HTTP/2.',
    ],
    answerKey: {
      strong: [
        'img-compress',
        'img-srcset',
        'img-webp',
        'img-dimensions',
        'img-lazy',
        'net-cdn',
      ],
      weak: [
        'rt-worker',
        'rn-virtualize',
        'be-nplusone',
        'rt-delegation',
        'net-brotli',
        'net-http2',
      ],
      argument:
        'LCP and CLS are both bad, while INP and TTFB are fine. This points to an image-related problem rather than a JavaScript or server problem. The largest issue is the 2.4 MB hero image; simply serving it at a more appropriate size could significantly reduce LCP. The page jumping is a separate problem caused by the browser not knowing the image dimensions in advance. A strong answer should explain which user complaint their chosen card addresses. Brotli and HTTP/2 are already enabled, so those cards do not address a missing fix.',
    },
  },

  {
    id: 'admin-table',
    title: 'Internal admin dashboard',
    tagline: 'Twelve people, second monitor, nine to six every day',
    context: [
      'An operations team of 12 people uses an internal dashboard to handle refunds and cancellations. The dashboard stays open on their second monitor from 9 AM to 6 PM. They use ordinary desktop computers connected to office Wi-Fi.',
      'The main page displays every order in the system in one long table, with a search box at the top.',
      'The company processed twice as many orders last month, but the dashboard itself was not changed. The team now says the page feels like it is fighting against them. Opening the page is still fine, but using it is frustrating. Clicking a row takes a noticeable amount of time to respond, and typing in the search box causes letters to disappear. For example, they may type eight characters but only six appear.',
    ],
    question:
      'The team estimates that these slow interactions are costing them about an hour of work every day. Which card or cards would you choose to address the main cause of the problem, and why?',
    metrics: [
      { label: 'LCP', value: '1.9s', status: 'ok' },
      { label: 'INP', value: '740ms', status: 'bad' },
      { label: 'CLS', value: '0.00', status: 'ok' },
      { label: 'TTFB', value: '210ms', status: 'ok' },
    ],
    findings: [
      'The table displays all 12,400 orders at once, creating around 38,000 elements on the page.',
      'While the table is being created, the browser is busy for 900ms without a break. During that time, it cannot respond to user interactions.',
      'Each of the 12,400 rows creates its own click handler.',
      'The search box filters and redraws the entire table every time the user types a character.',
      'The server sends all the data in about 180ms.',
      'The files are already served through a CDN, compressed, and cached.',
    ],
    answerKey: {
      strong: [
        'rn-virtualize',
        'rt-debounce',
        'rt-delegation',
        'be-paginate',
        'rn-dom-size',
      ],
      weak: [
        'img-webp',
        'net-cdn',
        'net-preconnect',
        'net-brotli',
        'cache-headers',
        'img-lazy',
      ],
      argument:
        'LCP is good, but INP is very poor. The data reaches the browser in only 180ms, so the network is not the main problem. The browser is spending too much time creating and managing the large table. Virtualization addresses several causes at once by reducing the number of rows and elements that need to exist on the page. Debouncing the search and using event delegation are also relevant, but address narrower parts of the problem. Network-related cards do not address the evidence shown here.',
    },
  },

  {
    id: 'saas-landing',
    title: 'SaaS landing page',
    tagline: 'Paid traffic, every device, and two years of additions',
    context: [
      'This is the main landing page for a company’s paid advertising campaigns. Over the last two years, the marketing team has added a testimonial carousel, a cookie banner, a live chat widget, and three tracking scripts. Nothing has been removed during that time.',
      'Visitors arrive from advertisements using many different devices and internet connections. The page looks mostly ready within a couple of seconds.',
      'However, partway through loading, the page suddenly moves downward. Someone who is about to click the signup button may end up clicking something else because the page shifts underneath them. Since the last redesign, more visitors are leaving without clicking anything, and the advertising team wants to know whether the page is contributing to this problem.',
    ],
    question:
      'You need to make one improvement before the next advertising campaign. Which card or cards would you choose based on the evidence above, and what problem would each choice address?',
    metrics: [
      { label: 'LCP', value: '4.2s', status: 'bad' },
      { label: 'INP', value: '150ms', status: 'ok' },
      { label: 'CLS', value: '0.24', status: 'bad' },
      { label: 'TTFB', value: '290ms', status: 'ok' },
    ],
    findings: [
      'Of all the CSS downloaded by the page, 71% is never used. Of the JavaScript downloaded, 64% is never used.',
      'Three stylesheets and one script are loaded at the top of the page. The browser does not draw anything until all of them have finished downloading.',
      'The page loads nine font files totaling 320 KB. Six of these files are different weights of the same typeface.',
      'The chat widget downloads 340 KB for every visitor, even though only about 2 out of every 100 visitors actually open it.',
      'The cookie banner appears about 1.2 seconds after the page starts loading and pushes the content below it further down the screen.',
      'The images are already correctly sized and already use a modern image format.',
    ],
    answerKey: {
      strong: [
        'rn-critical-css',
        'rn-defer',
        'js-dynamic-import',
        'font-subset',
        'js-treeshake',
        'img-dimensions',
      ],
      weak: [
        'rn-virtualize',
        'rt-worker',
        'be-nplusone',
        'img-webp',
        'img-compress',
        'rt-delegation',
      ],
      argument:
        'This round is mainly about reducing unnecessary work and resources. The blocking resources at the top of the page delay the first visible content, while the chat widget is a large download that very few visitors actually use. The cookie banner is responsible for the visible page movement and the resulting misclicks. Reserving space for the banner can also be argued for if the player explains the connection clearly. Preloading the font files would not solve the underlying problem and could make the page compete for resources even more.',
    },
  },

  {
    id: 'ecommerce-ttfb',
    title: 'Online shop, category page',
    tagline: 'Slow for everyone, everywhere, every single visit',
    context: [
      'An online shop has a category page that displays 24 products at a time. It is an important page because most customers visit it before deciding what to buy.',
      'The page is slow for everyone. It is slow on a fast office connection, on a phone in another country, on a first visit, and even when someone has visited the page many times before. Customers describe the experience the same way: they click a category and then nothing appears to happen for several seconds. The previous page remains visible, and then the new page suddenly appears all at once.',
      'The problem becomes much worse during a sale when many customers arrive at the same time. During the last festival sale, the page stopped responding completely for about 20 minutes during the busiest part of the event.',
    ],
    question:
      'The next major sale is in three weeks. Which card or cards would you choose first to address the main cause of the delay and prevent the same problem during the sale?',
    metrics: [
      { label: 'LCP', value: '3.4s', status: 'bad' },
      { label: 'INP', value: '120ms', status: 'ok' },
      { label: 'CLS', value: '0.02', status: 'ok' },
      { label: 'TTFB', value: '2.1s', status: 'bad' },
    ],
    findings: [
      'The browser waits 2.1 seconds before the server sends anything back.',
      'Generating one page requires 84 separate database queries.',
      'The server first asks the database for the product list and then makes another query for each product to check whether it is in stock.',
      'The server generates the page from scratch for every visitor, even though every visitor receives the same result.',
      'The server sends all 2,400 products to the browser, even though the page displays only 24 of them.',
      'The JavaScript file is 90 KB, and the images are already optimized.',
    ],
    answerKey: {
      strong: ['be-nplusone', 'cache-server', 'be-paginate'],
      weak: [
        'img-lazy',
        'img-webp',
        'font-subset',
        'rt-worker',
        'rn-virtualize',
        'net-preconnect',
      ],
      argument:
        'TTFB is 2.1 seconds, meaning the browser waits more than two seconds before receiving the initial response. The evidence points to work happening on the server rather than a problem with the browser or network. The repeated stock queries are an N+1 problem, server-side caching can avoid repeating identical work, and pagination prevents the response from growing with the full product collection. The sale-time failure is consistent with the same server-side workload becoming much heavier under high traffic. Browser caching cards would mainly help repeat requests and do not address the slow initial server response shown here.',
    },
  },

  {
    id: 'react-spa',
    title: 'Logged-in dashboard',
    tagline: 'Four thousand users, four continents, mostly mid-range phones',
    context: [
      'A dashboard is used by around 4,000 people across four continents. Many users access it from mid-range Android phones, while others use office laptops.',
      'Support receives two separate complaints. First, opening the application takes a long time. Users tap the app, see a blank white screen, and have to wait. Second, once the application is open, moving between pages inside it is still slow. This is confusing to users because they feel that the application should already be ready.',
      'People who use the application every day have another complaint: returning to it the next day does not make it any faster. They have to wait through the same experience again.',
    ],
    question:
      'There are several complaints and they may have different causes. Select the card or cards you would use first, and explain which user complaint each choice is intended to address.',
    metrics: [
      { label: 'LCP', value: '5.1s', status: 'bad' },
      { label: 'INP', value: '210ms', status: 'warn' },
      { label: 'CLS', value: '0.04', status: 'ok' },
      { label: 'TTI', value: '8.2s', status: 'bad' },
    ],
    findings: [
      'The entire application is delivered as one 1.4 MB JavaScript file. On a mid-range Android phone, the application takes about 8.2 seconds before it can respond to taps.',
      'A charting library accounts for 480 KB of that file, even though only one page in the application uses charts.',
      'Every file is sent with instructions that prevent the browser from keeping a copy. As a result, returning users download all of the files again.',
      'Fonts, analytics, and a support widget are provided by three different companies. Setting up each connection takes about 600ms.',
      'When users move between pages, the application requests data that it had already fetched moments earlier.',
      'The images and fonts are already optimized, and the server responds in about 180ms.',
    ],
    answerKey: {
      strong: [
        'js-split',
        'js-dynamic-import',
        'cache-headers',
        'net-preconnect',
        'cache-sw',
        'net-prefetch',
        'js-treeshake',
      ],
      weak: [
        'img-compress',
        'rn-virtualize',
        'be-nplusone',
        'img-dimensions',
        'rn-transform-opacity',
      ],
      argument:
        'This round contains several legitimate problems, so several cards can be justified. Code splitting can reduce the amount of JavaScript required for the initial load, while dynamic imports can keep the charting library out of the initial download. Cache headers address the fact that returning users have to download everything again. Prefetching or a service worker can improve navigation between pages. Preconnect can reduce the connection setup time for third-party resources. A strong answer should clearly connect each selected card to one of the complaints rather than simply selecting every bundle or caching card.',
    },
  },

  {
    id: 'trap-round',
    title: 'The one that looks obvious',
    tagline: 'Final round. Read every line before you play.',
    context: [
      'A content website has already spent three months improving its performance. The previous team made many changes, and the site is now much faster than it used to be. However, there is still room for improvement.',
      'During a meeting, the most senior engineer suggests combining the website’s 42 JavaScript files into one file. Their reasoning is that fewer files should mean fewer requests from the browser. Everyone in the meeting agrees that the idea sounds reasonable.',
      'Before making the change, the team decides to look carefully at the performance measurements and the files being downloaded.',
    ],
    question:
      'The team wants to combine the JavaScript files to reduce the number of requests. Based on all the evidence above, which card or cards would you choose instead? Explain what the actual bottleneck appears to be.',
    metrics: [
      { label: 'LCP', value: '3.1s', status: 'bad' },
      { label: 'INP', value: '90ms', status: 'ok' },
      { label: 'CLS', value: '0.01', status: 'ok' },
      { label: 'TTFB', value: '140ms', status: 'ok' },
    ],
    findings: [
      'The site already uses HTTP/3, serves files through a CDN, compresses text, and tells browsers to keep cached copies of files for a long time.',
      'There are 42 JavaScript files totaling 180 KB, and they are all delivered over a single shared connection.',
      'The largest file downloaded by the page is the site logo, which is a 1.1 MB PNG.',
      'The logo is displayed at only 140 by 40 pixels, but it is the largest visible element when the page first appears.',
      'The second-largest file is 96 KB, and every other file is smaller than 20 KB.',
      'Nothing on the page moves while it loads, no single task blocks the browser, and no database query is taking an unusually long time.',
    ],
    answerKey: {
      strong: ['img-compress', 'img-webp'],
      weak: [
        'net-concat',
        'net-http2',
        'net-brotli',
        'cache-headers',
        'js-split',
        'net-cdn',
        'cache-sw',
      ],
      argument:
        'The proposed JavaScript change is a distraction. HTTP/3 is already being used, so the site is not dealing with the older request overhead that made combining files more attractive. Combining the files would also reduce the benefits of caching individual files, because changing one small file could require the entire 180 KB bundle to be downloaded again. The largest problem is clearly visible in the findings: a 1.1 MB PNG is being displayed at only 140 by 40 pixels and is the largest element visible when the page first appears. The strongest choices therefore focus on reducing the size of that image.',
    },
  },
];

const SCENARIOS_BY_ID = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s]),
);

module.exports = { SCENARIOS, SCENARIOS_BY_ID };
