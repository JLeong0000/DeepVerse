import { getContext } from './player.js';

// Greek TTS via espeak-ng compiled to WASM (the "espeakng.js" emscripten build), running in a
// Web Worker entirely in-browser. The `grc` voice gives ancient/Koine pronunciation of polytonic
// NT text. The worker + its ~2.4MB voice data live under public/tts/espeak/ (lazy-fetched on first
// use, runtime-cached for offline). espeak-ng and the worker glue are GPL-3.0; this thin ESM wrapper
// is derived from espeakng.js (Copyright 2014-2017 Eitan Isaacson, GPL-3.0).
const WORKER_URL = '/tts/espeak/espeakng.worker.js';
const SAMPLE_RATE = 22050; // espeak-ng emscripten output rate

let enginePromise = null;

// Resolve once the worker reports 'ready', wiring up its callback-dispatch protocol.
function createEngine() {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL);
    const callbacks = {};
    worker.onmessage = (e) => {
      if (e.data !== 'ready') return;
      worker.onmessage = null;
      worker.addEventListener('message', (evt) => {
        const cb = callbacks[evt.data.callback];
        if (!cb) return;
        cb(...evt.data.result);
        if (evt.data.done) delete callbacks[evt.data.callback];
      });
      resolve({ worker, callbacks });
    };
    worker.onerror = (e) => reject(new Error(`espeak worker failed: ${e.message || e}`));
  });
}

// Post a method call to the worker; if `cb` is given, register it under a unique key the worker
// echoes back on each result (streamed synthesis calls it repeatedly, with done=true on the last).
function call({ worker, callbacks }, method, args, cb) {
  const message = { method, args };
  let key;
  if (cb) {
    key = `_${method}_${Math.random().toString().slice(2)}_cb`;
    callbacks[key] = cb;
    message.callback = key;
  }
  worker.postMessage(message);
  return key;
}

async function getEngine() {
  if (!enginePromise) {
    enginePromise = createEngine();
    // Fetching the ~2.4MB worker/data can fail (offline first-play, transient error). Don't memoize
    // the rejection — clear it so the next play retries instead of being permanently dead.
    enginePromise.catch(() => { enginePromise = null; });
  }
  return enginePromise;
}

export async function synthesize(text) {
  const engine = await getEngine();
  call(engine, 'set_voice', ['grc']);
  // espeak-ng's grc default is low-pitched (~100Hz) and deliberate, which reads as a deep, slow
  // rumble. Nudge pitch and rate up for a more natural read (espeak stays robotic — formant synth).
  call(engine, 'set_rate', [180]);  // words/min (default ~175)
  call(engine, 'set_pitch', [70]);  // 0-99 (default 50) — higher = less deep
  const chunks = [];
  return new Promise((resolve, reject) => {
    let key;
    const timer = setTimeout(() => {
      if (key) delete engine.callbacks[key]; // don't leak the closure if the worker never replies
      reject(new Error('espeak synthesize timed out'));
    }, 15000);
    key = call(engine, 'synthesize', [String(text)], (samples) => {
      if (samples) { chunks.push(new Float32Array(samples)); return; } // streamed chunk
      clearTimeout(timer); // null samples => done
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const pcm = new Float32Array(total);
      let offset = 0;
      for (const c of chunks) { pcm.set(c, offset); offset += c.length; }
      const buffer = getContext().createBuffer(1, pcm.length || 1, SAMPLE_RATE);
      buffer.copyToChannel(pcm, 0);
      resolve(buffer);
    });
  });
}
