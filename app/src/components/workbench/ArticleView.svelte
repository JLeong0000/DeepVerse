<script>
  // The article body renderer, shared by the Context tab's modal and the library's article
  // surface. Deliberately owns no chrome — no title bar, no scroll container, no positioning —
  // so each host can frame it however it needs.
  import { parseArticleBlocks, splitSeeClauses } from '../../lib/display.js';
  import RefText from '../common/RefText.svelte';

  const DICT_SOURCE = 'Tyndale Open Bible Dictionary · © 2023 Tyndale House Publishers · CC BY-SA 4.0';
  let { article, supplements = [], source = null, onnavigate = null,
        xrefs = null, onxref = null, onref = null, openIndex = null, preview = null } = $props();

  let blocks = $derived(parseArticleBlocks(article.body));

  // Linkification is driven entirely by dict_xref — see splitSeeClauses. This component holds no
  // opinion about what a "See …" clause is; it only renders what the build stored, keyed on the
  // source's exact wording. Titles are never matched in loose prose: Calf, Clay, Hour, Evening and
  // Command are all real entries, so that would make every paragraph a minefield.
  let byRaw = $derived.by(() => {
    if (!xrefs) return null;
    const m = new Map();
    for (const o of xrefs.out) if (!m.has(o.raw)) m.set(o.raw, o);
    // recorded, but the entry does not exist in the corpus — rendered plain, and named in full by
    // ArticleSurface's "absent from the corpus" list
    for (const raw of xrefs.missing) if (!m.has(raw)) m.set(raw, null);
    return m;
  });

  // The preview's identity is the block it was opened from, not the citation text: two different
  // blocks routinely cite the identical span ("Dt 14:7" appears 4× across "Animals"), and a
  // substring match on block text would pop the preview under every one of them. Wrapping onref
  // per block index is what lets the host tell them apart.
  function refOnref(i) {
    return onref ? (ref) => onref(ref, i) : null;
  }
</script>

{#if article.is_html}
  <!-- charts are the only Tyndale content that cannot flatten to text — same reasoning as the
       chart supplements below: build-time-generated markup (tags whitelisted, every attribute
       stripped), never raw vendor input, so {@html} has no untrusted source. -->
  <div class="charttbl">{@html article.body}</div>
{:else}
  {#each blocks as b, i}
    {#if b.kind === 'head'}
      <h3 class="mhead" data-head={b.text}>{b.text}</h3>
    {:else if b.kind === 'item'}
      <p class="mitem"><RefText text={b.text} book={article.book ?? null} onnavigate={onnavigate} onref={refOnref(i)} /></p>
      {#if preview && openIndex === i}
        {@render preview()}
      {/if}
    {:else}
      <!-- every part is emitted verbatim: the prose runs, the separators and the trailing period
           all come straight out of the source, so its own "; " spacing cannot be lost here -->
      <p class="mbody">{#each splitSeeClauses(b.text, byRaw) as p}{#if p.kind === 'link'}<button class="xref" onclick={() => onxref?.(p.id)}>{p.raw}</button>{:else if p.kind === 'dead'}<span class="xdead" title="named by the source, but no such entry exists in the corpus">{p.raw}</span>{:else}<RefText text={p.text} book={article.book ?? null} onnavigate={onnavigate} onref={refOnref(i)} />{/if}{/each}</p>
      {#if preview && openIndex === i}
        {@render preview()}
      {/if}
    {/if}
  {/each}
{/if}

{#each supplements as s (s.id)}
  <div class="supp" data-sid={s.id}>
    <div class="supptitle">{s.kind === 'chart' ? '▦' : '▤'} {s.title}</div>
    <!-- charts are the only Tyndale content that cannot flatten to text. The markup is generated
         by our own build-time parser (tags whitelisted to table/tr/td/th, every attribute
         stripped), never raw vendor input, so {@html} has no untrusted source. -->
    {#if s.is_html}
      <div class="charttbl">{@html s.body}</div>
    {:else}
      <!-- no onref here: a supplement never renders a preview (that surface was never asked for),
           so forwarding onref would suppress the jump and produce a dead click -->
      <p class="mbody"><RefText text={s.body} onnavigate={onnavigate} /></p>
    {/if}
  </div>
{/each}

<div class="src">
  <div class="srclbl">Source</div>
  {source ?? DICT_SOURCE}
</div>

<style>
  /* generous measure + spacing: these run to 20k characters and are read, not skimmed */
  .mbody { margin: 0 0 11px; font-size: 13.5px; line-height: 1.72; color: var(--ink); }
  .mhead { margin: 20px 0 7px; font-size: 12px; font-weight: 600; color: var(--b);
    font-variant: small-caps; letter-spacing: .06em; }
  .mhead:first-child { margin-top: 0; }
  .mitem { margin: 0 0 5px; padding-left: 12px; font-size: 13.5px; line-height: 1.6;
    color: var(--ink); }
  .supp { margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--rule); scroll-margin-top: 4px; }
  .supptitle { font-size: 12.5px; color: var(--b); font-weight: 600; margin-bottom: 5px; }
  /* a chart body is leading prose followed by a table; without a size here the prose inherits the
     host's base and renders noticeably larger than the article it belongs to */
  .charttbl { overflow-x: auto; font-size: 13px; line-height: 1.6; color: var(--ink); }
  .charttbl :global(table) { border-collapse: collapse; font-size: 11.5px; width: 100%; margin-top: 8px; }
  .charttbl :global(td), .charttbl :global(th) { border: 1px solid var(--rule);
    padding: 3px 6px; text-align: left; vertical-align: top; color: var(--ink); }
  .src { margin-top: 16px; padding-top: 10px; border-top: 1px solid var(--rule);
    font-size: 11px; line-height: 1.5; color: var(--dim); }
  .srclbl { font-variant: small-caps; letter-spacing: .05em; margin-bottom: 2px; }
  .xref { background: none; border: none; font-family: inherit; font-size: inherit; padding: 0;
    color: var(--a); cursor: pointer; border-bottom: 1px dotted var(--a); }
  .xref:hover { border-bottom-style: solid; }
  .xdead { color: var(--dim); font-style: italic; cursor: help; }
</style>
