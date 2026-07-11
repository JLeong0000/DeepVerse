<script>
  let { group, originRect, onclose, children } = $props();

  let expanded = $state(false);
  $effect(() => { requestAnimationFrame(() => (expanded = true)); });
  function close() { expanded = false; setTimeout(() => onclose?.(), 320); }

  const style = $derived(expanded
    ? 'top:0; left:0; width:100%; height:100%;'
    : `top:${originRect.top}px; left:${originRect.left}px; width:${originRect.width}px; height:${originRect.height}px;`);
</script>

<div class="panel" style={style}>
  <div class="hd">
    <b>{group.name}</b>
    <button class="close" onclick={close}>Close</button>
  </div>
  {#if expanded}
    <div class="grid">{@render children?.()}</div>
  {/if}
</div>

<style>
  .panel { position: absolute; z-index: 20; background: var(--bg); border: 1px solid var(--rule);
    border-radius: 16px; overflow: hidden; transition: top .32s cubic-bezier(.22,1,.36,1),
      left .32s cubic-bezier(.22,1,.36,1), width .32s cubic-bezier(.22,1,.36,1), height .32s cubic-bezier(.22,1,.36,1); }
  .hd { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--rule); }
  .close { border: 1px solid var(--rule); background: transparent; color: var(--ink); border-radius: 5px; padding: 4px 12px; cursor: pointer; font-family: inherit; font-size: 12.5px; }
  .close:hover { border-color: var(--a); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; padding: 16px; align-items: start; }
</style>
