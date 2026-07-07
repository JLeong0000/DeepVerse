// Minimal, dependency-free markdown for notes: bold, italic, inline code, headings, and un/ordered
// lists. HTML is escaped first, so rendering a user's own note via {@html} is safe.
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
export function renderMarkdown(md) {
  const lines = String(md || '').split(/\r?\n/);
  let html = '', list = null;
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of lines) {
    let m;
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; }
      html += `<li>${inline(m[1])}</li>`;
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; }
      html += `<li>${inline(m[1])}</li>`;
    } else if ((m = line.match(/^\s*(#{1,3})\s+(.*)$/))) {
      closeList(); html += `<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`;
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList(); html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}

// HTML for a note body. Notes are now authored as HTML (WYSIWYG contenteditable); older notes were
// saved as markdown, so render those on the fly.
export function noteHtml(body) {
  const s = String(body || '');
  return /<[a-z][\s\S]*>/i.test(s) ? s : renderMarkdown(s);
}

// True if a note body has no visible text (used for placeholders / empty checks).
export function noteIsEmpty(body) {
  return !String(body || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}
