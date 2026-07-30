<script>
  // Prose with its scripture references turned into jumps. Interpolation only — no {@html} — so
  // the body text can never inject markup.
  import { tokenizeRefs } from '../../lib/scripture.js';
  import { study, goToPassage } from '../../lib/study.svelte.js';
  import { bookName } from '../../lib/refs.js';

  // onnavigate lets an overlay close itself once a reference has been followed —
  // otherwise the modal stays over the verse it just sent you to.
  let { text, onnavigate = null } = $props();
  let segs = $derived(tokenizeRefs(text));

  // A reference to the verse already on screen is a link to nowhere — clicking it does nothing.
  // Render it as plain text so the underlines that remain all actually go somewhere.
  const isHere = (r) =>
    r.book === study.book && r.chapter === study.chapter && r.verse === study.verse;
</script>

{#each segs as s}{#if s.ref && !isHere(s.ref)}<button
    class="xr"
    title="Go to {bookName(s.ref.book)} {s.ref.chapter}:{s.ref.verse}"
    onclick={() => { goToPassage({ book: s.ref.book, chapter: s.ref.chapter, verse: s.ref.verse }); onnavigate?.(); }}
  >{s.text}</button>{:else if s.ref}<span class="here" title="You are reading this verse">{s.text}</span>{:else}{s.plain}{/if}{/each}

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
