import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ChatSession, MemoryItem } from "../types";

const DB_NAME = 'MustafaAIDB';
const SESSIONS_STORE = 'chat_sessions';
const MEMORY_STORE = 'app_memory';
const DB_VERSION = 3;

const LOCALSTORAGE_SESSIONS_KEY = 'mustafa_ai_sessions_backup';
const LOCALSTORAGE_MEMORY_KEY = 'mustafa_ai_memory_backup';

interface MustafaAIDB extends DBSchema {
  chat_sessions: {
    key: string;
    value: ChatSession;
  };
  app_memory: {
    key: string;
    value: MemoryItem;
  };
  // Migration support
  sessions?: { key: string; value: ChatSession[]; };
}

let dbPromise: Promise<IDBPDatabase<MustafaAIDB>> | null = null;

/**
 * Requests the browser to mark storage as persistent so it is never evicted after days of inactivity.
 */
export const requestStoragePersistence = async (): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) return true;
      const granted = await navigator.storage.persist();
      return granted;
    } catch (e) {
      console.warn("Storage persistence check failed:", e);
      return false;
    }
  }
  return false;
};

export const checkStoragePersistence = async (): Promise<{ persisted: boolean; quota?: number; usage?: number }> => {
  let persisted = false;
  let quota: number | undefined;
  let usage: number | undefined;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    if (navigator.storage.persisted) {
      try {
        persisted = await navigator.storage.persisted();
      } catch (e) {
        // ignore
      }
    }
    if (navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        quota = estimate.quota;
        usage = estimate.usage;
      } catch (e) {
        // ignore
      }
    }
  }
  return { persisted, quota, usage };
};

const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<MustafaAIDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MEMORY_STORE)) {
          db.createObjectStore(MEMORY_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

// ===================== CHAT SESSIONS =====================

export const loadSessionsFromDB = async (): Promise<ChatSession[]> => {
  try {
    const db = await initDB();
    const sessions = await db.getAll(SESSIONS_STORE);
    if (sessions && sessions.length > 0) {
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    // Check localStorage fallback if IndexedDB is empty
    const backupRaw = localStorage.getItem(LOCALSTORAGE_SESSIONS_KEY);
    if (backupRaw) {
      const backupSessions: ChatSession[] = JSON.parse(backupRaw);
      // Restore to IndexedDB
      for (const s of backupSessions) {
        await db.put(SESSIONS_STORE, s);
      }
      return backupSessions.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return [];
  } catch (error) {
    console.error("Yükleme hatası (IndexedDB), localStorage deneniyor:", error);
    try {
      const backupRaw = localStorage.getItem(LOCALSTORAGE_SESSIONS_KEY);
      if (backupRaw) {
        return JSON.parse(backupRaw);
      }
    } catch (lsErr) {
      console.error("localStorage yedeği de okunamadı:", lsErr);
    }
    return [];
  }
};

export const saveSessionToDB = async (session: ChatSession): Promise<void> => {
  try {
    const db = await initDB();
    await db.put(SESSIONS_STORE, session);
    
    // Also save light version or full to localStorage as dual safety
    try {
      const currentBackup = localStorage.getItem(LOCALSTORAGE_SESSIONS_KEY);
      let list: ChatSession[] = currentBackup ? JSON.parse(currentBackup) : [];
      const idx = list.findIndex(s => s.id === session.id);
      if (idx >= 0) {
        list[idx] = session;
      } else {
        list.unshift(session);
      }
      // Keep up to latest 50 sessions in localStorage to prevent exceeding quota
      if (list.length > 50) list = list.slice(0, 50);
      localStorage.setItem(LOCALSTORAGE_SESSIONS_KEY, JSON.stringify(list));
    } catch (e) {
      // localStorage quota exceeded or disabled
    }
  } catch (err) {
    console.error("Session kaydetme hatası:", err);
  }
};

export const deleteSessionFromDB = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    await db.delete(SESSIONS_STORE, id);
    try {
      const currentBackup = localStorage.getItem(LOCALSTORAGE_SESSIONS_KEY);
      if (currentBackup) {
        const list: ChatSession[] = JSON.parse(currentBackup);
        const filtered = list.filter(s => s.id !== id);
        localStorage.setItem(LOCALSTORAGE_SESSIONS_KEY, JSON.stringify(filtered));
      }
    } catch (e) {}
  } catch (err) {
    console.error("Session silme hatası:", err);
  }
};

// ===================== LONG-TERM AI MEMORY =====================

export const loadMemoriesFromDB = async (): Promise<MemoryItem[]> => {
  try {
    const db = await initDB();
    const memories = await db.getAll(MEMORY_STORE);
    if (memories && memories.length > 0) {
      return memories.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.updatedAt - a.updatedAt);
    }
    const backupRaw = localStorage.getItem(LOCALSTORAGE_MEMORY_KEY);
    if (backupRaw) {
      const backupMemories: MemoryItem[] = JSON.parse(backupRaw);
      for (const m of backupMemories) {
        await db.put(MEMORY_STORE, m);
      }
      return backupMemories;
    }
    // Default initial seed memories if brand new
    return defaultInitialMemories;
  } catch (err) {
    console.error("Hafıza yükleme hatası:", err);
    try {
      const backupRaw = localStorage.getItem(LOCALSTORAGE_MEMORY_KEY);
      if (backupRaw) return JSON.parse(backupRaw);
    } catch (e) {}
    return defaultInitialMemories;
  }
};

export const saveMemoryToDB = async (memory: MemoryItem): Promise<void> => {
  try {
    const db = await initDB();
    await db.put(MEMORY_STORE, memory);
    try {
      const all = await db.getAll(MEMORY_STORE);
      localStorage.setItem(LOCALSTORAGE_MEMORY_KEY, JSON.stringify(all));
    } catch (e) {}
  } catch (err) {
    console.error("Hafıza kaydetme hatası:", err);
  }
};

export const deleteMemoryFromDB = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    await db.delete(MEMORY_STORE, id);
    try {
      const all = await db.getAll(MEMORY_STORE);
      localStorage.setItem(LOCALSTORAGE_MEMORY_KEY, JSON.stringify(all));
    } catch (e) {}
  } catch (err) {
    console.error("Hafıza silme hatası:", err);
  }
};

export const defaultInitialMemories: MemoryItem[] = [
  {
    id: 'mem-1',
    key: 'Kullanıcı Adı & Hitap',
    value: 'Kullanıcının adı Mustafa. Kibar, çözüm odaklı, dinamik ve profesyonel Türkçe yanıtlar ver.',
    category: 'user_preference',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    isPinned: true
  },
  {
    id: 'mem-2',
    key: 'Kalıcı Hafıza & Süreklilik',
    value: 'Geçmiş konuşmalardan öğrenilen bağlamları ve tercihleri sonraki sohbetlerde hatırla ve kullan.',
    category: 'instruction',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    isPinned: true
  },
  {
    id: 'mem-3',
    key: 'Agent & Kodlama Yetkinliği',
    value: 'Yazılım, mimari, veri analizi ve dosya içeriklerinde adım adım akıl yürütme (Agent adımları) ile yanıt ver.',
    category: 'work_context',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    isPinned: false
  }
];

// ===================== EXPORT & IMPORT BACKUP =====================

export interface FullAppBackup {
  version: number;
  exportedAt: string;
  sessions: ChatSession[];
  memories: MemoryItem[];
}

export const exportAllData = async (): Promise<FullAppBackup> => {
  const sessions = await loadSessionsFromDB();
  const memories = await loadMemoriesFromDB();
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    sessions,
    memories
  };
};

export const importAllData = async (backup: FullAppBackup): Promise<{ sessionCount: number; memoryCount: number }> => {
  const db = await initDB();
  let sessionCount = 0;
  let memoryCount = 0;

  if (Array.isArray(backup.sessions)) {
    for (const session of backup.sessions) {
      if (session && session.id) {
        await db.put(SESSIONS_STORE, session);
        sessionCount++;
      }
    }
  }

  if (Array.isArray(backup.memories)) {
    for (const memory of backup.memories) {
      if (memory && memory.id) {
        await db.put(MEMORY_STORE, memory);
        memoryCount++;
      }
    }
  }

  return { sessionCount, memoryCount };
};
