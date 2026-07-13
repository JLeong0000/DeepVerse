<script>
  import Greeting from '../components/home/Greeting.svelte';
  import JumpToVerse from '../components/home/JumpToVerse.svelte';
  import Resume from '../components/home/Resume.svelte';
  import WordOfDay from '../components/home/WordOfDay.svelte';
  import ReadingActivity from '../components/home/ReadingActivity.svelte';
  import ToStudy from '../components/home/ToStudy.svelte';
  import RecentNotes from '../components/home/RecentNotes.svelte';
</script>

<div class="scroll"><div class="page">
  <div class="greetrow">
    <Greeting />
    <JumpToVerse />
  </div>
  <hr class="greetrule" />

  <div class="cols">
    <div class="main">
      <Resume />
      <ReadingActivity />
    </div>
    <div class="side">
      <WordOfDay />
    </div>
  </div>

  <div class="bottom">
    <div class="tostudy"><ToStudy /></div>
    <div class="notes"><RecentNotes /></div>
  </div>
</div></div>

<style>
  .scroll { flex: 1; min-height: 0; overflow-y: auto; }
  .page { padding: 14px 30px 32px; max-width: 1100px; margin: 0 auto; }
  .greetrow { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .greetrow :global(.jump) { margin-top: 6px; } /* nudge the input onto the welcome line */
  .greetrule { border: none; border-top: 1px solid var(--rule); margin: 22px 0 24px; }
  /* left column hugs the activity heatmap and the card takes the rest — otherwise two 1fr columns
     leave a wide empty band between the narrow heatmap and the card. */
  .cols { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 40px; align-items: start; }
  /* the side column stretches to the left column's height and its card fills that space */
  .side { display: flex; flex-direction: column; gap: 16px; align-self: stretch; }
  .side > :global(.wotd) { flex: 1; }
  @media (max-width: 640px) { .cols { grid-template-columns: 1fr; gap: 26px; } }
  .bottom { border-top: 1px solid var(--rule); margin-top: 26px; padding-top: 22px; display: grid; grid-template-columns: 1fr 2fr; gap: 36px; align-items: start; }
  @media (max-width: 640px) { .bottom { grid-template-columns: 1fr; gap: 26px; } }
</style>
