<script>
  import { applyFormat } from '../../lib/markdown.js';
  let { value = $bindable(''), placeholder = 'Add a note… (markdown)', onsave, autofocus = false } = $props();
  let ta;
  // apply formatting without losing focus/selection (mousedown-preventDefault keeps the textarea focused)
  function fmt(type) { applyFormat(ta, type); value = ta.value; }
  const tools = [
    ['bold', 'B', 'Bold', 'b'], ['italic', 'I', 'Italic', 'i'], ['heading', 'H', 'Heading', 'h'],
    ['bullet', '•', 'Bullet list', 'b2'], ['number', '1.', 'Numbered list', 'n'], ['code', '‹›', 'Code', 'c'],
  ];
</script>

<div class="editor">
  <div class="toolbar" role="toolbar">
    {#each tools as [type, label, title]}
      <button class="tb {type}" {title} onmousedown={(e) => e.preventDefault()} onclick={() => fmt(type)}>{label}</button>
    {/each}
  </div>
  <!-- svelte-ignore a11y_autofocus -->
  <textarea bind:this={ta} bind:value {placeholder} {autofocus}
    onblur={() => onsave?.()}></textarea>
</div>

<style>
  .editor { display: flex; flex-direction: column; border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; background: var(--bg); }
  .toolbar { display: flex; gap: 2px; padding: 4px 5px; border-bottom: 1px solid var(--rule);
    background: color-mix(in srgb, var(--panel) 60%, var(--bg)); }
  .tb { min-width: 24px; height: 22px; border: 1px solid transparent; border-radius: 4px; background: transparent;
    color: var(--ink); cursor: pointer; font-family: inherit; font-size: 12px; line-height: 1; }
  .tb:hover { border-color: var(--rule); background: var(--bg); }
  .tb.bold { font-weight: 700; } .tb.italic { font-style: italic; } .tb.heading { font-weight: 700; }
  textarea { font-family: inherit; font-size: 13px; line-height: 1.5; padding: 8px 9px; border: none; outline: none;
    background: transparent; color: var(--ink); resize: vertical; min-height: 54px; }
</style>
