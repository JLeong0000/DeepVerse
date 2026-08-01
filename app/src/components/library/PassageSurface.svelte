<script>
  // A theme or profile: Tyndale's own essay, anchored to a passage. Rendered through the same
  // ArticleView as a dictionary article — these are prose in the same block format. No xrefs: a
  // passage cites no other library entry, so the "See …" clause and its doors never apply here.
  import { getPassage } from '../../lib/db.js';
  import { goToPassage } from '../../lib/study.svelte.js';
  import { go } from '../../lib/router.svelte.js';
  import { bookName } from '../../lib/refs.js';
  import { lib } from '../../lib/library.svelte.js';
  import ArticleView from '../workbench/ArticleView.svelte';

  // themes and profiles ship in the study-notes package, not the dictionary
  const NOTE_SRC = 'Tyndale Open Study Notes · © 2022 Tyndale House Publishers · CC BY-SA 4.0';

  let { pkind, title } = $props();
  let passage = $derived(getPassage(pkind, title));

  // A node restored from a URL (App.svelte's applyHash) has no `book` — it isn't knowable
  // synchronously there, since applyHash can run before the db loads — while PassageIndex and
  // SearchSurface both attach it when they push the node live. Backfill it here once the row
  // loads, so a restored node ends up the same shape as a live-navigated one.
  $effect(() => {
    const n = lib.stack.at(-1);
    if (passage && n?.kind === 'passage' && n.pkind === pkind && n.title === title) n.book = passage.book;
  });

  function openInStudy() {
    // start_chapter/start_verse are the anchor — structured columns, not a re-parse of the `ref`
    // display span (which is built for reading: "7:1-6", "1:2–9:12", "17:8", never for parsing).
    goToPassage({ book: passage.book, chapter: passage.start_chapter, verse: passage.start_verse });
    go('study');
  }
</script>

{#if passage}
  <h3 class="stitle">{passage.title}</h3>
  <div class="smeta">
    {pkind === 'theme' ? 'Theme' : 'Profile'} · {bookName(passage.book)} {passage.ref} ·
    <button class="jump" onclick={openInStudy}>Open in Study →</button>
  </div>
  <div class="body">
    <ArticleView article={{ title: passage.title, body: passage.body, book: passage.book }}
      source={NOTE_SRC} onnavigate={() => go('study')} />
  </div>
{:else}
  <p class="missing">That {pkind} is not in the corpus.</p>
{/if}

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 14px; }
  .jump { background: none; border: none; padding: 0; font-family: inherit; font-size: 11.5px;
    color: var(--a); cursor: pointer; }
  .jump:hover { text-decoration: underline; }
  .body { max-width: 74ch; }
  .missing { font-size: 12px; color: var(--dim); font-style: italic; }
</style>
