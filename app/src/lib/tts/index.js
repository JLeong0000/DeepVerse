import { route, canSpeak } from './router.js';
import { play, stop, playing } from './player.js';
import { synthesize as espeak } from './espeak.js';
import { synthesize as mms } from './mms.js';

const ENGINES = { espeak, mms };

export { canSpeak, stop, playing };

export async function speak(text, lang) {
  const key = route(lang);
  if (!key) throw new Error(`No TTS engine for lang: ${lang}`);
  // Drop trailing punctuation/markers (mirrors getWordOfDay); the study card's word comes
  // straight from getInterlinear and may carry a trailing ¶ / . / · etc.
  const clean = String(text).replace(/[¶.,;:·''"]+$/u, '').trim();
  const buffer = await ENGINES[key](clean);
  play(buffer);
}
