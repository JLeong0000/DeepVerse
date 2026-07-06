// build/lib/gloss.mjs
const LEADING = /^(the|a|an|of|to|and|in|\[the\]|\[a\])\s+/i;
export function normalizeGloss(s) {
  let g = String(s || '').toLowerCase().replace(/[\[\]]/g, '').trim();
  g = g.replace(/[.,;:!?"'’)(]+$/g, '').replace(/^[.,;:!?"'’)(]+/g, '').trim();
  while (LEADING.test(g)) g = g.replace(LEADING, '').trim();
  return g.replace(/[.,;:!?"'’)(]+$/g, '').trim();
}
