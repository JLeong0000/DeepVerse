<script>
  // An article, plus the doors out of it. "Where this leads" is what converts an article with
  // links buried in its last sentence into a junction with visible exits.
  import { getArticle, getArticleSupplements, getXrefs, getRefPreview } from '../../lib/db.js';
  import { pushNode } from '../../lib/library.svelte.js';
  import { displayTitle } from '../../lib/titles.js';
  import { goToPassage } from '../../lib/study.svelte.js';
  import { go } from '../../lib/router.svelte.js';
  import { bookName } from '../../lib/refs.js';
  import ArticleView from '../workbench/ArticleView.svelte';

  let { id } = $props();

  let article = $derived(getArticle(id));
  let supplements = $derived(getArticleSupplements(id));
  let xrefs = $derived(getXrefs(id));

  let open = $state(null);   // { ref, token }
  $effect(() => { id; open = null; });   // a new article clears any open preview
</script>

{#snippet previewSnippet()}
  {@const r = open.ref}
  <div class="prev">
    <div class="pr">{bookName(r.book)} {r.chapter}:{r.verse} · NIV</div>
    {getRefPreview(`${r.book}.${r.chapter}.${r.verse}`)}
    <button class="popen" onclick={() => { goToPassage(r); go('study'); }}>Open in Study →</button>
  </div>
{/snippet}

{#if article}
  <h3 class="stitle">{displayTitle(article.title)}</h3>
  <div class="smeta">Dictionary article · cites {article.n_refs} verses</div>

  <div class="body">
    <ArticleView {article} {supplements} {xrefs}
      onref={(ref, token) => (open = open?.token === token ? null : { ref, token })}
      openToken={open?.token ?? null}
      preview={open ? previewSnippet : null}
      onxref={(xid) => {
        const hit = xrefs.out.find((o) => o.id === xid);
        pushNode({ kind: 'article', id: xid, title: hit?.title ?? xid });
      }} />
  </div>

  <div class="leads">
    <div class="ll">Where this leads</div>
    {#if xrefs.out.length}
      <div class="doors">
        {#each xrefs.out as o (o.id)}
          <button class="door" onclick={() => pushNode({ kind: 'article', id: o.id, title: o.title })}>
            {displayTitle(o.title)}{#if o.anchor}<span class="anch">§ {o.anchor}</span>{/if}
          </button>
        {/each}
      </div>
    {:else}
      <!-- 2,652 of the 6,010 articles have no resolved outbound link; an empty box would read as a bug -->
      <div class="deadend">
        A dead end — this article names no other entry. Search, pick another route, or ✦ Wander in.
      </div>
    {/if}
    {#if xrefs.missing.length}
      <!-- 140 of the 5,236 links name an article Tyndale never wrote. Listing them is more honest
           than hiding them, and stops the graph looking more complete than it is. -->
      <div class="absent">
        Named by the source, but absent from the corpus:
        {xrefs.missing.map(displayTitle).join(', ')}.
      </div>
    {/if}
  </div>
{:else}
  <p class="deadend">That article is not in the corpus.</p>
{/if}

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 14px; }
  .body { max-width: 74ch; }
  .leads { margin-top: 26px; padding: 14px 16px 15px; border: 1px solid var(--rule);
    border-radius: 8px; background: var(--panel); }
  .ll { font-variant: small-caps; letter-spacing: .07em; font-size: 11px; color: var(--dim); margin-bottom: 9px; }
  .doors { display: flex; flex-wrap: wrap; gap: 6px; }
  .door { background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 5px 11px;
    font-family: inherit; font-size: 12.5px; color: var(--ink); cursor: pointer; }
  .door:hover { border-color: var(--a); color: var(--a); }
  .anch { color: var(--dim); font-size: 10px; margin-left: 5px; }
  .deadend { font-size: 12px; color: var(--dim); font-style: italic; line-height: 1.55; }
  .absent { margin-top: 9px; font-size: 11px; color: var(--dim); line-height: 1.5; font-style: italic; }
  .prev { margin: 8px 0 13px; padding: 9px 12px; border-left: 2px solid var(--b);
    background: var(--panel); font-size: 13px; line-height: 1.6; border-radius: 0 5px 5px 0; max-width: 74ch; }
  .pr { font-size: 10.5px; color: var(--b); font-variant: small-caps; letter-spacing: .05em; }
  .popen { display: block; margin-top: 5px; background: none; border: none; font-family: inherit;
    font-size: 11px; color: var(--a); cursor: pointer; padding: 0; }
  .popen:hover { text-decoration: underline; }
</style>
