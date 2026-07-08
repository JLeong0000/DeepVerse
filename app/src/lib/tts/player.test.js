import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

let started, stopped;
class FakeSource {
  constructor() { this.onended = null; }
  connect() {}
  start() { started++; }
  stop() { stopped++; if (this.onended) this.onended(); }
}
class FakeContext {
  constructor() { this.destination = {}; }
  createBufferSource() { return new FakeSource(); }
}

beforeEach(() => {
  started = 0; stopped = 0;
  vi.stubGlobal('AudioContext', FakeContext);
  vi.resetModules();
});

it('play starts a source and sets playing true', async () => {
  const { play, playing } = await import('./player.js');
  play({});
  expect(started).toBe(1);
  expect(get(playing)).toBe(true);
});

it('a second play stops the first', async () => {
  const { play } = await import('./player.js');
  play({}); play({});
  expect(stopped).toBe(1);
  expect(started).toBe(2);
});
