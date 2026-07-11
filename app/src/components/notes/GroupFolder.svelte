<script>
  import { noteHtml } from '../../lib/markdown.js';
  let { group, notes = [], renaming = false, onopen, onrename, onrenamedone, oncontextmenu } = $props();

  let editing = $state(false);
  let nameBuf = $state('');
  const slots = $derived(notes.slice(0, 4));
  const overflow = $derived(Math.max(0, notes.length - 4));

  $effect(() => { if (renaming && !editing) { nameBuf = group.name; editing = true; } });

  function startRename(e) { e.stopPropagation(); nameBuf = group.name; editing = true; }
  function commit() {
    editing = false;
    const v = nameBuf.trim();
    if (v && v !== group.name) onrename?.(v);
    onrenamedone?.();
  }
</script>

<div class="folder" oncontextmenu={(e) => { e.preventDefault(); oncontextmenu?.(e); }}>
  <button class="square" onclick={() => onopen?.()} aria-label={`Open ${group.name}`}>
    <div class="grid">
      {#each Array(4) as _, i}
        <div class="slot" class:filled={!!slots[i]}>
          {#if slots[i]}<div class="mini md">{@html noteHtml(slots[i].body)}</div>{/if}
        </div>
      {/each}
    </div>
    {#if overflow > 0}<span class="more">+{overflow}</span>{/if}
  </button>

  {#if editing}
    <input class="name-edit" bind:value={nameBuf} autofocus
      onclick={(e) => e.stopPropagation()}
      onblur={commit} onkeydown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { editing = false; onrenamedone?.(); } }} />
  {:else}
    <button class="name" onclick={startRename}>{group.name}</button>
  {/if}
</div>

<style>
  .folder { display: flex; flex-direction: column; align-items: center; gap: 7px; }
  .square { width: 100%; aspect-ratio: 1 / 1; position: relative; border: 1px solid var(--rule); border-radius: 18px;
    background: color-mix(in srgb, var(--panel) 70%, var(--bg)); padding: 12%; cursor: pointer; }
  .square:hover { border-color: var(--a); }
  .grid { width: 100%; height: 100%; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 8%; }
  .slot { border-radius: 22%; background: color-mix(in srgb, var(--rule) 40%, transparent);
    border: 1px dashed color-mix(in srgb, var(--rule) 80%, transparent); overflow: hidden; }
  .slot.filled { background: var(--panel); border-style: solid; }
  .mini { font-size: 6px; line-height: 1.25; padding: 4px; color: var(--ink); overflow: hidden; }
  .mini :global(p) { margin: 0; }
  .more { position: absolute; right: 8px; bottom: 8px; font-size: 10px; color: var(--dim);
    background: var(--bg); border-radius: 8px; padding: 0 5px; }
  .name, .name-edit { font-family: inherit; font-size: 12.5px; color: var(--ink); text-align: center; }
  .name { background: none; border: none; cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name:hover { color: var(--a); }
  .name-edit { border: 1px solid var(--a); border-radius: 4px; padding: 1px 6px; background: var(--bg); width: 90%; }
</style>
