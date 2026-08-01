<script>
  // One query, all four routes. Making the user first guess which route holds the answer would
  // tax the primary objective.
  import { searchLibrary } from '../../lib/db.js';
  import { pushNode } from '../../lib/library.svelte.js';
  import { displayTitle } from '../../lib/titles.js';
  import { bookName } from '../../lib/refs.js';

  // `highlight` is the flat index (dict, then themes, then profiles, then books — the same order
  // as flattenSearchResults in library.svelte.js) that arrow-key traversal is currently on; Library.svelte
  // owns the value since it also owns the input the keys are pressed in. -1 renders no highlight.
  let { q, highlight = -1 } = $props();
  let res = $derived(searchLibrary(q));
  let total = $derived(res.dict.length + res.themes.length + res.profiles.length + res.books.length);

  // searchLibrary caps dict at 20 and themes/profiles at 10 each (books is never capped — 66 max),
  // but fetches one row past each cap so `res.*Truncated` tells us whether the cap actually cut
  // anything. "Dictionary · 20" when 300 articles match — or "20+" when exactly 20 exist and
  // nothing was cut — are both claims the corpus doesn't support; only render "+" when rows were
  // truly hidden.
  const countLabel = (n, truncated) => (truncated ? `${n}+` : n);

  // Offsets into the flattened order, for turning a rendered row into the highlight index Enter/↑↓
  // traversal uses. Order must match flattenSearchResults.
  let themesOffset = $derived(res.dict.length);
  let profilesOffset = $derived(themesOffset + res.themes.length);
  let booksOffset = $derived(profilesOffset + res.profiles.length);

  // Whichever group renders first (some may be empty) gets its top border suppressed. Not CSS
  // :first-of-type: .smeta above is also a <div>, so it — not whichever .reslbl happens to be
  // visually first — would always claim that position, and no .reslbl would ever match.
  let firstGroup = $derived.by(() => {
    if (res.dict.length) return 'dict';
    if (res.themes.length) return 'themes';
    if (res.profiles.length) return 'profiles';
    if (res.books.length) return 'books';
    return null;
  });
</script>

<h3 class="stitle">“{q}”</h3>
<div class="smeta">one query, all four routes</div>

{#if total === 0}
  <p class="none">Nothing matches “{q}”.</p>
{:else}
  {#if res.dict.length}
    <div class="reslbl" class:first={firstGroup === 'dict'}>Dictionary · {countLabel(res.dict.length, res.dictTruncated)}</div>
    <div class="cols2">
      {#each res.dict as d, i (d.id)}
        <div class="entry" class:hi={highlight === i}>
          <button class="et" onclick={() => pushNode({ kind: 'article', id: d.id, title: d.title })}>
            {displayTitle(d.title)}
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#each [
    ['Themes', 'theme', 'themes', themesOffset, res.themes, res.themesTruncated],
    ['Profiles', 'profile', 'profiles', profilesOffset, res.profiles, res.profilesTruncated],
  ] as [label, pkind, key, offset, list, truncated]}
    {#if list.length}
      <div class="reslbl" class:first={firstGroup === key}>{label} · {countLabel(list.length, truncated)}</div>
      <div class="cols2">
        {#each list as p, i (p.title)}
          <div class="entry" class:hi={highlight === offset + i}>
            <button class="et" onclick={() => pushNode({ kind: 'passage', pkind, title: p.title, book: p.book })}>{p.title}</button>
            <span class="ref">{bookName(p.book)} {p.ref}</span>
          </div>
        {/each}
      </div>
    {/if}
  {/each}

  {#if res.books.length}
    <div class="reslbl" class:first={firstGroup === 'books'}>Books · {res.books.length}</div>
    <div class="cols2">
      {#each res.books as b, i (b)}
        <div class="entry" class:hi={highlight === booksOffset + i}>
          <button class="et" onclick={() => pushNode({ kind: 'hub', book: b })}>{bookName(b)}</button>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .reslbl { font-variant: small-caps; letter-spacing: .06em; font-size: 11px; color: var(--b);
    margin: 18px 0 7px; padding-top: 11px; border-top: 1px solid var(--rule); }
  .reslbl.first { border-top: none; padding-top: 0; margin-top: 0; }
  .cols2 { columns: 2; column-gap: 34px; }
  @media (max-width: 900px) { .cols2 { columns: 1; } }
  .entry { break-inside: avoid; margin-bottom: 9px; border-radius: 4px; }
  .entry.hi { background: color-mix(in srgb, var(--a) 12%, transparent); }
  .et { background: none; border: none; font-family: inherit; font-size: 13px; color: var(--ink);
    cursor: pointer; padding: 0; text-align: left; }
  .et:hover { color: var(--a); }
  .ref { font-size: 10.5px; color: var(--b); display: block; margin-top: 1px; }
  .none { font-size: 12.5px; color: var(--dim); font-style: italic; }
</style>
