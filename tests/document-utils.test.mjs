import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, detectLanguage, filenameFor, wordCount, relativeDate, documentSummary } from '../client/src/js/document-utils.mjs';
import { escapeHtml, renderMarkdown } from '../client/src/js/markdown.mjs';

test('detects supported file extensions', () => {
  assert.equal(detectLanguage('essay.md'), 'markdown');
  assert.equal(detectLanguage('APP.JSON'), 'json');
  assert.equal(detectLanguage('page.html'), 'html');
  assert.equal(detectLanguage('photo.png'), 'plain');
});

test('creates independently identified documents with sane defaults', () => {
  const first = createDocument();
  const second = createDocument('Styles', 'css', 'a { color: red; }');
  assert.notEqual(first.id, second.id);
  assert.equal(first.language, 'markdown');
  assert.equal(second.content, 'a { color: red; }');
  assert.ok(second.createdAt <= second.updatedAt);
});

test('makes safe filename preserving correct extension', () => {
  assert.equal(filenameFor({title:'Draft',language:'markdown'}), 'Draft.md');
  assert.equal(filenameFor({title:'draft.md',language:'markdown'}), 'draft.md');
  assert.equal(filenameFor({title:'../../x:<bad>',language:'javascript'}), 'x--bad-.js');
  assert.equal(filenameFor({title:'',language:'plain'}), 'Untitled document.txt');
});

test('counts words, summarizes headings, formats recent edits', () => {
  assert.equal(wordCount(' Hello  beautiful\nworld '), 3);
  assert.equal(wordCount('   '), 0);
  assert.equal(documentSummary('\n# Important heading\nSecond line'), 'Important heading');
  assert.equal(relativeDate(1000, 1000), 'Just now');
  assert.equal(relativeDate(1000, 181000), '3m ago');
});

test('renders common Markdown without enabling raw HTML', () => {
  const html = renderMarkdown('# Title\n\n**Strong** *emphasis*\n\n- First\n- Second');
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>Strong<\/strong>/);
  assert.match(html, /<em>emphasis<\/em>/);
  assert.match(html, /<li>First<\/li>/);
  assert.match(html, /<li>Second<\/li>/);
  assert.match(html, /<\/ul>/);
});

test('escapes scripts and markup in Markdown and code', () => {
  const attack = '<img src=x onerror=alert(1)>';
  assert.equal(escapeHtml(attack), '&lt;img src=x onerror=alert(1)&gt;');
  const html = renderMarkdown('# <script>alert(1)</script>\n\n' + attack + '\n' + String.fromCharCode(96).repeat(3) + '\n<script>\n' + String.fromCharCode(96).repeat(3));
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;/);
});

test('only links HTTP(S) URLs and adds opener protection', () => {
  const html = renderMarkdown('[safe](https://example.com) [no](javascript:alert(1))');
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /href="javascript:/);
});
