import '../css/style.css';
import Editor from './editor';
import { loadDocuments, saveDocument, removeDocument, loadLegacyContent, mirrorDocuments } from './database';
import { LANGUAGES, createDocument, detectLanguage, documentSummary, filenameFor, relativeDate, wordCount } from './document-utils.mjs';
import { renderMarkdown } from './markdown.mjs';

const $ = id => document.getElementById(id);
const ui = {
  list: $('documentList'), count: $('documentCount'), filteredCount: $('filteredCount'),
  search: $('documentSearch'), title: $('documentTitle'), breadcrumb: $('breadcrumbTitle'),
  save: $('saveStatus'), edited: $('lastEdited'), language: $('languageSelect'),
  editor: $('editor'), preview: $('previewPanel'), previewContent: $('previewContent'),
  surface: $('editingSurface'), wrap: $('wrapToggle'), previewToggle: $('previewToggle'),
  focus: $('focusToggle'), theme: $('themeToggle'), toast: $('toast'),
  words: $('wordCount'), characters: $('characterCount'), cursor: $('cursorPosition'),
  storage: $('storageLabel'), file: $('fileInput'), install: $('buttonInstall'),
  menu: $('mobileMenu'), sidebar: $('sidebar'), overlay: $('sidebarOverlay'),
  network: $('networkStatus'), shortcuts: $('shortcutsDialog'), delete: $('deleteDialog')
};
const getSetting = (key, fallback = '') => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};
const setSetting = (key, value) => {
  try { localStorage.setItem(key, String(value)); } catch { /* storage restricted */ }
};
const newDocumentButtons = [$('newTopButton'), $('newSidebarButton')];
let documents = [];
let activeId = null;
let editor;
let saveTimer;
let toastTimer;
let previewTimer;
let writeQueue = Promise.resolve();
let previewOn = false;
let wrapOn = getSetting('jate-studio-wrap', 'true') !== 'false';

const welcomeText = [
  '# Welcome to JATE Studio 👋',
  '',
  'A little room for big ideas. Write notes, draft stories, or keep code snippets together — even when you are offline.',
  '',
  '## Everything you need, nothing you do not',
  '',
  '- **Create documents** from the sidebar or the top-right button.',
  '- **Write freely.** Your changes save automatically to this device.',
  '- **Stay organized.** Search your library and rename your documents.',
  '- **Preview Markdown** side by side, or enter Focus mode.',
  '- **Bring your files.** Import plain text, Markdown, or code files.',
  '- **Take them anywhere.** Export a file or back up the entire library.',
  '',
  '## A few helpful shortcuts',
  '',
  '- **⌘ / Ctrl + N** — New document',
  '- **⌘ / Ctrl + S** — Save now',
  '- **⌘ / Ctrl + K** — Search documents',
  '- **⌘ / Ctrl + Shift + P** — Markdown preview',
  '',
  '> Your documents are stored in this browser, not on a server. Download a backup before clearing site data or switching devices.',
  '',
  'Happy writing! ✨'
].join('\n');

function current() {
  return documents.find(doc => doc.id === activeId) || null;
}

function notify(message) {
  clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add('visible');
  toastTimer = setTimeout(() => ui.toast.classList.remove('visible'), 3400);
}

function setSaveStatus(label, state = 'saved') {
  ui.save.textContent = label;
  ui.save.dataset.state = state;
  const dot = document.querySelector('.saved-indicator');
  if (dot) dot.style.backgroundColor = state === 'error' ? '#e95166' : state === 'saving' ? '#e6af52' : '#70cbaa';
}

function updateStats() {
  const doc = current();
  const value = doc?.content || '';
  const words = wordCount(value);
  ui.words.textContent = words + (words === 1 ? ' word' : ' words');
  ui.characters.textContent = value.length + (value.length === 1 ? ' character' : ' characters');
}

function refreshPreview() {
  if (!previewOn) return;
  const doc = current();
  if (!doc || doc.language !== 'markdown') return;
  ui.previewContent.innerHTML = renderMarkdown(doc.content);
}

function schedulePreview() {
  clearTimeout(previewTimer);
  if (previewOn) previewTimer = setTimeout(refreshPreview, 150);
}

function setPreview(enabled) {
  if (enabled && current()?.language !== 'markdown') {
    notify('Live preview is available for Markdown documents.');
    return;
  }
  previewOn = enabled;
  ui.preview.hidden = !enabled;
  ui.surface.classList.toggle('previewing', enabled);
  ui.previewToggle.classList.toggle('is-active', enabled);
  ui.previewToggle.setAttribute('aria-pressed', String(enabled));
  if (enabled) refreshPreview();
  requestAnimationFrame(() => editor.refresh());
}

function updateDocument(doc, change) {
  if (!doc) return;
  Object.assign(doc, change);
  doc.updatedAt = Math.max(Date.now(), (Number(doc.updatedAt) || 0) + 1);
  mirrorDocuments(documents);
  ui.edited.textContent = 'Edited ' + relativeDate(doc.updatedAt);
  setSaveStatus('Saving...', 'saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void saveActive(); }, 650);
}

function queueWrite(doc) {
  const snapshot = { ...doc };
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const savedToDb = await saveDocument(snapshot);
    const active = current();
    if (active && active.id === snapshot.id && active.updatedAt === snapshot.updatedAt) {
      if (savedToDb) {
        setSaveStatus('All changes saved');
        ui.storage.textContent = 'Saved on this device';
      } else if (mirrorDocuments(documents)) {
        setSaveStatus('Saved to local backup');
        ui.storage.textContent = 'Browser backup mode';
      } else {
        setSaveStatus('Save unavailable — export a copy', 'error');
        ui.storage.textContent = 'Storage unavailable';
        notify('Storage is unavailable. Please export your work.');
      }
    }
  });
  return writeQueue;
}

function saveActive() {
  clearTimeout(saveTimer);
  const doc = current();
  if (!doc) return Promise.resolve();
  mirrorDocuments(documents);
  return queueWrite(doc);
}

function closeMobileSidebar() {
  ui.sidebar.classList.remove('is-open');
  ui.overlay.hidden = true;
  ui.menu.setAttribute('aria-expanded', 'false');
}

function renderDocumentList() {
  const query = ui.search.value.trim().toLowerCase();
  const filtered = [...documents]
    .filter(doc => !query || doc.title.toLowerCase().includes(query) || doc.content.toLowerCase().includes(query))
    .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
  ui.count.textContent = documents.length;
  ui.filteredCount.textContent = query ? String(filtered.length) + ' found' : '';
  const fragment = document.createDocumentFragment();
  for (const doc of filtered) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'document-item' + (doc.id === activeId ? ' active' : '');
    button.setAttribute('aria-current', doc.id === activeId ? 'true' : 'false');
    button.innerHTML = '<span class="document-item-icon"><svg class="icon"><use href="#i-file"/></svg></span>';
    const details = document.createElement('span');
    details.className = 'document-item-body';
    const title = document.createElement('div');
    title.className = 'document-item-title';
    title.textContent = doc.title || 'Untitled document';
    const snippet = document.createElement('div');
    snippet.className = 'document-item-snippet';
    snippet.textContent = documentSummary(doc.content);
    const date = document.createElement('div');
    date.className = 'document-item-meta';
    date.textContent = (LANGUAGES[doc.language]?.label || 'Text') + ' · ' + relativeDate(doc.updatedAt);
    details.append(title, snippet, date);
    button.append(details);
    button.addEventListener('click', () => activate(doc.id, true));
    fragment.append(button);
  }
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-list';
    empty.textContent = query ? 'No documents match your search.' : 'No documents yet. Create one to get started.';
    fragment.append(empty);
  }
  ui.list.replaceChildren(fragment);
}

function activate(id, focusEditor = false) {
  if (activeId && activeId !== id) void saveActive();
  const doc = documents.find(item => item.id === id);
  if (!doc) return;
  activeId = doc.id;
  setSetting('jate-studio-active', id);
  ui.title.value = doc.title || 'Untitled document';
  ui.language.value = LANGUAGES[doc.language] ? doc.language : 'plain';
  ui.breadcrumb.textContent = doc.title || 'Untitled document';
  ui.edited.textContent = 'Edited ' + relativeDate(doc.updatedAt);
  editor.setDocument(doc);
  if (previewOn && doc.language !== 'markdown') setPreview(false);
  else refreshPreview();
  renderDocumentList();
  updateStats();
  ui.cursor.textContent = 'Ln 1, Col 1';
  setSaveStatus('All changes saved');
  closeMobileSidebar();
  if (focusEditor) editor.focus();
}

function addNewDocument() {
  void saveActive();
  const doc = createDocument();
  documents.unshift(doc);
  mirrorDocuments(documents);
  activate(doc.id, true);
  void saveActive();
  notify('New document created');
}

async function deleteCurrentDocument() {
  const doc = current();
  if (!doc) return;
  clearTimeout(saveTimer);
  // Queue removal after any write already in flight, preventing resurrection.
  documents = documents.filter(item => item.id !== doc.id);
  mirrorDocuments(documents);
  const deletedId = doc.id;
  writeQueue = writeQueue.catch(() => undefined).then(() => removeDocument(deletedId));
  ui.delete.close();
  if (!documents.length) {
    const blank = createDocument();
    documents.push(blank);
    mirrorDocuments(documents);
  }
  activeId = null;
  activate(documents[0].id);
  if (documents.length === 1) void saveActive();
  notify('Document deleted');
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportCurrent() {
  const doc = current();
  if (!doc) return;
  download(filenameFor(doc), doc.content, 'text/plain;charset=utf-8');
  notify('Document downloaded');
}

function exportAll() {
  const data = { format: 'jate-studio-backup', version: 1, exportedAt: new Date().toISOString(), documents };
  download('jate-studio-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
  notify('Your library backup is ready');
}

async function importFiles(files) {
  if (!files?.length) return;
  void saveActive();
  let count = 0;
  let tooLarge = 0;
  let lastId;
  for (const file of files) {
    if (file.size > 2 * 1024 * 1024) { tooLarge++; continue; }
    try {
      const content = await file.text();
      let incoming = [];
      if (/\.json$/i.test(file.name)) {
        try {
          const backup = JSON.parse(content);
          if (backup?.format === 'jate-studio-backup' && Array.isArray(backup.documents)) {
            incoming = backup.documents
              .filter(doc => doc && typeof doc.content === 'string' && typeof doc.title === 'string')
              .slice(0, 1000)
              .map(doc => createDocument(doc.title, doc.language, doc.content));
          }
        } catch { /* a regular JSON code file */ }
      }
      if (!incoming.length) {
        const language = detectLanguage(file.name);
        const title = file.name.replace(/\.[^.]+$/, '') || 'Imported document';
        incoming = [createDocument(title, language, content)];
      }
      for (const doc of incoming) {
        documents.unshift(doc);
        lastId = doc.id;
        queueWrite(doc);
        count++;
      }
    } catch { notify('Could not read ' + file.name); }
  }
  mirrorDocuments(documents);
  if (lastId) activate(lastId);
  if (tooLarge) notify(tooLarge + ' file(s) skipped; 2 MB limit per file.');
  else if (count) notify(count + (count === 1 ? ' document imported' : ' documents imported'));
  ui.file.value = '';
}

function setTheme(theme) {
  const value = theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = value;
  ui.theme.innerHTML = '<svg class="icon"><use href="#i-' + (value === 'dark' ? 'sun' : 'moon') + '"/></svg>';
  ui.theme.setAttribute('aria-label', value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  setSetting('jate-studio-theme', value);
  editor?.refresh();
}

function updateNetwork() {
  const offline = !navigator.onLine;
  ui.network.classList.toggle('offline', offline);
  ui.network.querySelector('span:last-child').textContent = offline ? 'Working offline' : 'Available offline';
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

function wireEvents() {
  newDocumentButtons.forEach(button => button.addEventListener('click', addNewDocument));
  ui.search.addEventListener('input', renderDocumentList);
  ui.title.addEventListener('input', () => {
    const doc = current();
    if (!doc) return;
    updateDocument(doc, { title: ui.title.value });
    ui.breadcrumb.textContent = ui.title.value || 'Untitled document';
    renderDocumentList();
  });
  ui.title.addEventListener('blur', () => {
    if (!ui.title.value.trim()) {
      ui.title.value = 'Untitled document';
      updateDocument(current(), { title: ui.title.value });
      renderDocumentList();
    }
  });
  ui.language.addEventListener('change', () => {
    const doc = current();
    if (!doc) return;
    updateDocument(doc, { language: ui.language.value });
    editor.setLanguage(ui.language.value);
    if (previewOn && ui.language.value !== 'markdown') setPreview(false);
    renderDocumentList();
  });
  ui.wrap.addEventListener('click', () => {
    wrapOn = !wrapOn;
    editor.setWrapping(wrapOn);
    ui.wrap.classList.toggle('is-active', wrapOn);
    ui.wrap.setAttribute('aria-pressed', String(wrapOn));
    setSetting('jate-studio-wrap', wrapOn);
  });
  ui.previewToggle.addEventListener('click', () => setPreview(!previewOn));
  ui.focus.addEventListener('click', () => {
    const enabled = document.body.classList.toggle('focus-mode');
    ui.focus.classList.toggle('is-active', enabled);
    ui.focus.setAttribute('aria-pressed', String(enabled));
    closeMobileSidebar();
    requestAnimationFrame(() => editor.refresh());
  });
  ui.theme.addEventListener('click', () => setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('importButton').addEventListener('click', () => ui.file.click());
  ui.file.addEventListener('change', () => { void importFiles([...ui.file.files]); });
  $('exportButton').addEventListener('click', exportCurrent);
  $('exportAllButton').addEventListener('click', exportAll);
  $('deleteButton').addEventListener('click', () => openDialog(ui.delete));
  $('confirmDelete').addEventListener('click', () => { void deleteCurrentDocument(); });
  $('cancelDelete').addEventListener('click', () => ui.delete.close());
  $('shortcutsButton').addEventListener('click', () => openDialog(ui.shortcuts));
  document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  ui.menu.addEventListener('click', () => {
    const open = !ui.sidebar.classList.contains('is-open');
    ui.sidebar.classList.toggle('is-open', open);
    ui.overlay.hidden = !open;
    ui.menu.setAttribute('aria-expanded', String(open));
  });
  ui.overlay.addEventListener('click', closeMobileSidebar);
  window.addEventListener('online', updateNetwork);
  window.addEventListener('offline', updateNetwork);
  document.addEventListener('keydown', event => {
    const command = event.metaKey || event.ctrlKey;
    if (!command || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'n') { event.preventDefault(); addNewDocument(); }
    else if (key === 's') { event.preventDefault(); void saveActive().then(() => notify('Saved')); }
    else if (key === 'k') {
      event.preventDefault();
      if (window.matchMedia('(max-width:720px)').matches) {
        ui.sidebar.classList.add('is-open'); ui.overlay.hidden = false;
        ui.menu.setAttribute('aria-expanded', 'true');
      }
      ui.search.focus(); ui.search.select();
    }
    else if (event.shiftKey && key === 'p') { event.preventDefault(); setPreview(!previewOn); }
    else if (event.shiftKey && key === 'e') { event.preventDefault(); exportCurrent(); }
  });
  window.addEventListener('beforeunload', () => {
    // localStorage is mirrored synchronously at every edit; IndexedDB saves are debounced.
    mirrorDocuments(documents);
  });
  window.addEventListener('dragover', event => {
    if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
  });
  window.addEventListener('drop', event => {
    if (event.dataTransfer?.files?.length) {
      event.preventDefault();
      void importFiles([...event.dataTransfer.files]);
    }
  });
}

function wireInstallation() {
  let pendingPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pendingPrompt = event;
    ui.install.hidden = false;
  });
  ui.install.addEventListener('click', async () => {
    if (!pendingPrompt) return;
    const prompt = pendingPrompt;
    pendingPrompt = null;
    ui.install.hidden = true;
    await prompt.prompt();
  });
  window.addEventListener('appinstalled', () => {
    pendingPrompt = null;
    ui.install.hidden = true;
    notify('JATE Studio installed');
  });
}

async function initialize() {
  editor = new Editor(ui.editor, content => {
    const doc = current();
    if (!doc) return;
    updateDocument(doc, { content });
    updateStats();
    schedulePreview();
    if (!ui.search.value) {
      const selected = ui.list.querySelector('.document-item.active .document-item-snippet');
      if (selected) selected.textContent = documentSummary(content);
    } else renderDocumentList();
  }, (line, column) => { ui.cursor.textContent = 'Ln ' + line + ', Col ' + column; });
  editor.setWrapping(wrapOn);
  ui.wrap.classList.toggle('is-active', wrapOn);
  ui.wrap.setAttribute('aria-pressed', String(wrapOn));
  setTheme(getSetting('jate-studio-theme', 'light'));
  wireEvents();
  wireInstallation();
  updateNetwork();

  documents = await loadDocuments();
  documents = documents.filter(doc => doc && typeof doc.id === 'string' && typeof doc.content === 'string');
  if (!documents.length) {
    const legacy = await loadLegacyContent();
    const starter = legacy
      ? createDocument('My original JATE note', 'javascript', legacy)
      : createDocument('Welcome to JATE Studio', 'markdown', welcomeText);
    documents = [starter];
    mirrorDocuments(documents);
    await saveDocument(starter);
  }
  const preferred = getSetting('jate-studio-active');
  const initial = documents.find(doc => doc.id === preferred) || [...documents].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  activate(initial.id);
  document.querySelector('.workspace-footer').title = 'Your documents are private to this browser; export a backup to move them between devices.';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const registerOffline = () => navigator.serviceWorker.register('./src-sw.js').catch(error => {
      console.warn('Offline service worker could not be registered', error);
    });
    if (document.readyState === 'complete') registerOffline();
    else window.addEventListener('load', registerOffline, { once: true });
  }
}

initialize().catch(error => {
  console.error('JATE Studio could not start', error);
  $('editor').textContent = 'Sorry, the editor could not load. Reload the page or try an updated browser.';
  notify('Unable to initialize the editor');
});
