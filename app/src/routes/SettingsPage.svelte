<script>
  import { exportNotes, importNotes, exportProfile, importProfile } from '../lib/store.js';

  let profileInput, notesInput;

  function download(text, name) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    a.click(); URL.revokeObjectURL(url);
  }
  const stamp = () => new Date().toISOString().slice(0, 10);

  async function exportProfileFile() {
    download(await exportProfile(), `deepverse-profile-${stamp()}.json`);
  }
  async function importProfileFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { notes, settings } = await importProfile(await file.text());
    e.target.value = '';
    alert(`Imported ${notes} note${notes === 1 ? '' : 's'} and ${settings} setting${settings === 1 ? '' : 's'}. Reloading to apply.`);
    location.reload();
  }

  async function exportNotesFile() {
    download(await exportNotes(), `deepverse-notes-${stamp()}.json`);
  }
  async function importNotesFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const n = await importNotes(await file.text());
    e.target.value = '';
    alert(`Imported ${n} note${n === 1 ? '' : 's'}.`);
  }
</script>

<div class="scroll"><div class="page">
  <h1>Settings</h1>

  <section>
    <h2>Profile</h2>
    <p class="note">A full backup of everything on this device — memos and all your settings (theme,
      reading activity, to-study list, note groups). Use it to move your data to another browser or an
      installed app, which each keep their own separate storage. Import merges into what's already here.</p>
    <div class="actions">
      <button class="btn" onclick={exportProfileFile}>Export Profile</button>
      <button class="btn" onclick={() => profileInput.click()}>Import Profile</button>
      <input type="file" accept="application/json" bind:this={profileInput} onchange={importProfileFile} hidden />
    </div>
  </section>

  <section>
    <h2>Notes</h2>
    <p class="note">Just your memos, without any settings.</p>
    <div class="actions">
      <button class="btn" onclick={exportNotesFile}>Export Notes</button>
      <button class="btn" onclick={() => notesInput.click()}>Import Notes</button>
      <input type="file" accept="application/json" bind:this={notesInput} onchange={importNotesFile} hidden />
    </div>
  </section>
</div></div>

<style>
  .scroll { flex: 1; min-height: 0; overflow-y: auto; }
  .page { padding: 20px 30px 40px; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 26px; font-weight: normal; margin: 0 0 32px; }
  section { margin-bottom: 40px; }
  h2 { font-size: 15px; font-weight: normal; font-variant: small-caps; letter-spacing: .06em; color: var(--a); margin: 0 0 8px; }
  .note { color: var(--dim); font-size: 13px; line-height: 1.6; margin: 0 0 16px; max-width: 62ch; }
  .actions { display: flex; gap: 10px; }
  .btn { border: 1px solid var(--rule); background: transparent; color: var(--ink); border-radius: 5px; padding: 6px 14px; cursor: pointer; font-family: inherit; font-size: 12.5px; }
  .btn:hover { border-color: var(--a); }
</style>
