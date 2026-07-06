<script>
  let { title, sub = '', hotkey, open = false, onToggle, index,
        onDragStart, onDragOver, onDrop, children } = $props();
</script>

<div class="card" class:open
  draggable="true"
  ondragstart={(e) => onDragStart(index, e)}
  ondragover={(e) => { e.preventDefault(); onDragOver(index); }}
  ondrop={(e) => { e.preventDefault(); onDrop(index); }}>
  <div class="hd" onclick={onToggle} role="button" tabindex="0">
    <span class="grip" title="Drag to reorder">⠿</span>
    {#if !open}<span class="tw">▸</span>{/if}
    <span class="title">{title}</span>
    {#if sub}<span class="sub">{sub}</span>{/if}
    <span class="k">{hotkey}</span>
  </div>
  {#if open}
    <div class="body">{@render children?.()}</div>
  {/if}
</div>

<style>
  .card { border: 1px solid var(--rule); background: var(--panel); border-radius: 5px; }
  .hd { display: flex; align-items: center; gap: 6px; padding: 7px 10px; font-variant: small-caps;
    letter-spacing: .05em; font-size: 12.5px; color: var(--dim); cursor: pointer; }
  .card.open .hd { border-bottom: 1px solid var(--rule); }
  .grip { cursor: grab; opacity: .4; font-variant: normal; letter-spacing: 0; }
  .tw { opacity: .5; font-variant: normal; }
  .title { color: var(--ink); }
  .sub { margin-left: 8px; font-variant: normal; letter-spacing: 0; opacity: .7; font-size: .92em; }
  .k { margin-left: auto; opacity: .55; font-variant: normal; border: 1px solid var(--rule); border-radius: 3px;
    min-width: 15px; text-align: center; padding: 0 3px; font-size: .85em; }
  .body { padding: 0; }
</style>
