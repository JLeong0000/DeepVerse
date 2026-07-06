<script>
  // Milestone 3 fills this in (reader + workbench). Placeholder so routing works.
  import { route } from '../lib/router.svelte.js';
</script>

<div class="page">
  <p class="dim">Study mode — coming in Milestone 3.</p>
  {#if route.params?.book}
    <p class="dim">Target: {route.params.book} {route.params.chapter}{route.params.verse ? `:${route.params.verse}` : ''}</p>
  {/if}
</div>

<style>
  .page { padding: 30px; }
  .dim { color: var(--dim); }
</style>
