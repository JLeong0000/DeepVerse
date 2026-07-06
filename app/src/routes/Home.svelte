<script>
  import Greeting from '../components/home/Greeting.svelte';
  import Resume from '../components/home/Resume.svelte';
  import WordOfDay from '../components/home/WordOfDay.svelte';
  import ReadingActivity from '../components/home/ReadingActivity.svelte';
  import ToStudy from '../components/home/ToStudy.svelte';
  import RecentNotes from '../components/home/RecentNotes.svelte';
</script>

<div class="scroll"><div class="page">
  <Greeting />
  <hr class="greetrule" />

  <div class="cols">
    <div class="main">
      <Resume />
      <WordOfDay />
    </div>
    <div class="side">
      <ReadingActivity />
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
  .greetrule { border: none; border-top: 1px solid var(--rule); margin: 22px 0 24px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; align-items: start; }
  @media (max-width: 640px) { .cols { grid-template-columns: 1fr; gap: 26px; } }
  .bottom { border-top: 1px solid var(--rule); margin-top: 26px; padding-top: 22px; display: grid; grid-template-columns: 1fr 2fr; gap: 36px; align-items: start; }
  @media (max-width: 640px) { .bottom { grid-template-columns: 1fr; gap: 26px; } }
</style>
