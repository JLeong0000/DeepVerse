<script>
  let { x = 0, y = 0, items = [], onclose } = $props();
  let openSub = $state(null); // index of item whose submenu is open

  function run(item) {
    if (item.disabled || item.submenu) return;
    item.action?.();
    onclose?.();
  }
  function onKey(e) { if (e.key === 'Escape') onclose?.(); }
</script>

<svelte:window onkeydown={onKey} />
<!-- backdrop swallows the outside click that dismisses the menu -->
<div class="backdrop" onpointerdown={() => onclose?.()} oncontextmenu={(e) => { e.preventDefault(); onclose?.(); }}></div>

<div class="menu" style="left:{x}px; top:{y}px" onpointerdown={(e) => e.stopPropagation()}>
  {#each items as item, i}
    <div class="row" class:danger={item.danger} class:disabled={item.disabled}
      role="menuitem" tabindex="0"
      onmouseenter={() => (openSub = item.submenu ? i : null)}
      onclick={() => run(item)}>
      <span>{item.label}</span>
      {#if item.submenu}<span class="chev">▸</span>{/if}
      {#if item.submenu && openSub === i}
        <div class="menu sub">
          {#each item.submenu as sub}
            <div class="row" class:danger={sub.danger} role="menuitem" tabindex="0"
              onclick={(e) => { e.stopPropagation(); sub.action?.(); onclose?.(); }}>{sub.label}</div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 60; }
  .menu { position: fixed; z-index: 61; min-width: 168px; background: var(--panel); border: 1px solid var(--rule);
    border-radius: 8px; padding: 4px; box-shadow: 0 8px 30px rgba(0,0,0,.28); font-size: 13px; }
  .row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 6px 10px; border-radius: 5px; color: var(--ink); cursor: pointer; white-space: nowrap; }
  .row:hover { background: color-mix(in srgb, var(--a) 16%, transparent); }
  .row.danger { color: #c0392b; } .row.disabled { opacity: .4; cursor: default; }
  .chev { opacity: .6; font-size: 11px; }
  .menu.sub { position: absolute; left: 100%; top: -5px; margin-left: 2px; }
</style>
