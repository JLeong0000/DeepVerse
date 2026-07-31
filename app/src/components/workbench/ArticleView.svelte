<script>
  // The article body renderer, shared by the Context tab's modal and the library's article
  // surface. Deliberately owns no chrome — no title bar, no scroll container, no positioning —
  // so each host can frame it however it needs.
  import { parseArticleBlocks } from '../../lib/display.js';
  import RefText from '../common/RefText.svelte';

  const DICT_SOURCE = 'Tyndale Open Bible Dictionary · © 2023 Tyndale House Publishers · CC BY-SA 4.0';
  let { article, supplements = [], source = null, onnavigate = null,
        xrefs = null, onxref = null, onref = null, openToken = null, preview = null } = $props();

  let blocks = $derived(parseArticleBlocks(article.body));

  // Only inside a "See …" clause, never in loose prose: Calf, Clay, Hour, Evening and Command are
  // all real article titles, so linkifying titles wherever they appear would make every paragraph
  // a minefield. The source wrote "See X." deliberately — that is the only context safe to trust.
  const CLAUSE = /^(.*?)(\bSee(?: also)? )([^.]+)\.\s*$/;
  function splitClause(text) {
    if (!xrefs) return null;
    const m = text.match(CLAUSE);
    if (!m) return null;
    const targets = m[3].split(';').map((t) => {
      const raw = t.trim();
      // dict_xref.raw is the source's own wording, so this is an exact match, not a guess
      const hit = xrefs.out.find((o) => o.raw === raw);
      return { raw, id: hit?.id ?? null };
    });
    return { lead: m[1], see: m[2], targets };
  }
</script>

{#each blocks as b}
  {#if b.kind === 'head'}
    <h3 class="mhead">{b.text}</h3>
  {:else if b.kind === 'item'}
    <p class="mitem"><RefText text={b.text} book={article.book ?? null} onnavigate={onnavigate} onref={onref} /></p>
    {#if preview && openToken && b.text.includes(openToken)}
      {@render preview()}
    {/if}
  {:else}
    {@const c = splitClause(b.text)}
    {#if c}
      <p class="mbody">
        <RefText text={c.lead} book={article.book ?? null} onnavigate={onnavigate} onref={onref} />{c.see}{#each c.targets as t, k}{#if k > 0}; {/if}{#if t.id}<button class="xref" onclick={() => onxref?.(t.id)}>{t.raw}</button>{:else}<span class="xdead" title="named by the source, but no such article exists">{t.raw}</span>{/if}{/each}.
      </p>
    {:else}
      <p class="mbody"><RefText text={b.text} book={article.book ?? null} onnavigate={onnavigate} onref={onref} /></p>
    {/if}
    {#if preview && openToken && b.text.includes(openToken)}
      {@render preview()}
    {/if}
  {/if}
{/each}

{#each supplements as s (s.id)}
  <div class="supp" data-sid={s.id}>
    <div class="supptitle">{s.kind === 'chart' ? '▦' : '▤'} {s.title}</div>
    <!-- charts are the only Tyndale content that cannot flatten to text. The markup is generated
         by our own build-time parser (tags whitelisted to table/tr/td/th, every attribute
         stripped), never raw vendor input, so {@html} has no untrusted source. -->
    {#if s.is_html}
      <div class="charttbl">{@html s.body}</div>
    {:else}
      <p class="mbody"><RefText text={s.body} onnavigate={onnavigate} onref={onref} /></p>
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
