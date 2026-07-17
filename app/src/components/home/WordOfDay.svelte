<script>
  import { getWordOfDay, getLexicon, getSenseOccurrence } from '../../lib/db.js';
  import { langLabel, cleanGloss, readTranslit, testamentLabel, shortDefinition } from '../../lib/display.js';
  import { formatRef } from '../../lib/refs.js';
  import { openStudy } from '../../lib/router.svelte.js';
  import PlayButton from '../common/PlayButton.svelte';
  import WordSearch from './WordSearch.svelte';
  import WordInstances from '../workbench/WordInstances.svelte';
  import GlossedText from '../common/GlossedText.svelte';

  let searchOpen = $state(false);
  let instancesOpen = $state(false);

  const w = getWordOfDay();
  const lang = w ? langLabel(w.lang || w.strongs) : '';
  // senses come sorted by count desc: [0] is the most-appeared translation, the rest are "other interpretations"
  const senses = w ? w.senses.map(s => ({ gloss: cleanGloss(s.gloss), count: s.count })) : [];
  const top = senses[0];
  // the featured sense gets the same "seen in" example verse as the other interpretations
  const topOcc = w && w.senses[0] ? getSenseOccurrence(w.strongs, w.senses[0].gloss) : null;
  // each "other interpretation" carries an example verse where the word is rendered that way (its "seen in" link)
  const rest = w ? w.senses.slice(1).map(s => ({ gloss: cleanGloss(s.gloss), count: s.count, occ: getSenseOccurrence(w.strongs, s.gloss) })) : [];
  // condensed dictionary definition: sense glosses only, verse citations stripped (see shortDefinition)
  const def = w ? shortDefinition(getLexicon(w.strongs)?.definition) : '';

  function jump(occ) {
    openStudy({ ...occ.ref, word: { position: occ.position } });
  }
  const refText = (ref) => formatRef(`${ref.book}.${ref.chapter}.${ref.verse}`);
</script>

{#if w}
  <section class="wotd">
    <div class="head">
      <span class="lbl">Word of the day · {lang}</span>
      <div class="right">
        <button class="search" onclick={() => (searchOpen = true)}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" />
            <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <span>Search a word</span>
        </button>
        <span class="tag">B · sense-spread</span>
      </div>
    </div>
    <div class="cols2">
      <div class="cleft">
        <div class="row"><span class="grk">{w.original}</span><PlayButton text={w.original} lang={w.lang || w.strongs} /><span class="tl">{readTranslit(w.translit)}</span></div>
        <div class="fact">Appears {w.total}× across {testamentLabel(w.strongs)}</div>
      </div>
      <div class="cright">
        {#if top}
          <div class="feature">
            <span class="gloss lead">“{top.gloss}”</span> <span class="cnt">{top.count}×</span>
            {#if def}<p class="def"><GlossedText text={def} /></p>{/if}
            {#if topOcc}<button class="occ feat-occ" onclick={() => jump(topOcc)}>Seen in {refText(topOcc.ref)} →</button>{/if}
          </div>
        {/if}
      </div>
    </div>
    {#if rest.length}
      <div class="footer">
        <span class="col-lbl">Other interpretations</span>
        <span class="col-lbl">Seen in</span>
        {#each rest as s}
          <span class="chip"><b class="gloss">“{s.gloss}”</b> <span class="cnt">{s.count}×</span></span>
          {#if s.occ}
            <button class="occ" onclick={() => jump(s.occ)}>{refText(s.occ.ref)} →</button>
          {:else}
            <span class="cnt">—</span>
          {/if}
        {/each}
      </div>
    {/if}
    <div class="cardfoot">
      <button class="occ" onclick={() => (instancesOpen = true)}>See more instances →</button>
    </div>
  </section>
{/if}

{#if searchOpen}
  <WordSearch onclose={() => (searchOpen = false)} />
{/if}

{#if instancesOpen && w}
  <WordInstances strongs={w.strongs} original={w.original} translit={w.translit} onclose={() => (instancesOpen = false)} />
{/if}

<style>
  .wotd { border: 1px solid var(--rule); border-radius: 7px; background: var(--panel); padding: 13px 15px; container-type: inline-size; }
  .head { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; margin-bottom: 6px; }
  .lbl { margin: 0; }
  .right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .search { display: inline-flex; align-items: center; gap: 6px; background: none; cursor: pointer;
    border: 1px solid var(--rule); border-radius: 6px; padding: 4px 10px; color: var(--dim);
    font-family: inherit; font-size: 11px; font-variant: small-caps; letter-spacing: .05em; }
  .search svg { flex: none; }
  .search:hover { color: var(--a); border-color: var(--a); }
  .tag { font-size: 10px; font-weight: 700; font-variant: small-caps; letter-spacing: .04em; color: var(--b); }
  /* stacked by default; two columns once the card is wide enough (word + count on the left,
     featured sense + definition on the right). "Other interpretations" spans the full width below. */
  .cols2 { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 10px; align-items: start; }
  @container (min-width: 440px) { .cols2 { grid-template-columns: auto 1fr; gap: 26px; } }
  .row { display: flex; align-items: baseline; gap: 8px; }
  .grk { font-size: 30px; color: var(--a); line-height: 1; }
  .tl { font-style: italic; color: var(--dim); font-size: 12px; }
  .fact { color: var(--dim); font-size: 12px; margin-top: 6px; }
  .feature .lead { font-size: 15px; }
  .def { margin: 3px 0 0; font-size: 12px; line-height: 1.5; color: var(--dim);
    display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  /* rows of "interpretation → the verse it's seen in": chip in the left column, verse link in the
     right, aligned under the two headers. */
  .footer { display: grid; grid-template-columns: auto 1fr; column-gap: 20px; row-gap: 10px;
    align-items: baseline; margin-top: 16px; font-size: 13px; }
  .col-lbl { color: var(--dim); }
  .chip { justify-self: start; display: inline-flex; align-items: baseline; gap: 6px;
    border: 1px solid var(--rule); border-radius: 5px; padding: 3px 9px; }
  .gloss { font-weight: 700; }
  .cnt { color: var(--dim); }
  .occ { justify-self: start; background: none; border: none; padding: 0; cursor: pointer;
    font-family: inherit; font-size: 13px; color: var(--a); text-align: left; }
  .occ:hover { text-decoration: underline; }
  .feat-occ { display: inline-block; margin-top: 8px; }
  .cardfoot { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
