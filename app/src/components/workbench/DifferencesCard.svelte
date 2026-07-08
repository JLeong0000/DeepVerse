<script>
  import { getVerseDifferences } from '../../lib/db.js';
  import { study, selectWord } from '../../lib/study.svelte.js';
  import { cleanGloss, testamentLabel } from '../../lib/display.js';

  let showAll = $state(false);
  $effect(() => { study.verse; study.book; study.chapter; showAll = false; }); // reset on verse change

  // group differences by word position: a word can be both Type A and Type B — show it once.
  let rows = $derived.by(() => {
    if (study.verse == null) return [];
    const diffs = getVerseDifferences(study.book, study.chapter, study.verse);
    const byPos = new Map();
    for (const d of diffs) {
      const r = byPos.get(d.position) || { position: d.position, gloss: d.gloss, original: d.original, translit: d.translit, strongs: d.strongs, a: null, b: null };
      if (d.type === 'A') r.a = d; else r.b = d;
      byPos.set(d.position, r);
    }
    return [...byPos.values()].sort((x, y) => x.position - y.position);
  });

  // representative subset (matches the reader underlines): first word with an A + first word with a
  // B — preferring two DISTINCT words (a word that is both A and B shouldn't hide the sense-spread one).
  let shown = $derived.by(() => {
    if (showAll) return rows;
    const firstA = rows.find(r => r.a);
    const firstB = rows.find(r => r.b && r !== firstA) || rows.find(r => r.b);
    const rep = new Set([firstA, firstB].filter(Boolean));
    return rows.filter(r => rep.has(r));
  });
</script>

{#if study.verse == null}
  <div class="empty">Select a verse.</div>
{:else if rows.length === 0}
  <div class="empty">No interpretive differences flagged in this verse.</div>
{:else}
  <div class="explain">
    <span class="q">ⓘ</span> where the English hides a distinction the original makes
    <div class="tip">
      <p><b class="ca">A · synonym collapse.</b> The boxed word is the <b>actual word in this verse</b>. The
      alternatives after “not” are <b>distinct</b> near-synonyms — different Strong’s words in the same
      Louw-Nida semantic domain — that this English word doesn’t distinguish (e.g. φιλέω vs ἀγαπάω, both
      “love”). They come from a precomputed semantic-distance matrix, not from other verses’ wording.</p>
      <p><b class="cb">B · sense-spread.</b> One original word that the translation renders several different
      ways across Scripture (e.g. ψυχή → soul / life). The bar shows that spread.</p>
      <p>Tap any word to see its lexicon entry in the Original card.</p>
    </div>
  </div>
  {#each shown as r (r.position)}
    <div class="drow">
      {#if r.a}
        <div class="lead">
          <span class="bdg bA">A · synonym</span>
          <b>“{cleanGloss(r.gloss)}”</b> uses
          <button class="gbtn" onclick={() => selectWord({ strongs: r.strongs, ...r.a })}>
            <span class="grk">{r.original}</span><span class="tl">{r.translit}</span>
          </button>
          {#if r.a.detail.nearSynonyms?.length}
            <span class="vs">not</span>
            {#each r.a.detail.nearSynonyms.slice(0, 2) as syn}
              <button class="gbtn" onclick={() => selectWord({ strongs: syn.strongs, original: syn.lemma, translit: syn.translit })}>
                <span class="grk">{syn.lemma}</span><span class="tl">{syn.translit}</span>
              </button>
            {/each}
          {/if}
        </div>
        {#if r.a.detail.nearSynonyms?.[0]?.gloss}
          <div class="ex">{r.translit}: {cleanGloss(r.gloss)} · {r.a.detail.nearSynonyms[0].translit}: {cleanGloss(r.a.detail.nearSynonyms[0].gloss)}</div>
        {/if}
      {/if}
      {#if r.b}
        <div class="lead" class:mt={r.a}>
          <span class="bdg bB">B · sense-spread</span>
          <b>“{cleanGloss(r.gloss)}”</b> is
          <span class="wordB" onclick={() => selectWord({ strongs: r.strongs, ...r.b })} role="button" tabindex="0">
            <span class="grk">{r.original}</span> <span class="tl">{r.translit}</span>
          </span>
        </div>
        <div class="exn">Rendered across {testamentLabel(r.strongs)} as:</div>
        <div class="spread">
          {#each r.b.detail.senses.slice(0, 3) as p, i}<i class="s{i + 1}" style="flex:{p.count}"></i>{/each}
        </div>
        <div class="ex">{#each r.b.detail.senses.slice(0, 3) as p, i}<b>{cleanGloss(p.gloss)}</b> {p.count}×{#if i < Math.min(r.b.detail.senses.length, 3) - 1} · {/if}{/each}</div>
      {/if}
    </div>
  {/each}
  {#if rows.length > shown.length && !showAll}
    <div class="repcap">Showing the {shown.length} word{shown.length > 1 ? 's' : ''} highlighted in the reader; {rows.length} words are flagged in this verse.</div>
  {/if}
  {#if rows.length > shown.length || showAll}
    <button class="showall" onclick={() => (showAll = !showAll)}>
      {showAll ? '▴ Show fewer' : `▾ Show all ${rows.length} differences`}
    </button>
  {/if}
{/if}

<style>
  .empty { color: var(--dim); font-size: 12px; font-style: italic; padding: 9px 11px; }
  .explain { position: relative; padding: 8px 11px; font-size: 11px; color: var(--dim); font-style: italic;
    border-bottom: 1px solid var(--rule); }
  .explain .q { font-style: normal; cursor: help; color: var(--b); margin-right: 3px; }
  .explain .tip { position: absolute; z-index: 40; left: 11px; right: 11px; top: 100%; margin-top: 2px;
    background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 10px 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,.4); font-style: normal; font-size: 12px; line-height: 1.5; color: var(--ink);
    opacity: 0; visibility: hidden; transition: opacity .12s; }
  .explain:hover .tip { opacity: 1; visibility: visible; }
  .explain .tip p { margin: 0 0 7px; } .explain .tip p:last-child { margin-bottom: 0; }
  .explain .tip .ca { color: var(--a); } .explain .tip .cb { color: var(--b); }
  .drow { padding: 9px 11px; } .drow + .drow { border-top: 1px solid var(--rule); }
  .bdg { font-size: .72em; font-weight: 700; padding: 1px 6px; border-radius: 3px; font-variant: small-caps; letter-spacing: .04em; }
  .bA { background: var(--abg); color: var(--a); } .bB { background: var(--bbg); color: var(--b); }
  .lead { font-size: 14px; margin-bottom: 4px; line-height: 1.9; } .lead.mt { margin-top: 8px; }
  .grk { font-family: var(--greek); }
  .tl { color: var(--dim); font-style: italic; font-size: .82em; }
  .gbtn { display: inline-flex; align-items: baseline; gap: 5px; border: 1px solid var(--rule);
    background: color-mix(in srgb, var(--panel) 50%, var(--bg)); border-radius: 5px; padding: 2px 8px; cursor: pointer;
    color: var(--ink); font-family: inherit; }
  .gbtn:hover { border-color: var(--a); } .gbtn .grk { font-size: 1.1em; }
  .gbtn.used { border-color: var(--a); }
  .vs { color: var(--dim); font-size: .85em; margin: 0 3px; }
  .wordB { border-bottom: 2px solid var(--b); cursor: pointer; padding-bottom: 1px; }
  .wordB .grk { font-size: 1.1em; }
  .ex { font-size: .86em; color: var(--dim); font-style: italic; }
  .exn { font-size: .86em; color: var(--ink); margin-bottom: 2px; }
  .spread { display: flex; gap: 2px; margin: 6px 0 4px; height: 10px; width: 190px; border-radius: 2px; overflow: hidden; }
  .spread i { display: block; }
  .spread .s1 { background: var(--b); } .spread .s2 { background: color-mix(in srgb, var(--b) 55%, var(--bg)); }
  .spread .s3 { background: var(--rule); }
  .repcap { padding: 10px 11px 12px; font-size: 11px; color: var(--dim); font-style: italic; }
  .showall { display: block; width: 100%; text-align: left; padding: 8px 11px; border: none; border-top: 1px solid var(--rule);
    background: transparent; color: var(--b); cursor: pointer; font-family: inherit; font-size: 12px; }
  .showall:hover { text-decoration: underline; }
</style>
