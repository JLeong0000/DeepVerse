// Tiny reactive router. view ∈ 'home' | 'study' | 'notes'; params carries study target.
export const route = $state({ view: 'home', params: {} });

export function go(view, params = {}) {
  route.view = view;
  route.params = params;
}

// Jump into Study mode at a target position (from Resume, a note, word-of-the-day).
// `word` (optional) pre-selects an interlinear word by { position } so its detail opens.
export function openStudy({ version = 'NIV', book, chapter, verse = null, word = null } = {}) {
  go('study', { version, book, chapter, verse, word });
}
