<script>
  import { getBookHub } from '../../lib/db.js';
  import { pushNode } from '../../lib/library.svelte.js';
  import { goToPassage } from '../../lib/study.svelte.js';
  import { go } from '../../lib/router.svelte.js';
  import { bookName } from '../../lib/refs.js';
  import { parseArticleBlocks, articlePreview } from '../../lib/display.js';
  import { displayTitle } from '../../lib/titles.js';

  import { TYNDALE_STUDY_NOTES as NOTE_SRC } from '../../lib/sources.js';
  const INTRO_CLAMP = 280;

  // Same overclaim Task 13 already fixed for search (see SearchSurface's own countLabel): "· 12"
  // reads as a total in the exact same grammar as the true totals beside it (themes, profiles),
  // but it's dict_articles.n LIMIT 12 — Revelation actually has 263 citing articles, Genesis 874.
  // "12+" only renders when the cap genuinely cut rows; a book with fewer than 12 (3 John: 9) gets
  // its real, untruncated count.
  const countLabel = (n, truncated) => (truncated ? `${n}+` : n);

  let { book } = $props();
  let hub = $derived(getBookHub(book));
  let introOpen = $state(false);
  $effect(() => { book; introOpen = false; });

  function openInStudy() {
    goToPassage({ book, chapter: 1, verse: null });
    go('study');
  }

  // Matches PassageIndex's own openPassage exactly — the node shape four producers (PassageIndex,
  // SearchSurface, a restored URL, and now this hub) all have to agree on. `book` comes from this
  // component's own prop, not the query: getBookHub's passages query never selects a `book` column
  // (every row it returns is already scoped to this one book by its WHERE clause).
  function openPassage(pkind, p) {
    pushNode({ kind: 'passage', pkind, title: p.title, book });
  }
</script>

<h3 class="stitle">{bookName(book)}</h3>
<div class="smeta">
  Book introduction · <button class="jump" onclick={openInStudy}>Open in Study →</button>
</div>

<!-- the summary arrives as Purpose/Author/Date/Setting heading blocks -->
{#each parseArticleBlocks(hub.summary) as b}
  {#if b.kind === 'head'}
    <div class="fieldk">{b.text}</div>
  {:else}
    <div class="fieldv">{b.text}</div>
  {/if}
{/each}

{#if hub.intro}
  <div class="sec">
    <div class="hl">The full introduction</div>
    {#if introOpen}
      <!-- expanded: the intro carries its own head/item/para structure (Setting, Summary, …),
           same as a dictionary article body — render it the same way, not as raw source. -->
      {#each parseArticleBlocks(hub.intro) as b}
        {#if b.kind === 'head'}
          <div class="ihead">{b.text}</div>
        {:else if b.kind === 'item'}
          <p class="iitem">{b.text}</p>
        {:else}
          <p class="prose">{b.text}</p>
        {/if}
      {/each}
    {:else}
      <p class="prose">{articlePreview(hub.intro, INTRO_CLAMP)}</p>
    {/if}
    <button class="seemore" onclick={() => (introOpen = !introOpen)}>
      {introOpen ? 'Read less' : 'Read more'}
    </button>
  </div>
{/if}

<div class="sec">
  <div class="hl">Themes anchored here · {hub.themes.length}</div>
  {#if hub.themes.length}
    <div class="chips">
      {#each hub.themes as t (t.title)}
        <button class="chip act" onclick={() => openPassage('theme', t)}>{t.title}<span class="r">{t.ref}</span></button>
      {/each}
    </div>
  {:else}<p class="none">None.</p>{/if}
</div>

<div class="sec">
  <div class="hl">Profiles anchored here · {hub.profiles.length}</div>
  {#if hub.profiles.length}
    <div class="chips">
      {#each hub.profiles as p (p.title)}
        <button class="chip act" onclick={() => openPassage('profile', p)}>{p.title}<span class="r">{p.ref}</span></button>
      {/each}
    </div>
  {:else}<p class="none">None.</p>{/if}
</div>

<div class="sec">
  <div class="hl">Dictionary articles citing this book most · {countLabel(hub.articles.length, hub.articlesTruncated)}</div>
  <div class="chips">
    {#each hub.articles as a (a.id)}
      <button class="chip act" onclick={() => pushNode({ kind: 'article', id: a.id, title: a.title })}>
        {displayTitle(a.title)}<span class="n">{a.n}</span>
      </button>
    {/each}
  </div>
  <p class="note">
    Ranked by how many verses of {bookName(book)} each article cites — straight from
    <code>dict_verse</code>, not a hand-made list.
  </p>
</div>

<div class="src"><div class="srclbl">Source</div>{NOTE_SRC}</div>

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .jump { background: none; border: none; padding: 0; font-family: inherit; font-size: 11.5px;
    color: var(--a); cursor: pointer; }
  .jump:hover { text-decoration: underline; }
  .fieldk { font-size: 11px; color: var(--b); font-variant: small-caps; letter-spacing: .06em; margin-top: 9px; }
  .fieldv { font-size: 13.5px; line-height: 1.6; max-width: 74ch; }
  .sec { margin-top: 24px; padding-top: 13px; border-top: 1px solid var(--rule); }
  .hl { font-variant: small-caps; letter-spacing: .06em; font-size: 11px; color: var(--dim); margin-bottom: 8px; }
  .prose { font-size: 13.5px; line-height: 1.7; max-width: 74ch; margin: 0 0 11px; white-space: pre-wrap; }
  .ihead { margin: 14px 0 5px; font-size: 12px; font-weight: 600; color: var(--b);
    font-variant: small-caps; letter-spacing: .06em; }
  .ihead:first-child { margin-top: 0; }
  .iitem { margin: 0 0 5px; padding-left: 12px; font-size: 13.5px; line-height: 1.6; color: var(--ink); }
  .seemore { background: none; border: none; padding: 2px 0 0; font-family: inherit; font-size: 11px;
    color: var(--a); cursor: pointer; display: block; }
  .seemore:hover { text-decoration: underline; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { background: transparent; border: 1px solid var(--rule); border-radius: 5px; padding: 4px 9px;
    font-family: inherit; font-size: 12px; color: var(--ink); text-align: left; }
  .chip.act { cursor: pointer; }
  .chip.act:hover { border-color: var(--a); }
  .chip .r { color: var(--b); font-size: 10px; margin-left: 5px; }
  .chip .n { color: var(--dim); font-size: 10px; margin-left: 5px; }
  .none { font-size: 12px; color: var(--dim); font-style: italic; margin: 0; }
  .note { font-size: 11px; color: var(--dim); line-height: 1.55; margin-top: 8px; font-style: italic; max-width: 74ch; }
  .src { margin-top: 24px; padding-top: 11px; border-top: 1px solid var(--rule); font-size: 11px;
    line-height: 1.5; color: var(--dim); }
  .srclbl { font-variant: small-caps; letter-spacing: .05em; }
</style>
