import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PlayButton from './PlayButton.svelte';

// Minimal writable-compatible store inline (svelte/store can't be imported inside vi.hoisted,
// which runs before imports). PlayButton auto-subscribes via `$playing`, so it only needs subscribe/set.
const { speak, playing } = vi.hoisted(() => {
  let value = false;
  const subs = new Set();
  return {
    speak: vi.fn(async () => {}),
    playing: {
      subscribe(fn) { fn(value); subs.add(fn); return () => subs.delete(fn); },
      set(v) { value = v; subs.forEach((fn) => fn(value)); },
    },
  };
});
vi.mock('../../lib/tts/index.js', () => ({
  speak,
  playing,
  canSpeak: (lang) => lang === 'grc' || lang === 'hbo' || String(lang)[0] === 'G' || String(lang)[0] === 'H',
}));

beforeEach(() => speak.mockClear());

describe('PlayButton', () => {
  it('renders nothing for Aramaic', () => {
    const { queryByRole } = render(PlayButton, { text: 'ריא', lang: 'arc' });
    expect(queryByRole('button')).toBeNull();
  });
  it('renders and speaks for Greek', async () => {
    const { getByRole } = render(PlayButton, { text: 'λόγος', lang: 'grc' });
    await fireEvent.click(getByRole('button'));
    expect(speak).toHaveBeenCalledWith('λόγος', 'grc');
  });
  it('stops propagation so it does not trigger a parent click', async () => {
    const parent = vi.fn();
    const { getByRole, container } = render(PlayButton, { text: 'λόγος', lang: 'grc' });
    // Listen on an actual DOM ancestor of the render container, not the container itself:
    // Svelte 5 registers its own delegated click handler directly on the container (by design,
    // so it can observe events even if intervening content stops propagation), so a listener
    // added to that same node would fire regardless of stopPropagation — only the parent element
    // sees propagation genuinely halted.
    container.parentNode.addEventListener('click', parent);
    await fireEvent.click(getByRole('button'));
    expect(parent).not.toHaveBeenCalled();
  });
});
