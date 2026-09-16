// Shared DOM helpers and the pieces every view draws: fix cards, the
// scenario briefing, the leaderboard.
//
// Card and scenario content is never bundled into the client — it arrives
// in the API payload, so the answer keys stay on the server.

export const CATEGORY_COLORS = {
  images: '#f59e0b',
  network: '#38bdf8',
  caching: '#a78bfa',
  bundle: '#f472b6',
  runtime: '#fb7185',
  rendering: '#4ade80',
  fonts: '#facc15',
  backend: '#2dd4bf',
};

export const CATEGORY_LABELS = {
  images: 'Images & Media',
  network: 'Network & Delivery',
  caching: 'Caching',
  bundle: 'JS Bundle',
  runtime: 'JS Runtime',
  rendering: 'Rendering',
  fonts: 'Fonts',
  backend: 'Backend & Data',
};

export function el(tag, props, children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const child of [].concat(children || [])) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

/** One fix card. `opts.onClick` makes it selectable, `opts.state` styles it. */
export function fixCard(card, opts) {
  const o = opts || {};
  const node = el(
    'button',
    {
      class: 'fix-card' + (o.state ? ' is-' + o.state : '') + (o.compact ? ' compact' : ''),
      type: 'button',
      disabled: !o.onClick,
      onclick: o.onClick,
      style: '--cat:' + (CATEGORY_COLORS[card.category] || '#94a3b8'),
    },
    [
      el('span', { class: 'fix-card-cat', text: CATEGORY_LABELS[card.category] || card.category }),
      el('span', { class: 'fix-card-title', text: card.title }),
      o.compact ? null : el('span', { class: 'fix-card-detail', text: card.detail }),
      o.footer || null,
    ],
  );
  return node;
}

/** The scenario briefing: metrics grid plus the waterfall findings. */
export function scenarioBrief(scenario, opts) {
  const o = opts || {};
  return el('div', { class: 'brief' + (o.compact ? ' compact' : '') }, [
    el('div', { class: 'brief-head' }, [
      o.round
        ? el('div', { class: 'kicker', text: 'Round ' + o.round + ' of ' + o.totalRounds })
        : null,
      el('h2', { class: 'brief-title', text: scenario.title }),
      el('p', { class: 'brief-tagline', text: scenario.tagline }),
      // Sits in the header, not after the story: this is the one line
      // everyone in the room needs, and it must never fall below the fold.
      scenario.question ? el('p', { class: 'brief-question', text: scenario.question }) : null,
    ]),
    el(
      'div',
      { class: 'metrics' },
      scenario.metrics.map((m) =>
        el('div', { class: 'metric is-' + m.status }, [
          el('span', { class: 'metric-label', text: m.label }),
          el('span', { class: 'metric-value', text: m.value }),
        ]),
      ),
    ),
    el(
      'div',
      { class: 'brief-context' },
      [].concat(scenario.context || []).map((para) => el('p', { text: para })),
    ),
    el('div', { class: 'findings' }, [
      el('div', { class: 'findings-head', text: 'What the numbers show' }),
      el(
        'ul',
        null,
        scenario.findings.map((f) => el('li', { text: f })),
      ),
    ]),
  ]);
}

export function leaderboard(players, opts) {
  const o = opts || {};
  return el('div', { class: 'leaderboard' }, [
    o.title ? el('div', { class: 'kicker', text: o.title }) : null,
    el(
      'ol',
      { class: 'lb-list' },
      players.map((p, i) =>
        el(
          'li',
          {
            class:
              'lb-row' +
              (o.highlightId === p.id ? ' is-me' : '') +
              (i === 0 && p.score > 0 ? ' is-lead' : ''),
          },
          [
            el('span', { class: 'lb-rank', text: String(i + 1) }),
            el('span', { class: 'lb-name', text: p.name }),
            o.showCards
              ? el('span', { class: 'lb-cards', text: p.cardsLeft + ' left' })
              : null,
            el('span', { class: 'lb-score', text: String(p.score) }),
          ],
        ),
      ),
    ),
  ]);
}

/** Player chips that light up as each person commits a card. */
export function playedStrip(players) {
  return el(
    'div',
    { class: 'played-strip' },
    players.map((p) =>
      el('span', { class: 'chip' + (p.hasPlayed ? ' is-in' : '') }, [
        el('span', { class: 'chip-dot' }),
        p.name,
      ]),
    ),
  );
}

export function emptyState(title, note) {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'empty-title', text: title }),
    note ? el('p', { class: 'empty-note', text: note }) : null,
  ]);
}
