<script>
  import { getDictLetters, getDictBrowse, getOrphanSupplements } from '../../lib/db.js';
  import { lib, pushNode, replaceTop } from '../../lib/library.svelte.js';

  let { letter = null } = $props();

  // '#' catches sort_titles that don't start A-Z (SQLite's upper() is ASCII-only) — one article,
  // "I Am" Sayings, lives there. Without this tab it's unreachable from the one surface whose
  // whole job is completeness.
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');
  let counts = $derived(new Map(getDictLetters().map((r) => [r.letter, r.n])));
  let rows = $derived(letter ? getDictBrowse(letter) : []);
  let orphans = $derived(letter ? getOrphanSupplements() : []);

  // picking a letter refines the current step rather than adding one
  const pick = (L) => replaceTop({ kind: 'route', route: 'dict', letter: L });
  const open = (r) => pushNode({ kind: 'article', id: r.id, title: r.title });
</script>

<h3 class="stitle">Dictionary</h3>
<div class="smeta">
  6,010 articles · {letter ? `${letter} · ${counts.get(letter) ?? 0} entries` : 'pick a letter, or search'}
</div>

<div class="azgrid">
  {#each LETTERS as L}
    <button class:on={L === letter} onclick={() => pick(L)}>{L}</button>
  {/each}
</div>

{#if letter}
  <div class="cols3">
    {#each rows as r (r.id)}
      {#if r.redirect}
        <!-- 577 bodies are nothing but "See X." — a redirect line, not an entry -->
        <div class="entry redir">{r.title} <span class="arw">→</span> <span class="to">{r.redirect}</span></div>
      {:else}
        <div class="entry">
          <button class="et" onclick={() => open(r)}>{r.title}</button>
          <span class="gloss">{r.gloss}</span>
        </div>
      {/if}
    {/each}
  </div>

  <div class="orph">
    <div class="ohl">Charts &amp; textboxes with no host article · {orphans.length}</div>
    <div class="chips">
      {#each orphans as o (o.id)}
        <button class="chip" onclick={() => open(o)}>{o.kind === 'chart' ? '▦' : '▤'} {o.title}</button>
      {/each}
    </div>
    <p class="note">Their <code>host_id</code> never resolved, so nothing else in the app can reach them.</p>
  </div>
{:else}
  <p class="note">
    Titles are shown in full — <code>sort_title</code> strips the disambiguating parenthetical, and
    131 groups of articles collide once it does. This index is also the one place that keeps
    Tyndale’s inverted headwords (<i>Revelation, Book of</i>): inversion is what makes an A–Z browse
    work. Everywhere the title is used as a <i>name</i> it reads <i>Book of Revelation</i>.
  </p>
{/if}

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .azgrid { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 18px; }
  .azgrid button { background: transparent; border: 1px solid var(--rule); border-radius: 4px;
    min-width: 26px; padding: 3px 5px; font-family: inherit; font-size: 11.5px; color: var(--dim);
    cursor: pointer; }
  .azgrid button:hover { color: var(--ink); border-color: var(--a); }
  .azgrid button.on { color: var(--bg); background: var(--a); border-color: var(--a); }
  .cols3 { columns: 3; column-gap: 34px; }
  @media (max-width: 900px) { .cols3 { columns: 1; } }
  .entry { break-inside: avoid; margin-bottom: 9px; }
  .et { background: none; border: none; font-family: inherit; font-size: 13px; color: var(--ink);
    cursor: pointer; padding: 0; text-align: left; }
  .et:hover { color: var(--a); }
  .gloss { font-size: 11px; color: var(--dim); line-height: 1.4; display: block; margin-top: 1px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .redir { font-size: 11.5px; color: var(--dim); }
  .arw { font-size: 10px; }
  .to { color: var(--a); }
  .orph { margin-top: 24px; padding-top: 13px; border-top: 1px solid var(--rule); }
  .ohl { font-variant: small-caps; letter-spacing: .06em; font-size: 11px; color: var(--dim); margin-bottom: 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { background: transparent; border: 1px solid var(--rule); border-radius: 5px; padding: 4px 9px;
    font-family: inherit; font-size: 12px; color: var(--ink); cursor: pointer; }
  .chip:hover { border-color: var(--a); }
  .note { font-size: 11px; color: var(--dim); line-height: 1.55; margin-top: 8px; font-style: italic; max-width: 74ch; }
</style>
