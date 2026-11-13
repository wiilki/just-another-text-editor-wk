import { openDB } from 'idb';

const DB_NAME = 'jate-studio';
const STORE = 'documents';
const BACKUP_KEY = 'jate-studio-backup-v1';
let database;

function openStudioDatabase() {
  if (!database) {
    database = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      }
    }).catch(error => { database = null; throw error; });
  }
  return database;
}

function readBackup() {
  try {
    const list = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    return Array.isArray(list) ? list.filter(item => item && typeof item.id === 'string') : [];
  } catch { return []; }
}

// A secondary backup supports browsers which restrict IndexedDB. The IndexedDB
// copy remains available when localStorage is full or disabled.
export function mirrorDocuments(documents) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(documents));
    return true;
  } catch { return false; }
}

export async function loadDocuments() {
  const backup = readBackup();
  try {
    const fromDb = await (await openStudioDatabase()).getAll(STORE);
    if (!fromDb.length) return backup;
    // Use the newest copy if a previous IndexedDB write failed.
    const byId = new Map(fromDb.map(doc => [doc.id, doc]));
    for (const doc of backup) {
      const existing = byId.get(doc.id);
      if (!existing || (Number(doc.updatedAt) || 0) > (Number(existing.updatedAt) || 0)) {
        byId.set(doc.id, doc);
      }
    }
    return [...byId.values()];
  } catch {
    return backup;
  }
}

export async function saveDocument(document) {
  try {
    await (await openStudioDatabase()).put(STORE, document);
    return true;
  } catch {
    return false;
  }
}

export async function removeDocument(id) {
  try {
    await (await openStudioDatabase()).delete(STORE, id);
    return true;
  } catch {
    return false;
  }
}

export async function loadLegacyContent() {
  let text = '';
  try {
    // Reads from the original single-document JATE database; never removes it.
    const old = await openDB('jate', 1);
    if (old.objectStoreNames.contains('jate')) {
      const record = await old.get('jate', 1);
      if (typeof record?.value === 'string') text = record.value;
    }
    old.close();
  } catch {
    // Older versions might not have successfully created their database.
  }
  if (!text) {
    try { text = localStorage.getItem('content') || ''; } catch { /* private mode */ }
  }
  return text;
}
