// Shared Study-mode state: current passage + selected verse + optionally a tapped word.
// Reader and Workbench both read/drive this.
export const study = $state({
  version: 'NIV',
  book: 'John',
  chapter: 12,
  verse: null,     // anchor of the selection (drives the workbench cards)
  verseEnd: null,  // end of a multi-verse range selection (null = single verse)
  word: null,      // a tapped/clicked word { position?, strongs, original, translit, ... }
});

// select a verse; extend=true (shift-click) grows the selection into a range from the anchor.
export function selectVerse(v, extend = false) {
  if (extend && study.verse != null) { study.verseEnd = v; }
  else { study.verse = v; study.verseEnd = null; }
  study.word = null;
}
export function selectWord(w) { study.word = w; }
export function setVersion(v) { study.version = v; }
export function goToPassage({ version, book, chapter, verse = null }) {
  if (version) study.version = version;
  study.book = book;
  study.chapter = chapter;
  study.verse = verse;
  study.verseEnd = null;
  study.word = null;
}

// normalized [low, high] of the current selection (null if no verse selected)
export function selectedRange() {
  if (study.verse == null) return null;
  const end = study.verseEnd ?? study.verse;
  return [Math.min(study.verse, end), Math.max(study.verse, end)];
}
