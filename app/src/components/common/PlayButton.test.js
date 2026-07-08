import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PlayButton from './PlayButton.svelte';

const { speak } = vi.hoisted(() => ({ speak: vi.fn(async () => {}) }));
vi.mock('../../lib/tts/index.js', () => ({
  speak,
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
