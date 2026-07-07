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

// Apply a formatting action to a <textarea>'s current selection, in place.
export function applyFormat(ta, type) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e);
  let before = value.slice(0, s), after = value.slice(e), insert = sel, ns = s, ne = e;

  const wrap = (mark, ph) => { const t = sel || ph; insert = mark + t + mark; ns = s + mark.length; ne = ns + t.length; };
  const perLine = (fn) => {
    const ls = value.lastIndexOf('\n', s - 1) + 1;
    const leIdx = value.indexOf('\n', e);
    const end = leIdx === -1 ? value.length : leIdx;
    const block = value.slice(ls, end).split('\n').map(fn).join('\n');
    before = value.slice(0, ls); after = value.slice(end); insert = block; ns = ls; ne = ls + block.length;
  };

  switch (type) {
    case 'bold': wrap('**', 'bold'); break;
    case 'italic': wrap('*', 'italic'); break;
    case 'code': wrap('`', 'code'); break;
    case 'heading': perLine((l) => (l.startsWith('## ') ? l.slice(3) : '## ' + l)); break;
    case 'bullet': perLine((l) => (/^[-*]\s/.test(l) ? l.replace(/^[-*]\s/, '') : '- ' + l)); break;
    case 'number': perLine((l, i) => (/^\d+\.\s/.test(l) ? l.replace(/^\d+\.\s/, '') : `${i + 1}. ` + l)); break;
  }
  ta.value = before + insert + after;
  ta.focus();
  ta.setSelectionRange(ns, ne);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
