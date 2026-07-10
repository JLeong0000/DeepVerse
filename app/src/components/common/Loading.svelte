<!-- Loading screen shown while bible.db loads: an open book riffling its pages,
     centered in the viewport with the DeepVerse wordmark beneath. The animation is
     an alpha WebP (background keyed out) so it sits on the parchment in either theme. -->
<div class="loading" role="status" aria-label="Loading">
  <div class="wordmark">DeepVerse</div>
  <img class="book" src="/book-loading.webp" alt="" width="392" height="280" />
</div>

<style>
  .loading {
    flex: 1; min-height: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 26px;
  }
  .book { width: 300px; max-width: 68vw; height: auto; }
  .wordmark {
    font-family: var(--serif);
    font-variant: small-caps; letter-spacing: .14em; font-size: 15px;
    color: var(--dim);
  }
</style>
