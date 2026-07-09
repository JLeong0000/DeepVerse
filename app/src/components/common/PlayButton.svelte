<script>
  import { speak, canSpeak, playing } from '../../lib/tts/index.js';

  let { text, lang } = $props();
  let state = $state('idle'); // 'idle' | 'loading' | 'playing' | 'error'

  // Playback is shared (one voice at a time via the player). When it stops — whether this word
  // finished or another word took over — drop our 'playing' highlight back to idle.
  $effect(() => { if (!$playing && state === 'playing') state = 'idle'; });

  async function onClick(e) {
    e.stopPropagation();
    if (state === 'loading') return;
    state = 'loading';
    try {
      await speak(text, lang);
      state = 'playing';
    } catch (err) {
      console.warn('[tts] playback failed:', err);
      state = 'error';
      setTimeout(() => { if (state === 'error') state = 'idle'; }, 1200);
    }
  }
</script>

{#if canSpeak(lang)}
  <button class="play {state}" onclick={onClick} aria-label="Hear pronunciation" title="Hear pronunciation">
    {#if state === 'loading'}·{:else if state === 'error'}!{:else}▶{/if}
  </button>
{/if}

<style>
  .play {
    border: none; background: none; cursor: pointer; padding: 0 2px;
    color: var(--dim); font-size: 11px; line-height: 1; opacity: .75;
  }
  .play:hover { opacity: 1; color: var(--a); }
  .play.playing { color: var(--a); opacity: 1; }
  .play.error { color: var(--b); }
</style>
