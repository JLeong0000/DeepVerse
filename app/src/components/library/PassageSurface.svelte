<script>
  // A theme or profile: Tyndale's own essay, anchored to a passage. Rendered through the same
  // ArticleView as a dictionary article — these are prose in the same block format. No xrefs: a
  // passage writes no "See …" clause, so in-prose linkification never applies here. Its doors come
  // from its anchor instead — see getPassageLinks.
  import { getPassage, getPassageLinks } from '../../lib/db.js';
  import { goToPassage } from '../../lib/study.svelte.js';
  import { go } from '../../lib/router.svelte.js';
  import { bookName } from '../../lib/refs.js';
  import { displayTitle } from '../../lib/titles.js';
  import { lib, pushNode } from '../../lib/library.svelte.js';
  import ArticleView from '../workbench/ArticleView.svelte';

  // themes and profiles ship in the study-notes package, not the dictionary
  import { TYNDALE_STUDY_NOTES as NOTE_SRC } from '../../lib/sources.js';

  let { pkind, title } = $props();
  let passage = $derived(getPassage(pkind, title));
  let links = $derived(getPassageLinks(pkind, title));

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

  <div class="leads">
    <div class="ll">Where this leads</div>
    {#if links.passages.length || links.article}
      <div class="doors">
        {#each links.passages as p (p.kind + p.title)}
          <button class="door" onclick={() => pushNode({ kind: 'passage', pkind: p.kind, title: p.title, book: p.book })}>
            {p.title}<span class="tag">{p.kind === 'theme' ? 'Theme' : 'Profile'} · {p.ref}</span>
          </button>
        {/each}
        {#if links.article}
          <button class="door" onclick={() => pushNode({ kind: 'article', id: links.article.id, title: links.article.title })}>
            {displayTitle(links.article.title)}<span class="tag">Dictionary</span>
          </button>
        {/if}
      </div>
      <p class="lnote">
        Anchored, not matched: these are the other themes and profiles Tyndale placed over
        {bookName(passage.book)} {passage.ref}{links.article ? ', and the dictionary article of the same name' : ''}.
      </p>
    {:else}
      <!-- 171 of the 423 passages are anchored where nothing else is and have no same-title
           article. Tyndale writes no theme-to-theme links at all, so an empty box here is the
           corpus, not a gap in the extraction. -->
      <div class="deadend">
        A dead end — nothing else in the corpus is anchored here. Open it in Study, or search.
      </div>
    {/if}
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
  /* the doors box is ArticleSurface's, down to the wording of its label — a theme and an article
     are the same kind of destination, so they must not look like two different mechanisms */
  .leads { margin-top: 26px; padding: 14px 16px 15px; border: 1px solid var(--rule);
    border-radius: 8px; background: var(--panel); }
  .ll { font-variant: small-caps; letter-spacing: .07em; font-size: 11px; color: var(--dim); margin-bottom: 9px; }
  .doors { display: flex; flex-wrap: wrap; gap: 6px; }
  .door { background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 5px 11px;
    font-family: inherit; font-size: 12.5px; color: var(--ink); cursor: pointer; text-align: left; }
  .door:hover { border-color: var(--a); color: var(--a); }
  .tag { color: var(--dim); font-size: 10px; margin-left: 6px; }
  .lnote { font-size: 11px; color: var(--dim); line-height: 1.55; margin: 9px 0 0; font-style: italic; }
  .deadend { font-size: 12px; color: var(--dim); font-style: italic; line-height: 1.55; }
  .missing { font-size: 12px; color: var(--dim); font-style: italic; }
</style>
