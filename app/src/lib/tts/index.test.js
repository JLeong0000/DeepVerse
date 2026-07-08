import { describe, it, expect, vi, beforeEach } from 'vitest';

const espeakSynth = vi.fn(async () => 'greek-buffer');
const mmsSynth = vi.fn(async () => 'hebrew-buffer');
const play = vi.fn();
vi.mock('./espeak.js', () => ({ synthesize: espeakSynth }));
vi.mock('./mms.js', () => ({ synthesize: mmsSynth }));
vi.mock('./player.js', () => ({ play, stop: vi.fn(), playing: {} }));

beforeEach(() => { espeakSynth.mockClear(); mmsSynth.mockClear(); play.mockClear(); });

describe('speak', () => {
  it('routes Greek to espeak then plays', async () => {
    const { speak } = await import('./index.js');
    await speak('λόγος', 'grc');
    expect(espeakSynth).toHaveBeenCalledWith('λόγος');
    expect(play).toHaveBeenCalledWith('greek-buffer');
  });
  it('routes Hebrew to mms then plays', async () => {
    const { speak } = await import('./index.js');
    await speak('בראשית', 'hbo');
    expect(mmsSynth).toHaveBeenCalledWith('בראשית');
    expect(play).toHaveBeenCalledWith('hebrew-buffer');
  });
  it('rejects unsupported language without playing', async () => {
    const { speak } = await import('./index.js');
    await expect(speak('ריא', 'arc')).rejects.toThrow();
    expect(play).not.toHaveBeenCalled();
  });
});
