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
  sessions: { // Eski veri tipi (Migration için)
    key: string;
    value: ChatSession[];
  };
}

let dbPromise: Promise<IDBPDatabase<GeminiDB>>;

const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<GeminiDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        // Migration: Eski veriyi kurtarma
        if (oldVersion < 2 && db.objectStoreNames.contains('sessions')) {
          const oldStore = transaction.objectStore('sessions');
          oldStore.get('all_sessions').then((oldData) => {
            if (Array.isArray(oldData)) {
              console.log("Eski veriler kurtarılıyor...");
              const newStore = transaction.objectStore(STORE_NAME);
              oldData.forEach((session) => {
                newStore.put(session);
              });
            }
          });
        }
      },
    });
  }
  return dbPromise;
};

// --- GÜVENLİ METODLAR ---

export const loadSessionsFromDB = async (): Promise<ChatSession[]> => {
  try {
    const db = await initDB();
    const sessions = await db.getAll(STORE_NAME);
    // En yeni tarihli en üstte olacak şekilde sırala
    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error("Yükleme hatası:", error);
    return [];
  }
};

// TEKİL KAYDETME: Sadece gönderilen session'ı günceller. Diğerlerini silmez.
export const saveSessionToDB = async (session: ChatSession): Promise<void> => {
  try {
    const db = await initDB();
    await db.put(STORE_NAME, session);
  } catch (error) {
    console.error("Kaydetme hatası:", error);
  }
};

// TEKİL SİLME: Sadece bu ID'yi siler.
export const deleteSessionFromDB = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    await db.delete(STORE_NAME, id);
  } catch (error) {
    console.error("Silme hatası:", error);
  }
};