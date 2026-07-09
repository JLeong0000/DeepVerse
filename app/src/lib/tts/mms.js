import { tokenize } from './vocab.js';
import { getContext } from './player.js';

const SAMPLE_RATE = 16000;
let sessionPromise = null;

async function load() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import('onnxruntime-web');
      ort.env.wasm.wasmPaths = '/tts/ort/'; // vendored for offline (Task 10)
      return ort.InferenceSession.create('/tts/mms-heb.onnx');
    })();
  }
  return sessionPromise;
}

// Hebrew: MMS VITS. Modern pronunciation; niqqud is discarded by the tokenizer.
export async function synthesize(text) {
  const ort = await import('onnxruntime-web');
  const session = await load();
  const ids = tokenize(text);
  const shape = [1, ids.length];
  const input = new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), shape);
  const mask = new ort.Tensor('int64', BigInt64Array.from(ids, () => 1n), shape);
  // this export requires both input_ids and attention_mask (session.inputNames[0]/[1])
  const feeds = { [session.inputNames[0]]: input, [session.inputNames[1]]: mask };
  const out = await session.run(feeds);
  const waveform = out[session.outputNames[0]].data; // Float32Array PCM @ 16kHz
  const buffer = getContext().createBuffer(1, waveform.length, SAMPLE_RATE);
  buffer.copyToChannel(waveform instanceof Float32Array ? waveform : Float32Array.from(waveform), 0);
  return buffer;
}
