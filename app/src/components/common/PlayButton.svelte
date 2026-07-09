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
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
      <path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor" />
      <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  </button>
{/if}

<style>
  .play {
    border: none; background: none; cursor: pointer; padding: 0 2px;
    color: var(--dim); opacity: .7; display: inline-flex; align-items: center; line-height: 0;
    vertical-align: middle;
  }
  .play:hover { opacity: 1; color: var(--a); }
  .play.playing { color: var(--a); opacity: 1; }
  .play.error { color: var(--b); opacity: 1; }
  .play.loading { animation: tts-pulse 1s ease-in-out infinite; }
  @keyframes tts-pulse { 0%, 100% { opacity: .3; } 50% { opacity: .85; } }
</style>
