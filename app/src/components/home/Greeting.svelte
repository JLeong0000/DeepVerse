<script>
  import { getPref, setPref } from '../../lib/store.js';
  import { randomGreeting, randomSubline } from '../../lib/greetings.js';

  let name = $state(getPref('name', 'friend'));
  const phrase = randomGreeting();
  const subline = randomSubline();

  function saveName(e) {
    const v = e.target.textContent.trim() || 'friend';
    name = v; setPref('name', v);
  }
</script>

<div class="hello">
  {phrase}, <span class="name" contenteditable="true" spellcheck="false"
    onblur={saveName}>{name}</span>
</div>
<div class="hellosub">{subline}</div>

<style>
  .hello { font-size: 30px; margin-bottom: 2px; }
  .name { border-bottom: 1px dotted var(--dim); cursor: text; outline: none; padding: 0 2px; }
  .name:focus { border-bottom: 1px solid var(--a); }
  .hellosub { color: var(--dim); font-size: 14px; font-style: italic; }
</style>
