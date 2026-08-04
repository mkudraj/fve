/**
 * DOM snapshot capture — inspects the FACEIT accept/match screen for player
 * cards and extracts sanitized card attributes useful for building a content
 * script. Never stores cookies, tokens, or session data.
 */
import CDP from "chrome-remote-interface";
import type { DomSnapshot, DomPlayerCard } from "../types/index.js";

// A conservative list of selectors that commonly match player cards on
// FACEIT. The injected script also falls back to a generic "avatar with
// nickname + link to /en/players/" heuristic.
const PLAYER_CARD_SELECTORS = [
  "[data-player-id]",
  "[data-player-nickname]",
  "[data-testid*='player']",
  "[data-testid*='Player']",
  "[data-testid*='accept']",
  "[data-testid*='match']",
  "a[href*='/en/players/']",
];

const EVAL_HELPER = `
(function () {
  const selectors = ${JSON.stringify(PLAYER_CARD_SELECTORS)};
  const usedSelectors = [];
  const seen = new Set();
  const cards = [];

  const buildParentChain = (el) => {
    const chain = [];
    let cur = el;
    for (let i = 0; i < 5 && cur && cur !== document.body; i++) {
      let desc = cur.tagName ? cur.tagName.toLowerCase() : "";
      if (cur.id) desc += '#' + cur.id;
      if (cur.className && typeof cur.className === 'string') {
        const cls = cur.className.split(/\\s+/).filter(Boolean).slice(0, 3).join('.');
        if (cls) desc += '.' + cls;
      }
      chain.push(desc);
      cur = cur.parentElement;
    }
    return chain;
  };

  const attr = (el, name) => {
    const v = el.getAttribute(name);
    return v ? v : null;
  };

  const pick = (el) => {
    const img = el.querySelector('img');
    return {
      nickname: attr(el, 'data-player-nickname')
        || attr(el, 'data-nickname')
        || (el.textContent ? el.textContent.trim().split(/\\s+/)[0] : ''),
      profileHref: attr(el, 'href') || null,
      dataTestId: attr(el, 'data-testid'),
      dataPlayerId: attr(el, 'data-player-id'),
      dataId: attr(el, 'data-id'),
      ariaLabel: attr(el, 'aria-label'),
      imgAlt: img ? attr(img, 'alt') : null,
      imgSrc: img ? attr(img, 'src') : null,
      parentChain: buildParentChain(el),
    };
  };

  for (const sel of selectors) {
    let nodes;
    try {
      nodes = document.querySelectorAll(sel);
    } catch (e) {
      continue;
    }
    if (nodes.length === 0) continue;
    usedSelectors.push(sel);
    for (const el of nodes) {
      if (el.tagName === 'A') {
        const key = attr(el, 'href') || attr(el, 'data-testid') || el.textContent;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        cards.push(pick(el));
      }
    }
  }

  // If nothing matched, use the generic player link heuristic.
  if (cards.length === 0) {
    const links = document.querySelectorAll("a[href*='/en/players/']");
    usedSelectors.push("a[href*='/en/players/']");
    for (const a of links) {
      const href = attr(a, 'href');
      if (!href || seen.has(href)) continue;
      seen.add(href);
      cards.push(pick(a));
    }
  }

  return { usedSelectors, cards: cards.slice(0, 50) };
})()
`;

export async function captureDomSnapshot(
  client: CDP.Client,
  url: string,
  markerKey: string | null,
): Promise<DomSnapshot> {
  const result = await client.Runtime.evaluate({
    expression: EVAL_HELPER,
    returnByValue: true,
  });

  const value = (result.result?.value ?? {
    usedSelectors: [],
    cards: [],
  }) as {
    usedSelectors: string[];
    cards: DomPlayerCard[];
  };

  // Cap the parent chain and drop any accidental long strings.
  const cards = value.cards.map((c) => ({
    ...c,
    nickname: (c.nickname || "").substring(0, 64),
    profileHref: c.profileHref ? c.profileHref.substring(0, 256) : null,
    imgSrc: c.imgSrc ? c.imgSrc.substring(0, 256) : null,
    parentChain: c.parentChain.slice(0, 5),
  }));

  return {
    capturedAt: new Date().toISOString(),
    markerKey,
    url,
    playerCards: cards,
    usedSelectors: value.usedSelectors,
  };
}
