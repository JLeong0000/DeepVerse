import { describe, it, expect, vi, beforeEach } from 'vitest';

const mmsSynth = vi.fn(async () => 'buffer');
const play = vi.fn();
vi.mock('./mms.js', () => ({ synthesize: mmsSynth }));
vi.mock('./player.js', () => ({ play, stop: vi.fn(), playing: {} }));

beforeEach(() => { mmsSynth.mockClear(); play.mockClear(); });

describe('speak', () => {
  it('routes Greek to the ell model then plays', async () => {
    const { speak } = await import('./index.js');
    await speak('λόγος', 'grc');
    expect(mmsSynth).toHaveBeenCalledWith('λόγος', 'ell');
    expect(play).toHaveBeenCalledWith('buffer');
  });
  it('routes Hebrew to the heb model then plays', async () => {
    const { speak } = await import('./index.js');
    await speak('בראשית', 'hbo');
    expect(mmsSynth).toHaveBeenCalledWith('בראשית', 'heb');
    expect(play).toHaveBeenCalledWith('buffer');
  });
  it('rejects unsupported language without playing', async () => {
    const { speak } = await import('./index.js');
    await expect(speak('ריא', 'arc')).rejects.toThrow();
    expect(play).not.toHaveBeenCalled();
  });
});
