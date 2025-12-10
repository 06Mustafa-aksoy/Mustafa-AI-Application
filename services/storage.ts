import { ChatSession } from "../types";

const DB_NAME = 'GeminiAppDB';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;
const STORAGE_KEY = 'all_sessions';

/**
 * Opens (or creates) the IndexedDB database.
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`IndexedDB error: ${request.error?.message}`));
  });
};

/**
 * Saves the entire sessions array to IndexedDB.
 */
export const saveSessionsToDB = async (sessions: ChatSession[]): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(sessions, STORAGE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save sessions: ${request.error?.message}`));
    });
  } catch (error) {
    console.error("Error saving to IndexedDB:", error);
    throw error;
  }
};

/**
 * Loads the sessions array from IndexedDB.
 */
export const loadSessionsFromDB = async (): Promise<ChatSession[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(STORAGE_KEY);

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(new Error(`Failed to load sessions: ${request.error?.message}`));
    });
  } catch (error) {
    console.error("Error loading from IndexedDB:", error);
    return [];
  }
};
