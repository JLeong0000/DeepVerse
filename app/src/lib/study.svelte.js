// Shared Study-mode state: current passage + selected verse + optionally a tapped word.
// Reader and Workbench both read/drive this.
export const study = $state({
  version: 'NIV',
  book: 'John',
  chapter: 12,
  verse: null,   // selected verse number (drives the workbench)
  word: null,    // optionally a tapped interlinear word { position, strongs, ... }
});

export function selectVerse(v) { study.verse = v; study.word = null; }
export function selectWord(w) { study.word = w; }
export function setVersion(v) { study.version = v; }
export function goToPassage({ version, book, chapter, verse = null }) {
  if (version) study.version = version;
  study.book = book;
  study.chapter = chapter;
  study.verse = verse;
  study.word = null;
}
