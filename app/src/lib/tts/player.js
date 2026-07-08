import { writable } from 'svelte/store';

export const playing = writable(false);

let ctx = null;
let current = null; // the active AudioBufferSourceNode

export function getContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function stop() {
  if (current) {
    try { current.stop(); } catch { /* already stopped */ }
    current = null;
  }
  playing.set(false);
}

export function play(audioBuffer) {
  stop();
  const c = getContext();
  const src = c.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(c.destination);
  src.onended = () => { if (current === src) { current = null; playing.set(false); } };
  current = src;
  src.start();
  playing.set(true);
}
