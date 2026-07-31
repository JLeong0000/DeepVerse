<script>
  // Full-text overlay for a Tyndale dictionary article. The Context card only ever shows a clamped
  // preview — articles run to 106k characters, which would bury every section below them — so
  // "Read more" and the supplement chips both open here instead of expanding in place.
  // `focusId` scrolls straight to one embedded chart/textbox, so clicking a chart chip lands on that
  // chart with the whole article still above it to scroll back through.
  import ArticleView from './ArticleView.svelte';

  let { article, supplements = [], focusId = null, source = null, onclose } = $props();

  let bodyEl = $state(null);
  // the target is looked up by data-sid rather than bound: Svelte 5 rejects a conditional
  // bind:this, and there is one element per supplement.
  $effect(() => {
    if (!bodyEl) return;
    const target = focusId && bodyEl.querySelector(`[data-sid="${CSS.escape(focusId)}"]`);
    if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else bodyEl.scrollTop = 0;
  });
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onclose?.(); }} />
<div class="backdrop" onclick={() => onclose?.()} role="presentation"></div>
<div class="modal" role="dialog" aria-modal="true" aria-label={article.title}>
  <div class="top">
    <h2 class="mtitle">{article.title}</h2>
    <button class="close" onclick={() => onclose?.()} aria-label="Close">✕</button>
  </div>

  <div class="scroll" bind:this={bodyEl}>
    <ArticleView {article} {supplements} {source} onnavigate={() => onclose?.()} />
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.4); animation: fadeIn .18s ease; }
  .modal { position: fixed; z-index: 81; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(660px, calc(100vw - 40px)); max-height: calc(100vh - 80px);
    background: var(--panel); border: 1px solid var(--rule); border-radius: 12px;
    display: flex; flex-direction: column; box-shadow: 0 18px 60px rgba(0,0,0,.35);
    animation: pop .2s cubic-bezier(.22,1,.36,1); }
  @keyframes fadeIn { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: translate(-50%, -48%) scale(.97); } }
  .top { display: flex; align-items: baseline; gap: 10px; padding: 14px 16px 10px;
    border-bottom: 1px solid var(--rule); }
  .mtitle { margin: 0; font-size: 15px; font-weight: 600; color: var(--ink); flex: 1; }
  .close { background: transparent; border: none; color: var(--dim); font-family: inherit;
    font-size: 13px; cursor: pointer; padding: 0 2px; }
  .close:hover { color: var(--ink); }
  /* the scroll container, not the modal, so the title bar stays put while the article scrolls */
  .scroll { overflow-y: auto; padding: 12px 16px 16px; }
</style>
