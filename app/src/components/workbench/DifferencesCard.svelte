<script>
  import { getVerseDifferences } from '../../lib/db.js';
  import { study, selectWord } from '../../lib/study.svelte.js';
  import { cleanGloss, testamentLabel, readTranslit } from '../../lib/display.js';
  import WordInstances from './WordInstances.svelte';

  let showAll = $state(false);
  let instancesFor = $state(null); // { strongs, original } of a sense chip the user opened
  $effect(() => { study.verse; study.book; study.chapter; showAll = false; }); // reset on verse change

  // group differences by word position: a word can be both Type A and Type B — show it once.
  let rows = $derived.by(() => {
    if (study.verse == null) return [];
    const diffs = getVerseDifferences(study.book, study.chapter, study.verse);
    const byPos = new Map();
    for (const d of diffs) {
      const r = byPos.get(d.position) || { position: d.position, gloss: d.gloss, original: d.original, translit: d.translit, strongs: d.strongs, freq: d.freq, a: null, b: null };
      if (d.type === 'A') r.a = d; else r.b = d;
      byPos.set(d.position, r);
    }
    return [...byPos.values()].sort((x, y) => x.position - y.position);
  });

  // representative subset (matches the reader underlines): the RAREST word with an A + the rarest word
  // with a B — rarity ≈ deliberate authorial choice, so the marked word surfaces over a common one
  // (e.g. "propitiation" over "take", "nephesh" over "said"). Prefer two DISTINCT words.
  let shown = $derived.by(() => {
    if (showAll) return rows;
    const rarest = (has, exclude) => rows
      .filter(r => has(r) && r !== exclude)
      .sort((x, y) => (x.freq ?? Infinity) - (y.freq ?? Infinity))[0];
    const repA = rarest(r => r.a);
    const repB = rarest(r => r.b, repA) || rarest(r => r.b);
    const rep = new Set([repA, repB].filter(Boolean));
    return rows.filter(r => rep.has(r));
  });

  // B sense-spread: tint each sense chip by its share of the most-common sense, so relative
  // frequency reads from colour depth (darkest = most common) at a fixed width, not bar length.
  function tintPct(count, senses) {
    const max = Math.max(...senses.slice(0, 3).map(p => p.count)) || 1;
    return Math.round(8 + (count / max) * 54); // 8%..62% of --b mixed into the panel
  }
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
        <div class="lead alead">
          <span class="bdg bA">A · synonym</span>
          literally <b>“{cleanGloss(r.gloss)}”</b>
          <button class="chip chosen" onclick={() => selectWord({ strongs: r.strongs, ...r.a })}>
            <span class="chw"><span class="grk">{r.original}</span><span class="tl">{readTranslit(r.translit)}</span></span>
            <span class="chg">{cleanGloss(r.gloss)}</span>
          </button>
          {#if r.a.detail.nearSynonyms?.length}
            <span class="vs">vs</span>
            {#each r.a.detail.nearSynonyms.slice(0, 2) as syn}
              <button class="chip rejected" onclick={() => selectWord({ strongs: syn.strongs, original: syn.lemma, translit: syn.translit })}>
                <span class="chw"><span class="grk">{syn.lemma}</span><span class="tl">{readTranslit(syn.translit)}</span></span>
                {#if syn.gloss}<span class="chg">{cleanGloss(syn.gloss)}</span>{/if}
              </button>
            {/each}
          {/if}
        </div>
      {/if}
      {#if r.b}
        <div class="lead" class:mt={r.a}>
          <span class="bdg bB">B · sense-spread</span>
          <span class="wordB" onclick={() => selectWord({ strongs: r.strongs, ...r.b })} role="button" tabindex="0">
            <span class="grk">{r.original}</span> <span class="tl">{readTranslit(r.translit)}</span>
          </span>
          — literally <b>“{cleanGloss(r.gloss)}”</b>
        </div>
        <div class="tally">
          <span class="tcap">across {testamentLabel(r.strongs)}:</span>
          {#each r.b.detail.senses.slice(0, 3) as p}
            <button class="schip" title="See the verses this word appears in"
              onclick={() => (instancesFor = { strongs: r.strongs, original: r.original, translit: r.translit })}
              style="background: color-mix(in srgb, var(--b) {tintPct(p.count, r.b.detail.senses)}%, var(--panel))"><b>{cleanGloss(p.gloss)}</b> {p.count}×</button>
          {/each}
        </div>
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
  {#if instancesFor}
    <WordInstances strongs={instancesFor.strongs} original={instancesFor.original} translit={instancesFor.translit}
      ref={{ book: study.book, chapter: study.chapter, verse: study.verse }}
      onclose={() => (instancesFor = null)} />
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
  .lead.alead { line-height: 1.5; }
  .grk { font-family: var(--greek); }
  .tl { color: var(--dim); font-style: italic; font-size: .82em; }
  .chip { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 0;
    border: 1px solid var(--rule); border-radius: 5px; padding: 2px 8px; cursor: pointer;
    color: var(--ink); font-family: inherit; vertical-align: middle; }
  .chip .chw { display: inline-flex; align-items: baseline; gap: 5px; }
  .chip .chw .grk { font-size: 1.1em; }
  .chip .chg { font-size: .72em; color: var(--dim); font-style: italic; line-height: 1.25; }
  .chip.chosen { border-color: var(--a); background: var(--abg); }
  .chip.rejected { opacity: .5; background: color-mix(in srgb, var(--panel) 50%, var(--bg)); }
  .chip.rejected:hover { opacity: .85; } .chip.chosen:hover { border-color: var(--a); }
  .vs { color: var(--dim); font-size: .85em; margin: 0 2px; }
  .wordB { border-bottom: 2px solid var(--b); cursor: pointer; padding-bottom: 1px; }
  .wordB .grk { font-size: 1.1em; }
  .tally { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin-top: 5px;
    font-size: .86em; color: var(--dim); font-style: italic; }
  .schip { display: inline-flex; align-items: baseline; gap: 4px; padding: 2px 7px; border-radius: 4px;
    white-space: nowrap; color: var(--ink); border: 1px solid transparent; cursor: pointer;
    font-family: inherit; font-size: 1em; font-style: italic; }
  .schip:hover { border-color: var(--b); }
  .schip b { font-weight: 600; font-style: italic; }
  .repcap { padding: 10px 11px 12px; font-size: 11px; color: var(--dim); font-style: italic; }
  .showall { display: block; width: 100%; text-align: left; padding: 8px 11px; border: none; border-top: 1px solid var(--rule);
    background: transparent; color: var(--b); cursor: pointer; font-family: inherit; font-size: 12px; }
  .showall:hover { text-decoration: underline; }
</style>
