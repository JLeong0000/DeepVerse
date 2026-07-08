<script>
  import { getPref, setPref } from '../../lib/store.js';
  import { randomGreeting, randomSubline } from '../../lib/greetings.js';
  import { parseReference } from '../../lib/refs.js';
  import { openStudy } from '../../lib/router.svelte.js';

  let name = $state(getPref('name', 'friend'));
  const phrase = randomGreeting();
  const subline = randomSubline();

  // A verse subline reads "quote — Reference"; parse the citation so it can be opened.
  const dash = subline.lastIndexOf(' — ');
  const ref = dash >= 0 ? parseReference(subline.slice(dash + 3)) : null;

  function saveName(e) {
    const v = e.target.textContent.trim() || 'friend';
    name = v; setPref('name', v);
  }

  function openVerse() {
    openStudy({ book: ref.book, chapter: ref.chapter, verse: ref.verse });
  }
</script>

<div class="greetblock">
  <div class="hello">
    {phrase}, <span class="name" contenteditable="true" spellcheck="false"
      onblur={saveName}>{name}</span>
  </div>
  {#if ref}
    <button class="hellosub versesub" onclick={openVerse}>{subline}</button>
  {:else}
    <div class="hellosub">{subline}</div>
  {/if}
</div>

<style>
  .hello { font-size: 30px; margin-bottom: 2px; }
  .name { border-bottom: 1px dotted var(--dim); cursor: text; outline: none; padding: 0 2px; }
  .name:focus { border-bottom: 1px solid var(--a); }
  .hellosub { color: var(--dim); font-size: 14px; font-style: italic; }
  .versesub { display: block; text-align: left; border: none; background: none; padding: 0;
    font-family: inherit; cursor: pointer; }
  .versesub:hover, .versesub:focus-visible { color: var(--a); outline: none; }
</style>
