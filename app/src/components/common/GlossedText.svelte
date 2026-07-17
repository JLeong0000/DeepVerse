<script>
  import { tokenizeGlossary } from '../../lib/glossary.js';
  import GlossTerm from './GlossTerm.svelte';

  let { text } = $props();
  let segments = $derived(tokenizeGlossary(text));
</script>

{#each segments as seg}{#if seg.term}<GlossTerm term={seg.term} />{:else}{seg.plain}{/if}{/each}
