<script>
  // An article, plus the doors out of it. "Where this leads" is what converts an article with
  // links buried in its last sentence into a junction with visible exits.
  import { getArticle, getArticleSupplements, getXrefs, getRefPreview } from '../../lib/db.js';
  import { lib, pushNode } from '../../lib/library.svelte.js';
  import { displayTitle } from '../../lib/titles.js';
  import { goToPassage } from '../../lib/study.svelte.js';
  import { go } from '../../lib/router.svelte.js';
  import { bookName } from '../../lib/refs.js';
  import ArticleView from '../workbench/ArticleView.svelte';

  let { id, anchor = null } = $props();

  let article = $derived(getArticle(id));
  let supplements = $derived(getArticleSupplements(id));
  let xrefs = $derived(getXrefs(id));

  let open = $state(null);   // { ref, index } — index is the block the preview was opened from
  $effect(() => { id; open = null; });   // a new article clears any open preview

  // A node restored from a bookmarked/reloaded URL carries its id as a placeholder title (there's
  // no db to read the real one from until it's loaded) — the breadcrumb shows the raw id for a
  // moment, then this corrects it. Guarded on the stack top still being *this* id so a fast
  // click-through to another article before the db resolves can't stamp a stale title onto it.
  $effect(() => { if (article && lib.stack.at(-1)?.id === id) lib.stack.at(-1).title = article.title; });

  const KIND_LABEL = { chart: 'Chart', textbox: 'Textbox' };

  // Verses the article links to that none of our three translations carry. Keyed by "book.chapter",
  // because both cases are whole-chapter absences. Written by hand — there are only two, and a
  // generic "not available" would hide the reason, which is itself the interesting content.
  //
  // Sources: the Additions to Esther are the six passages (107 verses) present in the Septuagint
  // Greek Esther but not in the Hebrew; Jerome collected them as an appendix to the Vulgate, and
  // the later chapter division numbered them on from Esther 10, producing chapters 11-16. Tyndale
  // itself cites them as "Add Est 11:1" — the "Add" is the source's own marker, which our reference
  // linkifier does not carry through.
  const ABSENT = {
    'Esth.11': 'Part of the Greek Additions to Esther. Tyndale cites this as “Add Est 11:1” — one ' +
      'of six passages found in the Septuagint’s Greek Esther but not in the Hebrew text. Jerome ' +
      'gathered them into an appendix to the Vulgate, and a later chapter division numbered them ' +
      'on from Esther 10. Catholic and Orthodox canons include them; Protestant Bibles do not, so ' +
      'no translation DeepVerse carries has this verse — all three end at Esther 10.',
    'Esth.12': 'Part of the Greek Additions to Esther. Tyndale cites this as “Add Est 12:1” — one ' +
      'of six passages found in the Septuagint’s Greek Esther but not in the Hebrew text. Jerome ' +
      'gathered them into an appendix to the Vulgate, and a later chapter division numbered them ' +
      'on from Esther 10. Catholic and Orthodox canons include them; Protestant Bibles do not, so ' +
      'no translation DeepVerse carries has this verse — all three end at Esther 10.',
  };

  // Shown when the preview had to fall back off the NIV. Acts 8:37 is the only one the dictionary
  // actually links to; the generic line states only what our own data shows, and claims nothing
  // about manuscripts it hasn't been checked against.
  const VARIANT = {
    'Acts.8.37': 'The NIV and NLT omit this verse. It is absent from the earliest Greek ' +
      'manuscripts and entered the tradition through the Textus Receptus, which the KJV and NKJV ' +
      'follow — so it is shown here from the NKJV.',
  };

  // A door's `anchor` (e.g. "Animals (Cattle)") names a "## Cattle" subhead inside the target, not
  // just the target itself — so landing on the article without scrolling to it delivers only half
  // of what the door advertised. bodyEl/titleEl are queried after render, same pattern as
  // ArticleModal's focusId: anchor -> the matching [data-head], else the top of the new article
  // (never the old scroll position — .surface doesn't remount between article nodes).
  let titleEl = $state(null);
  let bodyEl = $state(null);
  $effect(() => {
    id;   // re-run on every article change even when there is no anchor
    const target = anchor && bodyEl?.querySelector(`[data-head="${CSS.escape(anchor)}"]`);
    (target ?? titleEl)?.scrollIntoView({ block: 'start', behavior: anchor ? 'smooth' : 'auto' });
  });

  function openDoor(o) {
    pushNode({ kind: 'article', id: o.id, title: o.title, anchor: o.anchor ?? null });
  }
</script>

{#snippet previewSnippet()}
  {@const r = open.ref}
  {@const p = getRefPreview(`${r.book}.${r.chapter}.${r.verse}`)}
  {@const note = p.version === 'NIV' ? null
    : p.text ? (VARIANT[`${r.book}.${r.chapter}.${r.verse}`]
        ?? `The NIV does not include this verse; it is shown here from the ${p.version}.`)
    : (ABSENT[`${r.book}.${r.chapter}`] ?? 'No translation DeepVerse carries has this verse.')}
  <div class="prev" class:absent={!p.text}>
    <div class="pr">{bookName(r.book)} {r.chapter}:{r.verse}{p.version ? ` · ${p.version}` : ''}</div>
    {p.text}
    {#if note}<div class="pnote">{note}</div>{/if}
    {#if p.text}
      <button class="popen" onclick={() => { goToPassage(r); go('study'); }}>Open in Study →</button>
    {/if}
  </div>
{/snippet}

{#if article}
  <h3 class="stitle" bind:this={titleEl}>{displayTitle(article.title)}</h3>
  <div class="smeta">
    {article.kind === 'article' ? `Dictionary article · cites ${article.n_refs} verses` : KIND_LABEL[article.kind]}
  </div>

  <!-- onnavigate only ever fires for a supplement ref: every main-body RefText also gets `onref`
       below, whose early return in RefText.svelte never falls through to onnavigate. A supplement
       has no preview surface, so its default jump must stay visible — silently overwriting study
       state with no route change is a click that looks inert while it quietly repositions a
       different view. -->
  <div class="body" bind:this={bodyEl}>
    <ArticleView {article} {supplements} {xrefs}
      onref={(ref, i) => (open = open?.index === i ? null : { ref, index: i })}
      openIndex={open?.index ?? null}
      preview={open ? previewSnippet : null}
      onnavigate={() => go('study')}
      onxref={(xid) => {
        const hit = xrefs.out.find((o) => o.id === xid);
        pushNode({ kind: 'article', id: xid, title: hit?.title ?? xid, anchor: hit?.anchor ?? null });
      }} />
  </div>

  <div class="leads">
    <div class="ll">Where this leads</div>
    {#if xrefs.out.length}
      <div class="doors">
        {#each xrefs.out as o (o.id)}
          <button class="door" onclick={() => openDoor(o)}>
            {displayTitle(o.title)}{' '}{#if o.anchor}<span class="anch">§ {o.anchor}</span>{/if}
          </button>
        {/each}
      </div>
    {:else if !xrefs.missing.length}
      <!-- 2,649 of the 6,010 articles have no resolved outbound link; an empty box would read as a
           bug. Suppressed when the article names only entries the corpus lacks — the list below
           already accounts for those, and "names no other entry" would contradict it. -->
      <div class="deadend">
        A dead end — this article names no other entry. Search, pick another route, or ✦ Wander in.
      </div>
    {/if}
    {#if xrefs.missing.length}
      <!-- 140 of the 5,240 links name an article Tyndale never wrote. Listing them is more honest
           than hiding them, and stops the graph looking more complete than it is. -->
      <div class="absent">
        Named by the source, but absent from the corpus:
        {xrefs.missing.map(displayTitle).join(' · ')}.
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
  /* an absence is content here, not an error state — same box, no alarm colour */
  .prev.absent { border-left-style: dotted; }
  .pnote { margin-top: 5px; font-size: 11.5px; line-height: 1.5; color: var(--dim); }
  .popen { display: block; margin-top: 5px; background: none; border: none; font-family: inherit;
    font-size: 11px; color: var(--a); cursor: pointer; padding: 0; }
  .popen:hover { text-decoration: underline; }
</style>
