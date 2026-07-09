import { describe, it, expect } from 'vitest';
import { route, canSpeak } from './router.js';

describe('tts router', () => {
  it('routes Greek to the ell model', () => {
    expect(route('grc')).toBe('ell');
    expect(route('G3056')).toBe('ell');
  });
  it('routes Hebrew to the heb model', () => {
    expect(route('hbo')).toBe('heb');
    expect(route('H7225')).toBe('heb');
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
