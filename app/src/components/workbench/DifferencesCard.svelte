<script>
  import { getVerseDifferences } from '../../lib/db.js';
  import { study, selectWord } from '../../lib/study.svelte.js';

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
  {#each shown as r (r.position)}
    <div class="drow">
      {#if r.a}
        <div class="lead">
          <span class="bdg bA">A · synonym</span>
          <b>“{r.gloss.trim()}”</b> uses
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
          <div class="ex">{r.translit}: {r.gloss.trim()} · {r.a.detail.nearSynonyms[0].translit}: {r.a.detail.nearSynonyms[0].gloss}</div>
        {/if}
      {/if}
      {#if r.b}
        <div class="lead" class:mt={r.a}>
          <span class="bdg bB">B · sense-spread</span>
          <b>“{r.gloss.trim()}”</b> is
          <span class="wordB" onclick={() => selectWord({ strongs: r.strongs, ...r.b })} role="button" tabindex="0">
            <span class="grk">{r.original}</span> <span class="tl">{r.translit}</span>
          </span>
        </div>
        <div class="exn">Rendered across the NT as:</div>
        <div class="spread">
          {#each r.b.detail.senses.slice(0, 3) as p, i}<i class="s{i + 1}" style="flex:{p.count}"></i>{/each}
        </div>
        <div class="ex">{#each r.b.detail.senses.slice(0, 3) as p, i}<b>{p.gloss}</b> {p.count}×{#if i < Math.min(r.b.detail.senses.length, 3) - 1} · {/if}{/each}</div>
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
  .repcap { padding: 8px 11px 0; font-size: 11px; color: var(--dim); font-style: italic; }
  .showall { display: block; width: 100%; text-align: left; padding: 8px 11px; border: none; border-top: 1px solid var(--rule);
    background: transparent; color: var(--b); cursor: pointer; font-family: inherit; font-size: 12px; }
  .showall:hover { text-decoration: underline; }
</style>
