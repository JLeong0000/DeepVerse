<script>
  import { GLOSSARY } from '../../lib/glossary.js';

  let { term } = $props();
  const entry = $derived(GLOSSARY[term]);

  let el;                                             // the underlined term span
  let open = $state(false);
  let pos = $state({ left: 0, top: 0, above: true }); // fixed-position coords for the popover

  function show() {
    if (!entry || !el) return;
    const r = el.getBoundingClientRect();
    const above = r.top > 140;                        // enough room above? else flip below
    pos = {
      left: Math.min(Math.max(8, r.left), window.innerWidth - 268),
      top: above ? r.top - 6 : r.bottom + 6,
      above,
    };
    open = true;
  }
  function hide() { open = false; }
</script>

{#if entry}
  <span
    class="gterm"
    bind:this={el}
    role="note"
    tabindex="0"
    onmouseenter={show}
    onmouseleave={hide}
    onfocus={show}
    onblur={hide}
  >{term}{#if open}
      <span class="gpop" class:above={pos.above} style="left:{pos.left}px; top:{pos.top}px;">
        <span class="glabel">{entry.label}</span>
        <span class="gtext">{entry.text}</span>
      </span>
    {/if}</span>
{:else}{term}{/if}

<style>
  .gterm {
    border-bottom: 1px dotted var(--dim);
    cursor: help;
    position: relative;
  }
  .gpop {
    position: fixed;
    z-index: 50;
    max-width: 260px;
    padding: 7px 9px;
    border-radius: 6px;
    background: var(--panel);
    border: 1px solid var(--rule);
    box-shadow: 0 6px 20px rgba(0, 0, 0, .28);
    font-size: 12px;
    line-height: 1.45;
    color: var(--ink);
    pointer-events: none;                             /* popover never eats the hover */
    white-space: normal;
  }
  .gpop.above { transform: translateY(-100%); }       /* sit above the term */
  .glabel { display: block; font-weight: 700; margin-bottom: 2px; }
  .gtext { display: block; color: var(--dim); }
</style>
