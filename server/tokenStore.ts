import fs from 'fs';
import path from 'path';

export type StoredTokens = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
};

export type StoredUserRecord = {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  folderId?: string;
  spreadsheetId?: string;
  calendarId?: string;
  tokens: StoredTokens;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'token-store.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): StoredUserRecord[] {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(records: StoredUserRecord[]) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2), 'utf8');
}

export function getUserRecord(userId: string): StoredUserRecord | undefined {
  return readStore().find((record) => record.userId === userId);
}

export function upsertUserRecord(record: Omit<StoredUserRecord, 'updatedAt'>) {
  const store = readStore();
  const next: StoredUserRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  const existingIndex = store.findIndex(
    (item) => item.userId === record.userId
  );
  if (existingIndex >= 0) {
    store[existingIndex] = { ...store[existingIndex], ...next };
  } else {
    store.push(next);
  }
  writeStore(store);
  return next;
}

export function updateUserRecord(
  userId: string,
  changes: Partial<StoredUserRecord>
) {
  const store = readStore();
  const index = store.findIndex((item) => item.userId === userId);
  if (index < 0) return undefined;

  // Deep merge for tokens to handle clearing
  const updatedRecord = { ...store[index], ...changes };
  if (changes.tokens !== undefined) {
    updatedRecord.tokens = changes.tokens as StoredTokens;
  }
  updatedRecord.updatedAt = new Date().toISOString();

  store[index] = updatedRecord;
  writeStore(store);
  return store[index];
}

export function deleteUserRecord(userId: string) {
  const store = readStore();
  const filtered = store.filter((item) => item.userId !== userId);
  const removed = filtered.length !== store.length;
  if (removed) {
    writeStore(filtered);
  }
  return removed;
}

export function listUserRecords() {
  return readStore();
}
