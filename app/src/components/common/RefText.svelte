<script>
  // Prose with its scripture references turned into jumps. Interpolation only — no {@html} — so
  // the body text can never inject markup.
  import { tokenizeRefs } from '../../lib/scripture.js';
  import { goToPassage } from '../../lib/study.svelte.js';
  import { bookName } from '../../lib/refs.js';

  // onnavigate lets an overlay close itself once a reference has been followed —
  // otherwise the modal stays over the verse it just sent you to.
  let { text, onnavigate = null } = $props();
  let segs = $derived(tokenizeRefs(text));
</script>

{#each segs as s}{#if s.ref}<button
    class="xr"
    title="Go to {bookName(s.ref.book)} {s.ref.chapter}:{s.ref.verse}"
    onclick={() => { goToPassage({ book: s.ref.book, chapter: s.ref.chapter, verse: s.ref.verse }); onnavigate?.(); }}
  >{s.text}</button>{:else}{s.plain}{/if}{/each}

<style>
  /* underline only, no colour block: a paragraph can hold a dozen of these and a coloured run
     every other line makes the prose harder to read than the plain text it replaced */
  .xr { background: transparent; border: none; padding: 0; margin: 0; font: inherit;
    color: inherit; cursor: pointer;
    border-bottom: 1px solid color-mix(in srgb, var(--a) 55%, transparent); }
  .xr:hover { color: var(--a); border-bottom-color: var(--a); }
</style>
