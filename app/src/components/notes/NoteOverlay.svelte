<script>
  // Centered modal for reading/editing a single note. Used by the Notes tab and the
  // Home "Recent notes" widget. The parent owns persistence via onsave/ondelete.
  import NoteEditor from './NoteEditor.svelte';
  import { formatRef } from '../../lib/refs.js';
  import { openStudy } from '../../lib/router.svelte.js';
  import { noteIsEmpty } from '../../lib/markdown.js';

  let { note = null, groups = [], initialGroupId = null, onsave, ondelete, onclose } = $props();

  const isNew = note == null;
  let body = $state(note ? note.body : '');
  // '' in the <select> maps to null (No group); '__new' means "create a new group on save".
  let groupId = $state(note ? (note.group_id ?? '') : (initialGroupId ?? ''));
  // sticky-note colour 1..4 → --sy1..4 (new notes pick a random one so the board stays varied)
  let color = $state(note?.color ?? (Math.floor(Math.random() * 4) + 1));

  async function save() {
    if (noteIsEmpty(body)) return;
    await onsave?.(body, groupId === '' ? null : groupId, color);
    onclose?.();
  }
  async function remove() { await ondelete?.(); onclose?.(); }
  function jump() {
    if (!note?.ref) return;
    const [book, chapter, verse] = note.ref.split('.');
    openStudy({ version: 'NIV', book, chapter: +chapter, verse: verse ? +verse : null });
    onclose?.();
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onclose?.(); }} />
<div class="backdrop" onclick={() => onclose?.()} role="presentation"></div>
<div class="modal" role="dialog" aria-modal="true">
  {#if note?.ref}<button class="ref" onclick={jump}>{formatRef(note.ref)}{note.target_type === 'chapter' ? ' · chapter' : ''} →</button>{/if}
  <NoteEditor bind:value={body} placeholder="Write a note…" autofocus />
  <div class="swatches">
    {#each [1, 2, 3, 4] as c}
      <button class="sw" class:on={color === c} style="background: var(--sy{c})"
        onclick={() => (color = c)} aria-label={`Colour ${c}`}></button>
    {/each}
  </div>
  <div class="row">
    <label class="grp">Group
      <select bind:value={groupId}>
        <option value="">No group</option>
        {#each groups as g}<option value={g.id}>{g.name}</option>{/each}
        <option value="__new">New group…</option>
      </select>
    </label>
    <span class="spacer"></span>
    {#if !isNew}<button class="btn danger" onclick={remove}>Delete</button>{/if}
    <button class="btn" onclick={() => onclose?.()}>Cancel</button>
    <button class="btn save" onclick={save} disabled={noteIsEmpty(body)}>Save</button>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,.4); animation: fadeIn .18s ease; }
  .modal { position: fixed; z-index: 81; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(560px, calc(100vw - 40px)); max-height: calc(100vh - 80px); overflow-y: auto;
    background: var(--panel); border: 1px solid var(--rule); border-radius: 12px; padding: 16px;
    display: flex; flex-direction: column; gap: 12px; box-shadow: 0 18px 60px rgba(0,0,0,.35);
    animation: pop .2s cubic-bezier(.22,1,.36,1); }
  @keyframes fadeIn { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: translate(-50%, -48%) scale(.97); } }
  .ref { align-self: flex-start; background: none; border: none; padding: 0; cursor: pointer;
    font-size: 12px; font-variant: small-caps; letter-spacing: .04em; color: var(--a); font-family: inherit; }
  .ref:hover { text-decoration: underline; }
  .swatches { display: flex; gap: 10px; }
  .sw { width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(0,0,0,.18); cursor: pointer;
    box-shadow: 1px 1px 3px rgba(0,0,0,.12); padding: 0; transition: transform .12s ease; }
  .sw:hover { transform: scale(1.12); }
  .sw.on { outline: 2px solid var(--a); outline-offset: 2px; }
  .row { display: flex; align-items: center; gap: 8px; }
  .spacer { flex: 1; }
  .grp { font-size: 12px; color: var(--dim); display: flex; align-items: center; gap: 6px; }
  .grp select { font-family: inherit; font-size: 12.5px; padding: 4px 6px; border: 1px solid var(--rule);
    border-radius: 5px; background: var(--bg); color: var(--ink); }
  .btn { border: 1px solid var(--rule); background: transparent; color: var(--ink); border-radius: 5px;
    padding: 5px 13px; cursor: pointer; font-family: inherit; font-size: 12.5px; }
  .btn:hover:not(:disabled) { border-color: var(--a); }
  .btn.save:disabled { opacity: .4; cursor: default; }
  .btn.danger { color: #c0392b; } .btn.danger:hover { border-color: #c0392b; }
</style>
