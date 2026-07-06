<script>
  import { getVerseDifferences } from '../../lib/db.js';
  import { study, selectWord } from '../../lib/study.svelte.js';

  let diffs = $derived(study.verse == null ? [] : getVerseDifferences(study.book, study.chapter, study.verse));

  // spread bar segments (top 3 senses) for a Type B difference
  function spread(detail) {
    const s = detail.senses.slice(0, 3);
    const total = detail.total || s.reduce((n, x) => n + x.count, 0);
    return { parts: s, total };
  }
</script>

{#if study.verse == null}
  <div class="empty">Select a verse.</div>
{:else if diffs.length === 0}
  <div class="empty">No interpretive differences flagged in this verse.</div>
{:else}
  {#each diffs as d (d.position + d.type)}
    <div class="drow">
      {#if d.type === 'A'}
        <div class="lead">
          <span class="bdg bA">A · synonym</span>
          <b>“{d.gloss.trim()}”</b> uses
          <button class="gbtn used" onclick={() => selectWord({ strongs: d.strongs, ...d })}>
            <span class="grk">{d.original}</span><span class="tl">{d.translit}</span>
          </button>
          {#if d.detail.nearSynonyms?.length}
            <span class="vs">not</span>
            {#each d.detail.nearSynonyms.slice(0, 2) as syn}
              <button class="gbtn" onclick={() => selectWord({ strongs: syn.strongs, original: syn.lemma, translit: syn.translit })}>
                <span class="grk">{syn.lemma}</span><span class="tl">{syn.translit}</span>
              </button>
            {/each}
          {/if}
        </div>
        {#if d.detail.nearSynonyms?.[0]?.gloss}
          <div class="ex">{d.translit}: {d.gloss.trim()} · {d.detail.nearSynonyms[0].translit}: {d.detail.nearSynonyms[0].gloss}</div>
        {/if}
      {:else}
        {@const sp = spread(d.detail)}
        <div class="lead">
          <span class="bdg bB">B · sense-spread</span>
          <b>“{d.gloss.trim()}”</b> is
          <span class="wordB" onclick={() => selectWord({ strongs: d.strongs, ...d })} role="button" tabindex="0">
            <span class="grk">{d.original}</span> <span class="tl">{d.translit}</span>
          </span>
        </div>
        <div class="exn">One word — no alternative to pick. Across the NT it's translated:</div>
        <div class="spread">
          {#each sp.parts as p, i}<i class="s{i + 1}" style="flex:{p.count}"></i>{/each}
        </div>
        <div class="ex">{#each sp.parts as p, i}<b>{p.gloss}</b> {p.count}×{#if i < sp.parts.length - 1} · {/if}{/each}</div>
      {/if}
    </div>
  {/each}
{/if}

<style>
  .empty { color: var(--dim); font-size: 12px; font-style: italic; padding: 9px 11px; }
  .drow { padding: 9px 11px; } .drow + .drow { border-top: 1px solid var(--rule); }
  .bdg { font-size: .72em; font-weight: 700; padding: 1px 6px; border-radius: 3px; font-variant: small-caps; letter-spacing: .04em; }
  .bA { background: var(--abg); color: var(--a); } .bB { background: var(--bbg); color: var(--b); }
  .lead { font-size: 14px; margin-bottom: 4px; line-height: 1.9; }
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
</style>
