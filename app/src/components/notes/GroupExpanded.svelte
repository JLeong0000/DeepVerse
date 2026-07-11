<script>
  // Grows from the clicked folder's rect to fill the board, then fades its notes in.
  // Animates a single `transform` (translate + scale) so it stays GPU-composited and smooth,
  // rather than transitioning width/height/top/left (which thrashes layout).
  let { group, originRect, onclose, children } = $props();

  let panelEl;
  let fullW = 0, fullH = 0;
  let transform = $state('none'); // full-size at rest; set to the collapsed folder rect to animate
  let ready = $state(false);      // enables the CSS transition after the collapsed state is painted
  let expanded = $state(false);   // gates the note grid (drives the domino reveal)

  const collapsed = () => {
    const sx = originRect.width / fullW, sy = originRect.height / fullH;
    return `translate(${originRect.left}px, ${originRect.top}px) scale(${sx}, ${sy})`;
  };

  $effect(() => {
    const r = panelEl.getBoundingClientRect(); // transform is 'none' here → true full size
    fullW = r.width; fullH = r.height;
    transform = collapsed();
    requestAnimationFrame(() => {
      ready = true; // switch transition on before releasing to full size
      requestAnimationFrame(() => { transform = 'none'; expanded = true; });
    });
  });

  function close() {
    expanded = false;
    transform = collapsed();
    setTimeout(() => onclose?.(), 320);
  }
</script>

<div class="panel" class:go={ready} bind:this={panelEl} style="transform: {transform}">
  <div class="hd">
    <b>{group.name}</b>
    <button class="close" onclick={close}>Close</button>
  </div>
  {#if expanded}
    <div class="grid">{@render children?.()}</div>
  {/if}
</div>

<style>
  .panel { position: absolute; inset: 0; z-index: 20; transform-origin: 0 0; opacity: 0;
    background: var(--bg); border: 1px solid var(--rule); border-radius: 16px; overflow: hidden; }
  .panel.go { opacity: 1; transition: transform .36s cubic-bezier(.22, 1, .36, 1); }
  .hd { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--rule); }
  .hd b { font-size: 15px; }
  .close { border: 1px solid var(--rule); background: transparent; color: var(--ink); border-radius: 5px; padding: 4px 12px; cursor: pointer; font-family: inherit; font-size: 12.5px; }
  .close:hover { border-color: var(--a); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px 18px; padding: 18px; align-items: start; }
</style>
