<script>
  import { fade } from 'svelte/transition';
  import { noteHtml } from '../../lib/markdown.js';
  import { formatRef } from '../../lib/refs.js';
  let { group, notes = [], originRect, onclose } = $props();

  let expanded = $state(false);
  $effect(() => { requestAnimationFrame(() => (expanded = true)); });

  const style = $derived(expanded
    ? 'top:0; left:0; width:100%; height:100%;'
    : `top:${originRect.top}px; left:${originRect.left}px; width:${originRect.width}px; height:${originRect.height}px;`);
</script>

<div class="panel" style={style}>
  <div class="hd">
    <b>{group.name}</b>
    <button class="close" onclick={() => onclose?.()}>Close</button>
  </div>
  {#if expanded}
    <div class="grid">
      {#each notes as note, i (note.id)}
        <div class="sticky" in:fade={{ duration: 200, delay: i * 60 }}>
          <div class="r">{note.ref ? formatRef(note.ref) : 'Note'}</div>
          <div class="body md">{@html noteHtml(note.body)}</div>
        </div>
      {/each}
      {#if notes.length === 0}<p class="empty">This group is empty.</p>{/if}
    </div>
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
  .sticky { background: var(--panel); border: 1px solid var(--rule); border-radius: 6px; padding: 11px 12px 10px; }
  .r { font-size: 12px; font-variant: small-caps; letter-spacing: .04em; color: var(--a); margin-bottom: 6px; }
  .body.md { font-size: 13px; line-height: 1.5; color: var(--ink); }
  .empty { color: var(--dim); font-style: italic; }
  .md :global(p) { margin: 0 0 6px; } .md :global(p:last-child) { margin-bottom: 0; }
</style>
