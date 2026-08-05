<script>
  // Prose with its scripture references turned into jumps. Interpolation only — no {@html} — so
  // the body text can never inject markup.
  import { tokenizeRefs } from '../../lib/scripture.js';
  import { study, goToPassage } from '../../lib/study.svelte.js';
  import { verseExists } from '../../lib/db.js';
  import { bookName, isApocrypha, apocryphaHasText } from '../../lib/refs.js';

  // onnavigate lets an overlay close itself once a reference has been followed —
  // otherwise the modal stays over the verse it just sent you to.
  // `book` is what the surrounding text is ABOUT, so a book-less citation can be resolved against
  // it. Callers with no single subject (a dictionary article) pass nothing and those stay plain.
  // onref, when supplied, REPLACES the jump: the caller shows a preview in place instead. Default
  // stays the jump, so every existing call site is unchanged.
  let { text, book = null, onnavigate = null, onref = null } = $props();
  let segs = $derived(tokenizeRefs(text, { book, exists: verseExists }));

  // A reference to the verse already on screen is a link to nowhere — clicking it does nothing.
  // Render it as plain text so the underlines that remain all actually go somewhere.
  const isHere = (r) =>
    r.book === study.book && r.chapter === study.chapter && r.verse === study.verse;

  // Same rule, second case. With no `onref` the only thing a click can do is jump, and Study
  // navigates the 66 canonical books — deliberately, which is why KJVA is kept out of every
  // version-scoped list. Jumping anyway left the reader on `#/study/1Macc/1/10` with a blank pane
  // and an empty book selector: 58 citations in the study notes, themes and profiles could reach
  // it. Hosts that DO pass onref (the library's article surface) put the KJVA text or an
  // explanation in a preview instead, so there the citation stays a link.
  const isUnreachable = (r) => !onref && isApocrypha(r.book);

  // Two different reasons, and the tooltip must not blur them. 1 and 2 Maccabees, 1 Esdras and
  // eleven more ARE in the corpus, as the KJVA version — Study just doesn't navigate them. 3 and 4
  // Maccabees and the Apocalypse of Baruch are in no edition DeepVerse holds: the KJV Apocrypha,
  // our only public-domain deuterocanon, never contained them. apocryphaHasText already draws that
  // line for the reference gate; it draws it here too.
  const deadTitle = (r) => {
    if (isHere(r)) return 'You are reading this verse';
    return apocryphaHasText(r.book)
      ? `${bookName(r.book)} is in the KJV Apocrypha, which Study does not read — open it from the Library`
      : `${bookName(r.book)} is in no edition DeepVerse carries`;
  };
</script>

{#each segs as s}{#if s.ref && !isHere(s.ref) && !isUnreachable(s.ref)}<button
    class="xr"
    title="Go to {bookName(s.ref.book)} {s.ref.chapter}:{s.ref.verse}"
    onclick={() => {
      if (onref) { onref(s.ref); return; }
      goToPassage({ book: s.ref.book, chapter: s.ref.chapter, verse: s.ref.verse });
      onnavigate?.();
    }}
  >{s.text}</button>{:else if s.ref}<span class="here" title={deadTitle(s.ref)}>{s.text}</span>{:else}{s.plain}{/if}{/each}

<style>
  /* underline only, no colour block: a paragraph can hold a dozen of these and a coloured run
     every other line makes the prose harder to read than the plain text it replaced */
  .xr { background: transparent; border: none; padding: 0; margin: 0; font: inherit;
    color: inherit; cursor: pointer;
    border-bottom: 1px solid color-mix(in srgb, var(--a) 55%, transparent); }
  .xr:hover { color: var(--a); border-bottom-color: var(--a); }
  /* the verse you are already on: no underline, since there is nowhere to go */
  .here { color: inherit; }
</style>
