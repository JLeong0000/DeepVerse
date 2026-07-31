<script>
  // Themes group under their anchor book (canonical order); profiles run A–Z. Both are passages,
  // so they share a renderer; only the grouping differs.
  import { getThemeIndex, getProfileIndex } from '../../lib/db.js';
  import { pushNode } from '../../lib/library.svelte.js';
  import { bookName } from '../../lib/refs.js';

  let { kind } = $props();

  let themeGroups = $derived.by(() => {
    if (kind !== 'themes') return [];
    const out = [];
    for (const t of getThemeIndex()) {
      if (!out.length || out.at(-1).book !== t.book) out.push({ book: t.book, items: [] });
      out.at(-1).items.push(t);
    }
    return out;
  });
  let profiles = $derived(kind === 'profiles' ? getProfileIndex() : []);

  // A theme or profile opens its own text. Its anchor passage is reachable from there — sending
  // the user to the book hub instead would make these two routes browsable but unreadable.
  const openPassage = (kindName, p) =>
    pushNode({ kind: 'passage', pkind: kindName, title: p.title, book: p.book });
</script>

{#if kind === 'themes'}
  <h3 class="stitle">Themes</h3>
  <div class="smeta">
    298 articles · canonical order, grouped by the book they are anchored in · 56 books carry themes
  </div>
  <div class="cols3">
    {#each themeGroups as g (g.book)}
      <div class="grp">
        <div class="grouphd">{bookName(g.book)} · {g.items.length}</div>
        {#each g.items as t (t.title)}
          <div class="entry">
            <button class="et" onclick={() => openPassage('theme', t)}>{t.title}</button>
            <span class="ref">{t.ref}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>
  <p class="note">
    The source carries no thematic categorisation, so these are grouped by anchor book — data that
    exists — and never by an invented subject taxonomy.
  </p>
{:else}
  <h3 class="stitle">Profiles</h3>
  <div class="smeta">125 profiles · A–Z · people, peoples and places</div>
  <div class="cols3">
    {#each profiles as p (p.title)}
      <div class="entry">
        <button class="et" onclick={() => openPassage('profile', p)}>{p.title}</button>
        {#if p.alsoArticle}<span class="also">also a dictionary article</span>{/if}
        <span class="ref">{bookName(p.book)} {p.ref}</span>
      </div>
    {/each}
  </div>
  <p class="note">
    Not 125 people: <b>The Philistines</b>, <b>Assyria</b>, <b>Corinth</b> and
    <b>Hellenistic Kingdoms</b> are all in here. 84 of the 125 also have a same-title dictionary
    article — a second door to the same subject.
  </p>
{/if}

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .cols3 { columns: 3; column-gap: 34px; }
  @media (max-width: 900px) { .cols3 { columns: 1; } }
  .grp { break-inside: avoid-column; margin-bottom: 17px; }
  .grouphd { font-variant: small-caps; letter-spacing: .06em; font-size: 11px; color: var(--b);
    margin: 0 0 6px; break-after: avoid; }
  .entry { break-inside: avoid; margin-bottom: 9px; }
  .et { background: none; border: none; font-family: inherit; font-size: 13px; color: var(--ink);
    cursor: pointer; padding: 0; text-align: left; }
  .et:hover { color: var(--a); }
  .ref { font-size: 10.5px; color: var(--b); display: block; margin-top: 1px; }
  .also { font-size: 9px; color: var(--b); border: 1px solid var(--rule); border-radius: 3px;
    padding: 0 3px; margin-left: 5px; }
  .note { font-size: 11px; color: var(--dim); line-height: 1.55; margin-top: 12px; font-style: italic; max-width: 74ch; }
</style>
