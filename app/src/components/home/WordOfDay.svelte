<script>
  import { getWordOfDay, getLexicon } from '../../lib/db.js';
  import { langLabel, cleanGloss, readTranslit, testamentLabel, parseDefinition } from '../../lib/display.js';
  import PlayButton from '../common/PlayButton.svelte';

  const w = getWordOfDay();
  const lang = w ? langLabel(w.lang || w.strongs) : '';
  // senses come sorted by count desc: [0] is the most-appeared translation, the rest are "other interpretations"
  const senses = w ? w.senses.map(s => ({ gloss: cleanGloss(s.gloss), count: s.count })) : [];
  const top = senses[0];
  const rest = senses.slice(1);
  // full dictionary definition as flowing text (drop the outline markers, join senses with "; ")
  const def = w ? parseDefinition(getLexicon(w.strongs)?.definition).map(r => r.text).join('; ').replace(/^[:;\s]+/, '') : '';
</script>

{#if w}
  <section class="wotd">
    <div class="head">
      <span class="lbl">Word of the day · {lang}</span>
      <span class="tag">B · sense-spread</span>
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
            {#if def}<p class="def">{def}</p>{/if}
          </div>
        {/if}
      </div>
    </div>
    {#if rest.length}
      <div class="others">
        <span class="others-lbl">Other interpretations:</span>
        {#each rest as s}<span class="chip"><b class="gloss">“{s.gloss}”</b> <span class="cnt">{s.count}×</span></span>{/each}
      </div>
    {/if}
  </section>
{/if}

<style>
  .wotd { border: 1px solid var(--rule); border-radius: 7px; background: var(--panel); padding: 13px 15px; container-type: inline-size; }
  .head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
  .lbl { margin: 0; }
  .tag { margin-left: auto; font-size: 10px; font-weight: 700; font-variant: small-caps; letter-spacing: .04em; color: var(--b); }
  /* stacked by default; two columns once the card is wide enough (word + count on the left,
     featured sense + definition on the right). "Other interpretations" spans the full width below. */
  .cols2 { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 10px; align-items: start; }
  @container (min-width: 440px) { .cols2 { grid-template-columns: auto 1fr; gap: 26px; } }
  .row { display: flex; align-items: baseline; gap: 8px; }
  .grk { font-size: 30px; color: var(--a); line-height: 1; }
  .tl { font-style: italic; color: var(--dim); font-size: 12px; }
  .fact { color: var(--dim); font-size: 12px; margin-top: 6px; }
  .feature .lead { font-size: 15px; }
  .def { margin: 3px 0 0; font-size: 12px; line-height: 1.5; color: var(--dim); }
  .others { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; font-size: 13px; }
  .others-lbl { color: var(--dim); }
  .chip { display: inline-flex; align-items: baseline; gap: 6px; border: 1px solid var(--rule); border-radius: 5px; padding: 3px 9px; }
  .gloss { font-weight: 700; }
  .cnt { color: var(--dim); }
</style>
