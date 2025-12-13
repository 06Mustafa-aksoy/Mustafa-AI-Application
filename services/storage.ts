import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ChatSession } from "../types";

const DB_NAME = 'GeminiAppDB';
const STORE_NAME = 'chat_sessions';
const DB_VERSION = 2;

interface GeminiDB extends DBSchema {
  chat_sessions: {
    key: string;
    value: ChatSession;
  };
  // Definitions for legacy migration support
  sessions: {
    key: string;
    value: ChatSession[];
  };
}

let dbPromise: Promise<IDBPDatabase<GeminiDB>>;

const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<GeminiDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // 1. Create New Store if not exists
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }

        // 2. Migration: Recover data from old store if exists
        if (oldVersion < 2 && db.objectStoreNames.contains('sessions')) {
          const oldStore = transaction.objectStore('sessions');
          oldStore.get('all_sessions').then((oldData) => {
            if (Array.isArray(oldData)) {
              console.log("Migrating old data to new format...");
              const newStore = transaction.objectStore(STORE_NAME);
              oldData.forEach((session) => {
                newStore.put(session);
              });
            }
          }).catch(err => console.error("Migration error:", err));
        }
      },
    });
  }
  return dbPromise;
};

export const loadSessionsFromDB = async (): Promise<ChatSession[]> => {
  const db = await initDB();
  const sessions = await db.getAll(STORE_NAME);
  // Sort by creation date
  return sessions.sort((a, b) => a.createdAt - b.createdAt);
};

export const saveSessionsToDB = async (sessions: ChatSession[]): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  // Get all existing keys to identify deleted sessions
  const existingKeys = await store.getAllKeys();
  const newSessionIds = new Set(sessions.map(s => s.id));
  
  const deletePromises = existingKeys
    .filter(key => !newSessionIds.has(key as string))
    .map(key => store.delete(key as string));
    
  const putPromises = sessions.map(session => store.put(session));
  
  await Promise.all([...deletePromises, ...putPromises]);
  await tx.done;
};
