import { describe, it, expect } from 'vitest';
import { route, canSpeak } from './router.js';

describe('tts router', () => {
  it('routes Greek to espeak', () => {
    expect(route('grc')).toBe('espeak');
    expect(route('G3056')).toBe('espeak');
  });
  it('routes Hebrew to mms', () => {
    expect(route('hbo')).toBe('mms');
    expect(route('H7225')).toBe('mms');
  });
  it('returns null for Aramaic, empty, and unknown', () => {
    expect(route('arc')).toBe(null);
    expect(route('')).toBe(null);
    expect(route(undefined)).toBe(null);
    expect(route('xyz')).toBe(null);
  });
  it('canSpeak mirrors route', () => {
    expect(canSpeak('grc')).toBe(true);
    expect(canSpeak('hbo')).toBe(true);
    expect(canSpeak('arc')).toBe(false);
    expect(canSpeak('')).toBe(false);
  });
});
