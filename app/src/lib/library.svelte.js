// The library's navigation state. The breadcrumb IS the stack — there is no second source of
// truth, which is also what makes browser back/forward correct for free.
//
// Node shapes:
//   { kind: 'start' }
//   { kind: 'route',   route: 'dict'|'themes'|'profiles'|'books', letter?: 'B' }
//   { kind: 'search',  q: 'revelation' }
//   { kind: 'hub',     book: 'Rev' }
//   { kind: 'article', id: 'Beast', title: 'Beast' }
//   { kind: 'passage', pkind: 'theme'|'profile', title: 'Holy War', book: 'Deut' }

import { displayTitle } from './titles.js';
import { bookName } from './refs.js';

// Breadcrumb slots before the middle is truncated. Ours, not the data's — a tunable.
export const MAX_CRUMBS = 6;

const ROUTE_NAMES = { dict: 'Dictionary', themes: 'Themes', profiles: 'Profiles', books: 'Books' };

export const lib = $state({
  stack: [{ kind: 'start' }],
  crumbsOpen: false,   // the "…" expander
  mapOpen: false,      // the path-map overlay
  visited: 0,          // articles opened this session
  deepest: 0,          // longest article chain reached
});

export function nodeLabel(n) {
  if (n.kind === 'start') return 'Start';
  if (n.kind === 'route') return ROUTE_NAMES[n.route] + (n.letter ? ` · ${n.letter}` : '');
  if (n.kind === 'search') return `“${n.q}”`;
  if (n.kind === 'hub') return bookName(n.book);
  return displayTitle(n.title);   // 'article' and 'passage' both carry a title
}

export function articleDepth(stack) {
  return stack.filter((n) => n.kind === 'article').length;
}

export function pushNode(node) {
  lib.stack.push(node);
  lib.crumbsOpen = false;          // a new step re-collapses the trail
  lib.mapOpen = false;
  if (node.kind === 'article') lib.visited += 1;
  lib.deepest = Math.max(lib.deepest, articleDepth(lib.stack));
}

export function truncateTo(i) {
  lib.stack = lib.stack.slice(0, i + 1);
  lib.crumbsOpen = false;
  lib.mapOpen = false;
}

// Pop the top of the stack — a search crumb dropping below the search threshold, or backing out
// via Escape. Resets crumbsOpen/mapOpen like every other stack mutation, so a pop can't leave the
// trail stuck expanded or the map stuck open.
export function popNode() {
  lib.stack.pop();
  lib.crumbsOpen = false;
  lib.mapOpen = false;
}

// A path-map branch: rewind to the step it hangs off, then continue from there. This keeps the
// breadcrumb a truthful account of the route taken rather than a log of every click.
export function jumpFrom(i, node) {
  lib.stack = lib.stack.slice(0, i + 1);
  pushNode(node);
}

// Replace the top of the stack — used when a search term changes or a dictionary letter is picked,
// neither of which is a new step.
export function replaceTop(node) {
  lib.stack[lib.stack.length - 1] = node;
  lib.crumbsOpen = false;
  lib.mapOpen = false;
}

export function resetLibrary() {
  lib.stack = [{ kind: 'start' }];
  lib.crumbsOpen = false;
  lib.mapOpen = false;
  lib.visited = 0;
  lib.deepest = 0;
}

// Middle truncation: the first crumb, an expander, and the last four. Start and the current
// article always survive — where you began and where you are. Each slot carries its REAL stack
// index so a click cannot be misrouted by the rendered position.
export function crumbSlots(stack, expanded) {
  const n = stack.length;
  const all = () => stack.map((node, i) => ({ i, label: nodeLabel(node) }));
  if (expanded || n <= MAX_CRUMBS) return all();
  const tail = MAX_CRUMBS - 2;
  const hidden = stack.slice(1, n - tail).map(nodeLabel);
  return [
    { i: 0, label: nodeLabel(stack[0]) },
    { ellipsis: true, hidden },
    ...Array.from({ length: tail }, (_, k) => {
      const i = n - tail + k;
      return { i, label: nodeLabel(stack[i]) };
    }),
  ];
}
