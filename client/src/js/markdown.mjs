// Deliberately small, escaped Markdown renderer. It never inserts user HTML.
export function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inline(text) {
  const codeSpans = [];
  let safe = escapeHtml(text).replace(/\x60([^\x60]+)\x60/g, (_, content) => {
    const index = codeSpans.push('<code>' + content + '</code>') - 1;
    return '\u0001' + index + '\u0001';
  });
  safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_, label, url) =>
    '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>'
  );
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  safe = safe.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return safe.replace(/\u0001(\d+)\u0001/g, (_, index) => codeSpans[Number(index)] || '');
}

export function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let list = null;
  let paragraph = [];
  let code = null;
  let codeLines = [];
  const flushParagraph = () => {
    if (paragraph.length) output.push('<p>' + inline(paragraph.join(' ')) + '</p>');
    paragraph = [];
  };
  const closeList = () => {
    if (list) output.push('</' + list + '>');
    list = null;
  };
  for (const line of lines) {
    const fence = line.match(/^\s*\x60{3}([a-zA-Z0-9_-]*)\s*$/);
    if (fence) {
      flushParagraph();
      closeList();
      if (code !== null) {
        output.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
        code = null;
        codeLines = [];
      } else {
        code = fence[1] || '';
      }
      continue;
    }
    if (code !== null) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length, 6);
      output.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
      continue;
    }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushParagraph();
      closeList();
      output.push('<hr>');
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      output.push('<blockquote>' + inline(quote[1]) + '</blockquote>');
      continue;
    }
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const type = ordered ? 'ol' : 'ul';
      if (list !== type) { closeList(); output.push('<' + type + '>'); list = type; }
      output.push('<li>' + inline((ordered || unordered)[1]) + '</li>');
      continue;
    }
    closeList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  closeList();
  if (code !== null) output.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
  return output.join('\n') || '<p class="preview-hint">Start writing to see your preview here.</p>';
}
