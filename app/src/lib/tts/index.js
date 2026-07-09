import { route, canSpeak } from './router.js';
import { play, stop, playing } from './player.js';
import { synthesize } from './mms.js';

export { canSpeak, stop, playing };

export async function speak(text, lang) {
  const model = route(lang);
  if (!model) throw new Error(`No TTS engine for lang: ${lang}`);
  // Drop trailing punctuation/markers (mirrors getWordOfDay); the study card's word comes
  // straight from getInterlinear and may carry a trailing ¶ / . / · etc.
  const clean = String(text).replace(/[¶.,;:·''"]+$/u, '').trim();
  const buffer = await synthesize(clean, model);
  play(buffer);
}
