export const LANGUAGES = {
  markdown: { label: 'Markdown', extension: 'md', mode: 'gfm' },
  plain: { label: 'Plain text', extension: 'txt', mode: null },
  javascript: { label: 'JavaScript', extension: 'js', mode: 'javascript' },
  json: { label: 'JSON', extension: 'json', mode: { name: 'javascript', json: true } },
  html: { label: 'HTML', extension: 'html', mode: 'htmlmixed' },
  css: { label: 'CSS', extension: 'css', mode: 'css' }
};

const EXTENSIONS = {
  md: 'markdown', markdown: 'markdown', js: 'javascript', jsx: 'javascript',
  ts: 'javascript', tsx: 'javascript', json: 'json', html: 'html',
  htm: 'html', css: 'css'
};

export function detectLanguage(filename) {
  const extension = String(filename || '').split('.').pop().toLowerCase();
  return EXTENSIONS[extension] || 'plain';
}

export function createDocument(title = 'Untitled document', language = 'markdown', content = '') {
  const now = Date.now();
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'doc-' + now + '-' + Math.random().toString(36).slice(2, 10);
  return { id, title, language: LANGUAGES[language] ? language : 'plain', content, createdAt: now, updatedAt: now };
}

export function wordCount(content) {
  const trimmed = String(content || '').trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

export function filenameFor(document) {
  const language = LANGUAGES[document.language] || LANGUAGES.plain;
  const safe = (document.title || 'Untitled document')
    .trim().split(/[\\/]/).pop()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/^\.+/, '')
    .slice(0, 90) || 'Untitled document';
  const extension = '.' + language.extension;
  return safe.toLowerCase().endsWith(extension) ? safe : safe + extension;
}

export function documentSummary(content) {
  return String(content || '').split(/\r?\n/).map(line => line.replace(/^(\s*[#>*-]+\s*)/, '').trim()).find(Boolean) || 'Empty document';
}

export function relativeDate(timestamp, now = Date.now()) {
  const diff = Math.max(0, now - (Number(timestamp) || now));
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
