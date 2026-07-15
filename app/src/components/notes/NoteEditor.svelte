<script>
  // WYSIWYG note editor: you edit the formatted text directly (no raw markdown). Stored as HTML.
  import { noteHtml, noteIsEmpty } from '../../lib/markdown.js';
  let { value = $bindable(''), placeholder = 'Add a memo…', onsave, autofocus = false } = $props();

  let el;
  let inited = false;
  let empty = $state(noteIsEmpty(value));

  $effect(() => {
    if (el && !inited) {
      el.innerHTML = noteHtml(value);
      inited = true;
      if (autofocus) el.focus();
    }
  });

  function sync() { value = el.innerHTML; empty = noteIsEmpty(el.innerHTML); }
  // execCommand keeps things simple + widely supported; mousedown-preventDefault keeps the selection.
  function cmd(command, arg = null) { el.focus(); document.execCommand(command, false, arg); sync(); }

  const tools = [
    ['bold', 'B', 'Bold', () => cmd('bold')],
    ['italic', 'I', 'Italic', () => cmd('italic')],
    ['heading', 'H', 'Heading', () => cmd('formatBlock', 'H3')],
    ['bullet', '•', 'Bullet list', () => cmd('insertUnorderedList')],
    ['number', '1.', 'Numbered list', () => cmd('insertOrderedList')],
  ];
</script>

<div class="editor">
  <div class="toolbar" role="toolbar">
    {#each tools as [type, label, title, action]}
      <button class="tb {type}" {title} onmousedown={(e) => e.preventDefault()} onclick={action}>{label}</button>
    {/each}
  </div>
  <div class="wysiwyg md" class:empty contenteditable="true" bind:this={el}
    data-ph={placeholder} oninput={sync} onblur={() => onsave?.()} role="textbox" tabindex="0"></div>
</div>

<style>
  .editor { display: flex; flex-direction: column; border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; background: var(--bg); }
  .toolbar { display: flex; gap: 2px; padding: 4px 5px; border-bottom: 1px solid var(--rule);
    background: color-mix(in srgb, var(--panel) 60%, var(--bg)); }
  .tb { min-width: 24px; height: 22px; border: 1px solid transparent; border-radius: 4px; background: transparent;
    color: var(--ink); cursor: pointer; font-family: inherit; font-size: 12px; line-height: 1; }
  .tb:hover { border-color: var(--rule); background: var(--bg); }
  .tb.bold { font-weight: 700; } .tb.italic { font-style: italic; } .tb.heading { font-weight: 700; }
  .wysiwyg { font-size: 13px; line-height: 1.5; padding: 8px 9px; outline: none; min-height: 50px; color: var(--ink); }
  .wysiwyg.empty::before { content: attr(data-ph); color: var(--dim); pointer-events: none; }
  /* formatted content */
  .md :global(p) { margin: 0 0 6px; } .md :global(p:last-child) { margin-bottom: 0; }
  .md :global(ul), .md :global(ol) { margin: 4px 0; padding-left: 20px; } .md :global(li) { margin: 2px 0; }
  .md :global(h3), .md :global(h4), .md :global(h5) { margin: 6px 0 4px; font-size: 1.05em; font-weight: 700; }
  .md :global(strong) { font-weight: 700; } .md :global(em) { font-style: italic; }
</style>
