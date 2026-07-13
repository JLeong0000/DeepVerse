<script>
  // "See other instances" overlay for the Original card: every verse a word appears in,
  // grouped by English sense, excluding the current verse. Reuses getWordSenses + SenseVerses.
  import { getWordSenses } from '../../lib/db.js';
  import { openStudy } from '../../lib/router.svelte.js';
  import SenseVerses from '../common/SenseVerses.svelte';

  let { strongs, original, ref, onclose } = $props();

  // drop the current verse from each sense, then any sense left empty — "other" instances
  const senses = getWordSenses(strongs).senses
    .map(s => {
      const occurrences = s.occurrences.filter(o =>
        !(o.ref.book === ref.book && o.ref.chapter === ref.chapter && o.ref.verse === ref.verse));
      return { gloss: s.gloss, count: occurrences.length, occurrences };
    })
    .filter(s => s.count > 0);
  const total = senses.reduce((n, s) => n + s.count, 0);

  function jump(occ) {
    openStudy({ ...occ.ref, word: { position: occ.position } });
    onclose?.();
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onclose?.(); }} />
<div class="backdrop" onclick={() => onclose?.()} role="presentation"></div>
<div class="modal" role="dialog" aria-modal="true">
  <div class="mhead"><span class="orig">{original}</span> <span class="ttl">other instances · {total}</span></div>
  <SenseVerses {senses} onjump={jump} />
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.4); animation: fadeIn .18s ease; }
  .modal { position: fixed; z-index: 81; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(560px, calc(100vw - 40px)); max-height: calc(100vh - 80px); overflow-y: auto;
    background: var(--panel); border: 1px solid var(--rule); border-radius: 12px; padding: 16px;
    display: flex; flex-direction: column; gap: 14px; box-shadow: 0 18px 60px rgba(0,0,0,.35);
    animation: pop .2s cubic-bezier(.22,1,.36,1); }
  @keyframes fadeIn { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: translate(-50%, -48%) scale(.97); } }
  .mhead { display: flex; align-items: baseline; gap: 10px; }
  .orig { font-size: 24px; color: var(--a); line-height: 1; }
  .ttl { color: var(--dim); font-size: 11px; font-variant: small-caps; letter-spacing: .05em; }
</style>
