<script>
  // Centered modal for reading/editing a single note. Used by the Notes tab and the
  // Home "Recent notes" widget. The parent owns persistence via onsave/ondelete.
  import NoteEditor from './NoteEditor.svelte';
  import { formatRef } from '../../lib/refs.js';
  import { noteIsEmpty } from '../../lib/markdown.js';

  let { note = null, groups = [], initialGroupId = null, onsave, ondelete, onclose } = $props();

  const isNew = note == null;
  let body = $state(note ? note.body : '');
  // '' in the <select> maps to null (No group); '__new' means "create a new group on save".
  let groupId = $state(note ? (note.group_id ?? '') : (initialGroupId ?? ''));

  async function save() {
    if (noteIsEmpty(body)) return;
    await onsave?.(body, groupId === '' ? null : groupId);
    onclose?.();
  }
  async function remove() { await ondelete?.(); onclose?.(); }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onclose?.(); }} />
<div class="backdrop" onclick={() => onclose?.()} role="presentation"></div>
<div class="modal" role="dialog" aria-modal="true">
  {#if note?.ref}<div class="ref">{formatRef(note.ref)}{note.target_type === 'chapter' ? ' · chapter' : ''}</div>{/if}
  <NoteEditor bind:value={body} placeholder="Write a note…" autofocus />
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
  .ref { font-size: 12px; font-variant: small-caps; letter-spacing: .04em; color: var(--a); }
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
