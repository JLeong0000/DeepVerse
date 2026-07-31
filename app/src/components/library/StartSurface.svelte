<script>
  // Four routes as cards, each carrying its real count and a rotating real example so the page
  // invites rather than lists.
  import { lib, pushNode, recentArticles } from '../../lib/library.svelte.js';
  import { displayTitle } from '../../lib/titles.js';

  const ROUTES = [
    ['dict', 'Dictionary', '6,010 articles', 'Look up a person, place, object or idea. A–Z, or search.'],
    ['themes', 'Themes', '298 articles', 'Essays anchored to a passage — read them in canonical order.'],
    ['profiles', 'Profiles', '125 profiles', 'People, peoples and places, each tied to the passage they act in.'],
    ['books', 'Books', '66 introductions', 'Purpose, author, date and setting — plus everything anchored in that book.'],
  ];

  // Real items, so the start page never shows something the corpus does not contain. Verse counts
  // are dict_articles.n_refs (= distinct verses cited, per getBookHub's own "cites" convention) —
  // queried against bible.db, not copied from the plan.
  const EGS = {
    dict: [['Nazarite*, Nazirite', 'cites 11 verses'], ['Babylon, Babylonia', 'cites 7 verses'],
      ['Shepherd', 'cites 31 verses'], ['Beast', 'cites 26 verses']],
    themes: [['All Is “Vapor”', 'Ecclesiastes 1:2–9:12'], ['Holy War', 'Deuteronomy 7:1-6'],
      ['Atonement', 'Leviticus 16:1-34'], ['Bribes', 'Proverbs 17:8']],
    profiles: [['The Philistines', 'Judges 13:1–16:31'], ['Priscilla and Aquila', 'Acts 18:1-3'],
      ['Hellenistic Kingdoms', 'Daniel 11:4-45'], ['Martha, Mary, and Lazarus', 'Luke 10:38-42']],
    books: [['Revelation', 'Written to churches in Asia under persecution'],
      ['Ecclesiastes', 'Wisdom literature, authorship debated'], ['Jonah', 'A prophet and a reluctant errand']],
  };
  // rotates on each visit to the start page (this component is destroyed/recreated whenever the
  // stack moves off and back onto a 'start' node — see Library.svelte's {#if})
  const tick = Math.floor(Math.random() * 12);
  const eg = (k) => EGS[k][tick % EGS[k].length];
</script>

<h3 class="stitle">The Library</h3>
<div class="smeta">Tyndale’s Open Bible Dictionary and companion content · 6,499 pieces, four ways in</div>

<div class="cards">
  {#each ROUTES as [key, name, count, desc]}
    <button class="card" onclick={() => pushNode({ kind: 'route', route: key })}>
      <div class="cn">{name}</div>
      <div class="cc">{count}</div>
      <div class="cd">{desc}</div>
      <span class="egline"><span class="egl">for instance</span>{displayTitle(eg(key)[0])}<span class="egr">{eg(key)[1]}</span></span>
    </button>
  {/each}
</div>

<div class="stats">
  <div class="stat"><div class="sv">{lib.visited}</div><div class="scap">articles this session</div></div>
  <div class="stat"><div class="sv">{lib.deepest}</div><div class="scap">deepest chain</div></div>
  <div class="stat"><div class="sv">1,839</div><div class="scap">substantial articles</div></div>
</div>

<p class="starthint">
  Search reaches all four at once. <b>✦ Wander in</b> opens a random article — weighted to
  substantial ones, because 2,271 of the 6,010 entries are under 120 characters and 577 are bare
  “See X.” redirects.
</p>

{#if recentArticles().length}
  <div class="recent">
    <div class="rl">Recently viewed</div>
    <div class="rchips">
      {#each recentArticles().slice(0, 12) as r (r.id)}
        <button class="rchip" onclick={() => pushNode({ kind: 'article', id: r.id, title: r.title })}>
          {displayTitle(r.title)}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .stitle { font-size: 22px; margin: 0 0 4px; }
  .smeta { font-size: 11.5px; color: var(--dim); margin-bottom: 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(232px, 1fr)); gap: 14px; }
  .card { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px;
    padding: 15px 17px 16px; cursor: pointer; text-align: left; font-family: inherit;
    color: var(--ink); transition: border-color .15s, transform .15s; }
  .card:hover { border-color: var(--a); transform: translateY(-2px); }
  .cn { font-size: 16px; margin-bottom: 2px; }
  .cc { font-size: 10.5px; color: var(--dim); font-variant: small-caps; letter-spacing: .06em; }
  .cd { font-size: 12px; color: var(--dim); line-height: 1.5; margin-top: 9px; }
  .egline { display: block; margin-top: 9px; padding-top: 8px; border-top: 1px dashed var(--rule);
    font-size: 12px; color: var(--ink); }
  .egl { font-size: 9.5px; color: var(--dim); font-variant: small-caps; letter-spacing: .07em; display: block; }
  .egr { color: var(--b); font-size: 10.5px; margin-left: 6px; }
  .stats { margin-top: 24px; padding-top: 14px; border-top: 1px solid var(--rule); display: flex; gap: 30px; }
  .sv { font-size: 20px; }
  .scap { font-size: 10px; color: var(--dim); font-variant: small-caps; letter-spacing: .06em; }
  .starthint { font-size: 11.5px; color: var(--dim); font-style: italic; margin-top: 16px; line-height: 1.55; }
  .recent { margin-top: 22px; padding-top: 13px; border-top: 1px solid var(--rule); }
  .rl { font-variant: small-caps; letter-spacing: .06em; font-size: 11px; color: var(--dim); margin-bottom: 8px; }
  .rchips { display: flex; flex-wrap: wrap; gap: 5px; }
  .rchip { background: transparent; border: 1px solid var(--rule); border-radius: 5px; padding: 4px 9px;
    font-family: inherit; font-size: 12px; color: var(--ink); cursor: pointer; }
  .rchip:hover { border-color: var(--a); }
</style>
