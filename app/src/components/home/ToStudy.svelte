<script>
  import { activeStudy, addStudy, editStudy, deleteStudy, setStudyDone, archiveStudy } from '../../lib/store.js';
  import ArchiveModal from './ArchiveModal.svelte';

  let items = $state(activeStudy());
  let showArchive = $state(false);
  const timers = new Map(); // id -> timeout

  function refresh() { items = activeStudy(); }

  function toggle(item) {
    const done = !item.done;
    setStudyDone(item.id, done);
    item.done = done;
    if (done) {
      timers.set(item.id, setTimeout(() => { archiveStudy(item.id); timers.delete(item.id); refresh(); }, 3000));
    } else {
      clearTimeout(timers.get(item.id)); timers.delete(item.id);
    }
  }
  function commitEdit(item, e) {
    const text = e.target.textContent.trim();
    if (!text) { deleteStudy(item.id); refresh(); } else { editStudy(item.id, text); }
  }
  function addNew(e) {
    const text = e.target.textContent.trim();
    e.target.textContent = '';
    if (text) { addStudy(text); refresh(); }
  }
</script>

<div class="studyhead">
  <span class="lbl">To study</span>
  <span class="viewpast" onclick={() => (showArchive = true)} role="button" tabindex="0">View past items →</span>
</div>
<div class="list">
  {#each items as item (item.id)}
    <div class="item" class:done={item.done}>
      <span class="box" class:on={item.done} onclick={() => toggle(item)} role="checkbox" aria-checked={item.done} tabindex="0">✓</span>
      <span class="txt" contenteditable="true" spellcheck="false" onblur={(e) => commitEdit(item, e)}>{item.text}</span>
    </div>
  {/each}
</div>
<div class="add" contenteditable="true" spellcheck="false"
  data-ph="+ add something to study…"
  onfocus={(e) => { if (e.target.dataset.p !== '1') { e.target.textContent = ''; e.target.dataset.p = '1'; } }}
  onblur={addNew}></div>

<ArchiveModal open={showArchive} onclose={() => (showArchive = false)} />

<style>
  .studyhead { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
  .studyhead .lbl { margin: 0; }
  .viewpast { font-size: 11px; color: var(--b); cursor: pointer; }
  .viewpast:hover { text-decoration: underline; }
  .item { display: flex; align-items: flex-start; gap: 9px; padding: 6px 0; border-bottom: 1px dashed var(--rule); }
  .box { width: 14px; height: 14px; border: 1px solid var(--dim); border-radius: 3px; flex: none; margin-top: 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; color: transparent; }
  .box.on { background: var(--a); border-color: var(--a); color: var(--bg); }
  .txt { font-size: 13px; line-height: 1.4; cursor: text; outline: none; flex: 1; }
  .item.done .txt { text-decoration: line-through; opacity: .45; }
  .add { color: var(--dim); font-style: italic; font-size: 12.5px; padding: 9px 0 0; cursor: text; outline: none; }
  .add:empty::before { content: attr(data-ph); }
</style>
