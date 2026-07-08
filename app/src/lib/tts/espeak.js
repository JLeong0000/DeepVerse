import { getContext } from './player.js';

let engine = null; // memoized text2wav fn

async function load() {
  if (!engine) engine = (await import('text2wav')).default;
  return engine;
}

// Greek: espeak-ng 'grc' (ancient) reads polytonic NT text with ancient vowel values.
export async function synthesize(text) {
  const t2w = await load();
  const wav = await t2w(String(text), { voice: 'grc' }); // Uint8Array, WAV bytes
  // decodeAudioData needs an ArrayBuffer copy (not a shared view)
  const buf = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength);
  return await getContext().decodeAudioData(buf);
}
