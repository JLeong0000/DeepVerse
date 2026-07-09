<script>
  import { getWordOfDay } from '../../lib/db.js';
  import { openStudy } from '../../lib/router.svelte.js';
  import { langLabel, cleanGloss, readTranslit } from '../../lib/display.js';
  import PlayButton from '../common/PlayButton.svelte';

  const w = getWordOfDay();
  // top two distinct senses for the "behind both X and Y" line
  const senses = w ? w.senses.slice(0, 2).map(s => cleanGloss(s.gloss)) : [];
  const lang = w ? langLabel(w.lang || w.strongs) : '';
</script>

{#if w}
  <section class="wotd" onclick={() => openStudy({ ...w.ref, word: { position: w.position } })} role="button" tabindex="0">
    <div class="head">
      <span class="lbl">Word of the day</span>
      <span class="tag">B · sense-spread</span>
    </div>
    <div class="row"><span class="grk">{w.original}</span><PlayButton text={w.original} lang={w.lang || w.strongs} /><span class="tl">{readTranslit(w.translit)}</span></div>
    <div class="body">
      One {lang} word behind both <b>“{senses[0]}”</b>{#if senses[1]} and <b>“{senses[1]}”</b>{/if}.
      <span class="go">Study →</span>
    </div>
  </section>
{/if}

<style>
  .wotd { border: 1px solid var(--rule); border-radius: 7px; background: var(--panel); padding: 13px 15px; cursor: pointer; }
  .head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
  .lbl { margin: 0; }
  .tag { margin-left: auto; font-size: 10px; font-weight: 700; font-variant: small-caps; letter-spacing: .04em; color: var(--b); }
  .row { display: flex; align-items: baseline; gap: 8px; }
  .grk { font-size: 30px; color: var(--a); line-height: 1; }
  .tl { font-style: italic; color: var(--dim); font-size: 12px; }
  .body { font-size: 13px; line-height: 1.5; margin-top: 6px; }
  .go { color: var(--dim); }
</style>
