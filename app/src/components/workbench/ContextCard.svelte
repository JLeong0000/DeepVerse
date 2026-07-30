<script>
  import { onMount } from 'svelte';
  import { getCrossRefs, getChapterCrossRefStats, getRefPreview,
    getChapterContext, getChapterEntities, getChapterRecap,
    getStudyNotes, getChapterStudyNoteCount,
    getBookIntro, getTyndalePassages, getDictCountForVerse } from '../../lib/db.js';
  import { study, goToPassage } from '../../lib/study.svelte.js';
  import { formatRef, formatCrossRef, bookName, bookOrder } from '../../lib/refs.js';
  import { getPref, setPref } from '../../lib/store.js';

  const CAP = 4;
  let tab = $state('context'); // 'xrefs' | 'context'; default to the context view.
  let chapStats = $derived(getChapterCrossRefStats(study.book, study.chapter));
  // each section shows CAP refs; "see more" expands it. Collapse both when the verse changes.
  let expanded = $state({ nt: false, ot: false });
  $effect(() => { study.book; study.chapter; study.verse; expanded.nt = false; expanded.ot = false; });

  // cross-refs for the verse, each with a NIV preview, grouped into NT / OT.
  let groups = $derived.by(() => {
    if (study.verse == null) return [];
    const refs = getCrossRefs(study.book, study.chapter, study.verse).map(r => ({
      to_ref: r.to_ref,
      votes: r.votes,
      firstRef: r.to_ref.split('-')[0],
      preview: getRefPreview(r.to_ref),
    }));
    const ot = refs.filter(r => bookOrder(r.firstRef.split('.')[0]) < 39);
    const nt = refs.filter(r => bookOrder(r.firstRef.split('.')[0]) >= 39);
    return [['New Testament', 'nt', nt], ['Old Testament', 'ot', ot]].filter(([, , list]) => list.length);
  });
  let total = $derived(study.verse == null ? 0 : getCrossRefs(study.book, study.chapter, study.verse).length);

  function jump(firstRef) {
    const [book, chapter, verse] = firstRef.split('.');
    if (book && chapter) goToPassage({ book, chapter: +chapter, verse: verse ? +verse : null });
  }

  // --- Context tab (chapter-level, so it renders with or without a verse selected) ---
  let ctx = $derived(getChapterContext(study.book, study.chapter));
  // per-chapter recap (a plain summary from Bible Summary), shown first. Long ones collapse.
  const RECAP_SRC = { 'bible-summary': 'Bible Summary', 'matthew-henry': 'Matthew Henry', 'adam-clarke': 'Adam Clarke', editorial: 'DeepVerse' };
  const RECAP_CLAMP = 280; // collapsed length ~3 lines
  let recap = $derived(getChapterRecap(study.book, study.chapter));
  let recapOpen = $state(false);
  let introOpen = $state(false);
  $effect(() => { study.book; study.chapter; recapOpen = false; introOpen = false; });
  let entities = $derived.by(() => {
    const byType = { person: [], place: [], event: [], group: [] };
    for (const e of getChapterEntities(study.book, study.chapter)) (byType[e.entity_type] ||= []).push(e);
    return byType;
  });
  // c. 2245 BC / c. 30 AD from a signed year (negative = BC).
  function yearLabel(y) {
    if (y == null) return '';
    return y < 0 ? `c. ${-y} BC` : `c. ${y} AD`;
  }

  let noteCount = $derived(getChapterStudyNoteCount(study.book, study.chapter));
  let studyNotes = $derived(study.verse == null ? [] : getStudyNotes(study.book, study.chapter, study.verse));

  // --- Tyndale cultural layer ---
  let bookIntro = $derived(getBookIntro(study.book));
  let themes = $derived(study.verse == null ? []
    : getTyndalePassages('theme', study.book, study.chapter, study.verse));
  let profiles = $derived(study.verse == null ? []
    : getTyndalePassages('profile', study.book, study.chapter, study.verse));
  let dictCount = $derived(study.verse == null ? 0
    : getDictCountForVerse(study.book, study.chapter, study.verse));

  // Collapsible sections. Keys are bound to fixed sections so a hotkey never shifts meaning
  // as counts change. Order here is display order.
  const SECTIONS = [
    { id: 'intro', key: 'q', label: 'Book introduction' },
    { id: 'recap', key: 'w', label: 'Recap' },
    { id: 'entities', key: 'e', label: 'People, places, events' },
    { id: 'notes', key: 'r', label: 'Study notes' },
    { id: 'themes', key: 't', label: 'Themes' },
    { id: 'profiles', key: 'y', label: 'Profiles' },
    { id: 'dict', key: 'u', label: 'Dictionary' },
  ];
  const DEFAULT_OPEN = { intro: false, recap: true, entities: false,
    notes: true, themes: false, profiles: false, dict: false };
  let sec = $state({ ...DEFAULT_OPEN, ...getPref('contextSections', {}) });
  $effect(() => { setPref('contextSections', sec); });

  // count per section — a section with 0 renders its header but cannot expand
  let counts = $derived({
    intro: bookIntro ? 1 : 0,
    recap: recap ? 1 : 0,
    entities: entities.person.length + entities.place.length
      + entities.event.length + entities.group.length,
    notes: studyNotes.length,
    themes: themes.length,
    profiles: profiles.length,
    dict: dictCount,
  });

  function toggleSec(id) { if (counts[id] > 0) sec[id] = !sec[id]; }

  // Hotkeys are live only while this card is open AND the Context tab is showing, so they never
  // fire from the Cross-references tab or a collapsed card. Letters, because Workbench owns 1..n.
  function onKey(e) {
    if (tab !== 'context') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const hit = SECTIONS.find(s => s.key === e.key.toLowerCase());
    if (!hit) return;
    toggleSec(hit.id);   // no-op when the section is empty
    e.preventDefault();
  }
  onMount(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="tabs">
  <button class="tab" class:on={tab === 'context'} onclick={() => (tab = 'context')}>Context</button>
  <button class="tab" class:on={tab === 'xrefs'} onclick={() => (tab = 'xrefs')}>Cross-references</button>
</div>

{#snippet secHeader(id, label, extra = '')}
  {@const n = counts[id]}
  <button class="sechd" onclick={() => toggleSec(id)} disabled={n === 0}>
    <span class="caret" class:open={sec[id]}>›</span>
    <span class="seclbl">{label}</span>
    {#if n > 0 && extra !== 'noCount'}<span class="secn">· {n}</span>{/if}
    <span class="seckey">{SECTIONS.find(s => s.id === id).key}</span>
  </button>
{/snippet}

{#if tab === 'xrefs'}
  {#if study.verse == null}
    <div class="empty">Select a verse.</div>
  {:else}
    <div class="hd">
      <span class="q">ⓘ</span> Passages that connect to <b>{bookName(study.book)} {study.chapter}:{study.verse}</b>
      <span class="sub">· {total} cross-references, ranked by relevance</span>
      <div class="tip">
        Cross-references are curated links between passages that quote, echo, or teach the same thing —
        a NT verse pointing back to the OT it fulfils, gospel parallels, a shared theme. They are not the
        Bible referencing itself; they come from <b>OpenBible.info</b>’s community-compiled dataset, and the
        number is how many people voted a link relevant (higher = stronger). Click one to jump there.
      </div>
    </div>
    {#if groups.length === 0}
      <div class="empty">No cross-references for this verse.</div>
    {:else}
      {#each groups as [label, key, list]}
        <div class="grp">
          <div class="grplbl">{label}</div>
          {#each (expanded[key] ? list : list.slice(0, CAP)) as r}
            <button class="xref" onclick={() => jump(r.firstRef)}>
              <span class="rtop"><span class="ref">{formatCrossRef(r.to_ref)}</span>
                {#if r.votes > 0}<span class="votes" title="community relevance votes">{r.votes}</span>{/if}</span>
              {#if r.preview}<span class="prev">{r.preview.length > 120 ? r.preview.slice(0, 120) + '…' : r.preview}</span>{/if}
            </button>
          {/each}
          {#if list.length > CAP}
            <button class="seemore" onclick={() => (expanded[key] = !expanded[key])}>
              {expanded[key] ? 'See less' : `See ${list.length - CAP} more`}
            </button>
          {/if}
        </div>
      {/each}
    {/if}
    <div class="l2">Whole chapter: {chapStats.total} cross-references across {chapStats.versesWithRefs} verses.</div>
  {/if}
{:else}
  {@render secHeader('intro', 'Book introduction')}
  {#if sec.intro && bookIntro}
    <div class="grp">
      <p class="recaptext">{bookIntro.summary}</p>
      <p class="recaptext introfull">{introOpen ? bookIntro.intro
        : bookIntro.intro.slice(0, RECAP_CLAMP).trimEnd() + '…'}</p>
      <button class="seemore" onclick={() => (introOpen = !introOpen)}>
        {introOpen ? 'Read less' : 'Read the full introduction'}</button>
    </div>
  {/if}

  {@render secHeader('recap', 'Recap', 'noCount')}
  {#if sec.recap && recap}
    {@const long = recap.recap.length > RECAP_CLAMP}
    <div class="grp recap">
      <div class="grplbl">Recap<span class="srcinfo">ⓘ<span class="srctip">
        {#if recap.source === 'bible-summary'}
          <a href="https://biblesummary.info" target="_blank" rel="noopener">Bible Summary · biblesummary.info</a>
        {:else}{RECAP_SRC[recap.source] || recap.source}{/if}
      </span></span></div>
      <p class="recaptext">{long && !recapOpen ? recap.recap.slice(0, RECAP_CLAMP).trimEnd() + '…' : recap.recap}</p>
      {#if long}
        <button class="seemore" onclick={() => (recapOpen = !recapOpen)}>{recapOpen ? 'Read less' : 'Read more'}</button>
      {/if}
    </div>
  {/if}

  {@render secHeader('entities', 'People, places, events')}
  {#if sec.entities}
    <div class="hd">
      Context for <b>{bookName(study.book)} {study.chapter}</b> <span class="q">ⓘ</span>
      {#if ctx?.writer}<span class="sub">· traditionally attributed to {ctx.writer}</span>{/if}
      <div class="tip">
        This context is auto-linked from the
        <b>Theographic Bible Metadata</b> knowledge graph
        (CC BY-SA 4.0): the people, places, and events named in this chapter’s verses. Auto-linked, so it
        can occasionally mis-tag a name shared by a person and a place (e.g. “Moab” or “Judah”), and dates
        are approximate traditional chronology.
      </div>
    </div>

    {#if !entities.person.length && !entities.place.length && !entities.event.length && !entities.group.length}
      <div class="empty">No linked people, places, or events in this chapter.</div>
    {:else}
      {#if entities.person.length}
        <div class="grp">
          <div class="grplbl">People · {entities.person.length}</div>
          <div class="chips">
            {#each entities.person as e}
              <span class="chip" title={e.blurb || ''}>{e.name}</span>
            {/each}
          </div>
        </div>
      {/if}

      {#if entities.place.length || entities.event.length}
        <div class="grp placeevent">
          {#if entities.place.length}
            <div class="col">
              <div class="grplbl">Places · {entities.place.length}</div>
              {#each entities.place as e}
                <div class="ent" title={e.blurb || ''}>
                  <span class="name">{e.name}</span>
                  {#if e.feature_type}<span class="tag">{e.feature_type}</span>{/if}
                  {#if e.latitude != null && e.longitude != null}<span class="pin" title="{e.latitude}, {e.longitude}">📍</span>{/if}
                </div>
              {/each}
            </div>
          {/if}

          {#if entities.event.length}
            <div class="col">
              <div class="grplbl">Events <span class="note">· approximate, traditional chronology</span></div>
              {#each entities.event as e}
                <div class="ent" title={e.blurb || ''}>
                  <span class="name">{e.name}</span>
                  {#if e.approx_year != null}<span class="tag">{yearLabel(e.approx_year)}</span>{/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if entities.group.length}
        <div class="grp">
          <div class="grplbl">Groups · {entities.group.length}</div>
          <div class="chips">
            {#each entities.group as e}
              <span class="chip" title={e.blurb || ''}>{e.name}</span>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  {/if}

  {@render secHeader('notes', 'Study notes')}
  {#if sec.notes}
    <div class="grp studynotes">
      <div class="grplbl">Study Notes<span class="srcinfo">ⓘ<span class="srctip">Tyndale Open Study Notes · CC BY-SA 4.0</span></span> {#if noteCount > 0}<span class="sub">· {noteCount} in this chapter</span>{/if}</div>
      {#if noteCount === 0}
        <div class="empty">No study notes for this chapter.</div>
      {:else if study.verse == null}
        <div class="empty">Select a verse to read its notes.</div>
      {:else if studyNotes.length === 0}
        <div class="empty">No study note for this verse.</div>
      {:else}
        {#each studyNotes as n}
          <div class="snote">
            <div class="snref">{n.ref}</div>
            <p class="snbody">{n.body}</p>
          </div>
        {/each}
      {/if}
    </div>
  {/if}

  {@render secHeader('themes', 'Themes')}
  {#if sec.themes}
    <div class="grp">
      {#each themes as t}
        <div class="snote"><div class="snref">{t.title} · {t.ref}</div><p class="snbody">{t.body}</p></div>
      {/each}
    </div>
  {/if}

  {@render secHeader('profiles', 'Profiles')}
  {#if sec.profiles}
    <div class="grp">
      {#each profiles as p}
        <div class="snote"><div class="snref">{p.title} · {p.ref}</div><p class="snbody">{p.body}</p></div>
      {/each}
    </div>
  {/if}

  {@render secHeader('dict', 'Dictionary')}
  {#if sec.dict}
    <!-- Dictionary grid with expandable article detail panel arrives here -->
  {/if}
{/if}

<style>
  .empty { color: var(--dim); font-size: 12px; font-style: italic; padding: 9px 11px; }
  .tabs { display: flex; gap: 4px; padding: 8px 11px 0; }
  .tab { font-family: inherit; font-size: 11px; color: var(--dim); background: transparent;
    border: 1px solid var(--rule); border-radius: 5px; padding: 3px 9px; cursor: pointer; }
  .tab:hover { color: var(--ink); }
  .tab.on { color: var(--ink); border-color: var(--a); background: var(--panel); }
  .hd { position: relative; padding: 9px 11px 4px; font-size: 12px; color: var(--ink); line-height: 1.5; }
  .hd .sub { color: var(--dim); font-size: .92em; }
  .hd .q { cursor: help; color: var(--b); margin-right: 2px; }
  .hd .tip { position: absolute; z-index: 40; left: 11px; right: 11px; top: 100%; margin-top: 2px;
    background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 10px 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,.4); font-size: 12px; line-height: 1.5; color: var(--ink);
    opacity: 0; visibility: hidden; transition: opacity .12s; }
  .hd:hover .tip { opacity: 1; visibility: visible; }
  .grp { padding: 4px 11px 6px; }
  .grplbl { font-variant: small-caps; letter-spacing: .05em; font-size: 10.5px; color: var(--dim); margin: 6px 0 4px; }
  .grplbl .note { text-transform: none; font-variant: normal; letter-spacing: 0; font-style: italic; }
  /* source byline as an ⓘ hover tooltip (matches the .hd/.tip pattern above) */
  .srcinfo { position: relative; cursor: help; color: var(--b); margin-left: 4px;
    font-variant: normal; letter-spacing: 0; }
  .srctip { position: absolute; z-index: 40; left: 0; top: 100%; margin-top: 3px; width: 220px;
    background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; padding: 8px 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,.4); font-size: 11.5px; line-height: 1.5; color: var(--dim);
    text-transform: none; font-variant: normal; letter-spacing: 0;
    opacity: 0; visibility: hidden; transition: opacity .12s; }
  .srcinfo:hover .srctip { opacity: 1; visibility: visible; }
  .srctip a { color: var(--dim); text-decoration: underline; text-underline-offset: 2px; }
  .srctip a:hover { color: var(--b); }
  .xref { display: flex; flex-direction: column; align-items: stretch; gap: 2px; width: 100%; text-align: left;
    border: 1px solid var(--rule); background: transparent; border-radius: 5px; padding: 6px 9px; cursor: pointer;
    color: var(--ink); font-family: inherit; margin-bottom: 5px; }
  .xref:hover { border-color: var(--a); }
  .rtop { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .ref { color: var(--a); font-size: 12.5px; } .votes { color: var(--dim); font-size: .78em; }
  .prev { color: var(--dim); font-size: 11.5px; line-height: 1.45; }
  .seemore { display: block; width: 100%; text-align: left; background: transparent; border: none;
    color: var(--a); font-family: inherit; font-size: 11px; cursor: pointer; padding: 1px 2px 4px; }
  .seemore:hover { text-decoration: underline; }
  .l2 { padding: 6px 11px 10px; font-size: 11px; color: var(--dim); border-top: 1px solid var(--rule); margin-top: 4px; }
  /* Chapter recap */
  .recap { border-bottom: 1px solid var(--rule); }
  .recaptext { margin: 0; font-size: 12px; line-height: 1.6; color: var(--ink); white-space: pre-wrap; }
  /* Context entities */
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip { border: 1px solid var(--rule); border-radius: 5px; padding: 2px 7px; font-size: 12px; color: var(--ink); }
  .placeevent { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; align-items: start; }
  .ent { display: flex; align-items: baseline; gap: 6px; padding: 2px 0; font-size: 12px; color: var(--ink); }
  .ent .name { color: var(--ink); }
  .ent .tag { color: var(--dim); font-size: 10.5px; }
  .ent .pin { font-size: 10px; cursor: help; }
  /* Study notes */
  .grplbl .sub { color: var(--dim); font-size: .92em; }
  .studynotes { border-top: 1px solid var(--rule); margin-top: 6px; padding-top: 8px; }
  .snote { margin: 6px 0; }
  .snref { font-size: 11px; color: var(--b); font-weight: 600; }
  .snbody { font-size: 12px; line-height: 1.55; color: var(--ink); white-space: pre-wrap; margin: 2px 0 0; }
  /* collapsible section headers */
  .sechd { display: flex; align-items: baseline; gap: 5px; width: 100%; text-align: left;
    background: transparent; border: none; border-top: 1px solid var(--rule);
    padding: 7px 11px 5px; cursor: pointer; font-family: inherit; color: var(--dim); }
  .sechd:hover:not(:disabled) { color: var(--ink); }
  .sechd:disabled { cursor: default; opacity: .55; }
  .sechd .caret { display: inline-block; transition: transform .12s; font-size: 11px; }
  .sechd .caret.open { transform: rotate(90deg); }
  .seclbl { font-variant: small-caps; letter-spacing: .05em; font-size: 10.5px; }
  .secn { font-size: 10.5px; }
  .seckey { margin-left: auto; font-size: 9.5px; opacity: .5; border: 1px solid var(--rule);
    border-radius: 3px; padding: 0 4px; }
  .introfull { margin-top: 6px; }
</style>
