# JATE Studio

A clean, offline-first writing and code workspace. Rebuilt from the original **Just Another Text Editor** project with a document library, modern interface, and reliable local persistence.

## Highlights

- **Multiple documents.** Create, rename, search, switch, and delete notes and snippets.
- **Code-aware editor.** Bundled CodeMirror with line numbers, active-line highlighting, indentation, wrapping, and syntax modes for Markdown, plain text, JavaScript, JSON, HTML, and CSS.
- **Markdown preview.** Live side-by-side preview with escaped user input and safe HTTP(S) links.
- **Local-first autosave.** Debounced saves in IndexedDB, a localStorage backup, a save indicator, and fallback handling for restricted storage.
- **Legacy note migration.** Imports the original JATE note from the old IndexedDB database or localStorage the first time the new app runs; does not delete the old note.
- **Import and export.** Open multiple text/code files (or drag and drop), download a document, or back up/restore the document library in JSON.
- **Installable and offline.** Has an install prompt, PWA manifest, and precached app-shell assets. No CDN JavaScript is needed for the editor.
- **Light and dark themes, focus mode, search and keyboard shortcuts.** Works on desktop and smaller screens.

**Privacy:** Documents stay in the browser on the device where you create them. There is no account, automatic cloud synchronization, or remote storage. Export a library backup before clearing site data or switching browsers/devices.

## Run locally

Requires Node.js 20 or newer.

    npm install
    npm run build
    npm start

Open http://localhost:3000. To run the webpack development server, use `npm run dev` (port 3001).

## Verify

    npm test
    npm run build

The test suite covers safe Markdown rendering, language detection, document utilities and file naming. The GitHub Actions workflow checks the build and verifies that the server responds successfully.

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| New document | Cmd/Ctrl + N |
| Save now | Cmd/Ctrl + S |
| Search documents | Cmd/Ctrl + K |
| Toggle Markdown preview | Cmd/Ctrl + Shift + P |
| Download current document | Cmd/Ctrl + Shift + E |

## Deploy

This is a Node/Express app. On any Node-capable host, set **Build command** to `npm install && npm run build`, **Start command** to `npm start`, and use the host's assigned `PORT` variable. For browser installation and service workers, use HTTPS (localhost is also supported).

## Important behavior

- File imports are limited to 2 MB per file to avoid inadvertently overwhelming browser storage.
- All data is stored on the current device. Browsing in private mode or clearing storage can remove it.
- Markdown preview intentionally supports common Markdown elements rather than arbitrary raw HTML. That prevents scripts pasted into a note from running.
- Some browsers suppress PWA install prompts; the editor remains usable in a normal browser tab.

## Structure

- `client/` — editor, UI, persistence and PWA
- `server/` — Express static server for the compiled app
- `tests/` — Node test suite
- `.github/workflows/verify.yml` — CI build, test and server smoke check
