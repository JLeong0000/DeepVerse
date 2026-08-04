// Provide an in-memory IndexedDB for jsdom tests (jsdom has none).
import 'fake-indexeddb/auto';

// jsdom implements no Web Animations API either, and Svelte's in:/out: transitions call
// element.animate(). A no-op Animation is enough: tests assert on what is in the DOM, not on how it
// faded in. Without this, rendering any element with a transition throws "element.animate is not a
// function".
if (!Element.prototype.animate) {
  Element.prototype.animate = () => ({
    cancel() {}, finish() {}, pause() {}, play() {},
    startTime: 0, currentTime: 0, playState: 'finished', onfinish: null,
    finished: Promise.resolve(),
  });
}
