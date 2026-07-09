import { tokenize } from './vocab.js';
import { getContext } from './player.js';

// Meta MMS VITS, one checkpoint per language. Modern pronunciation; 16kHz mono.
const SAMPLE_RATE = 16000;
const MODEL_URL = { heb: '/tts/mms-heb.onnx', ell: '/tts/mms-ell.onnx' };
const sessions = {}; // model -> Promise<InferenceSession> (created once per language)

async function load(model) {
  if (!sessions[model]) {
    sessions[model] = (async () => {
      const ort = await import('onnxruntime-web');
      ort.env.wasm.wasmPaths = '/tts/ort/'; // vendored for offline
      return ort.InferenceSession.create(MODEL_URL[model]);
    })().catch((e) => { sessions[model] = null; throw e; }); // don't memoize a failed load
  }
  return sessions[model];
}

// model: 'heb' (Hebrew) or 'ell' (Greek). Text prep (Greek monotonic fold, Hebrew niqqud drop)
// lives in the tokenizer.
export async function synthesize(text, model) {
  const ort = await import('onnxruntime-web');
  const session = await load(model);
  const ids = tokenize(text, model);
  const shape = [1, ids.length];
  const input = new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), shape);
  const mask = new ort.Tensor('int64', BigInt64Array.from(ids, () => 1n), shape);
  // both exports take input_ids + attention_mask (inputNames[0]/[1])
  const feeds = { [session.inputNames[0]]: input, [session.inputNames[1]]: mask };
  const out = await session.run(feeds);
  const waveform = out[session.outputNames[0]].data; // Float32Array PCM @ 16kHz
  const buffer = getContext().createBuffer(1, waveform.length, SAMPLE_RATE);
  buffer.copyToChannel(waveform instanceof Float32Array ? waveform : Float32Array.from(waveform), 0);
  return buffer;
}
