
import { CheckIn, AppSettings, ScheduleType, ContextTag } from '../types';
import { DEFAULT_SCALES, DEFAULT_TAGS } from '../constants';

const DB_NAME = 'mood_patterns_db';
const DB_VERSION = 4; // Bumped for custom_tags
const STORE_CHECKINS = 'checkins';
const STORE_SETTINGS = 'settings';
const STORE_TAGS = 'custom_tags';

export class StorageService {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_CHECKINS)) {
          const store = db.createObjectStore(STORE_CHECKINS, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORE_TAGS)) {
          db.createObjectStore(STORE_TAGS, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  async saveCheckIn(checkIn: CheckIn): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_CHECKINS], 'readwrite');
      const store = transaction.objectStore(STORE_CHECKINS);
      const request = store.put(checkIn);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCheckIn(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_CHECKINS], 'readwrite');
      const store = transaction.objectStore(STORE_CHECKINS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCheckIns(): Promise<CheckIn[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_CHECKINS], 'readonly');
      const store = transaction.objectStore(STORE_CHECKINS);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => {
        const result = request.result as CheckIn[];
        resolve(result.sort((a, b) => b.timestamp - a.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getRecentStats(limit: number = 5): Promise<CheckIn[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_CHECKINS], 'readonly');
      const store = transaction.objectStore(STORE_CHECKINS);
      const index = store.index('timestamp');
      
      const request = index.openCursor(null, 'prev');
      const results: CheckIn[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Optimized method to get the single oldest check-in without loading all data
  async getOldestCheckIn(): Promise<CheckIn | undefined> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_CHECKINS], 'readonly');
      const store = transaction.objectStore(STORE_CHECKINS);
      const index = store.index('timestamp');
      // Open cursor in 'next' (ascending) direction to get the first (oldest) item
      const request = index.openCursor(null, 'next');

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          resolve(cursor.value);
        } else {
          resolve(undefined);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getCheckInCount(): Promise<number> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_CHECKINS], 'readonly');
      const store = transaction.objectStore(STORE_CHECKINS);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getSettings(): Promise<AppSettings> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_SETTINGS], 'readonly');
      const store = transaction.objectStore(STORE_SETTINGS);
      const request = store.get('app_settings');

      request.onsuccess = () => {
        const defaults: AppSettings = {
          reminders: {
            enabled: false,
            scheduleType: ScheduleType.Random,
            windowStartHour: 9,
            windowEndHour: 21,
            frequencyHours: 4,
            fixedTimes: [
               { id: '1', hour: 9, minute: 0, enabled: true },
               { id: '2', hour: 21, minute: 0, enabled: true }
            ],
            days: [0, 1, 2, 3, 4, 5, 6] 
          },
          hasCompletedOnboarding: false,
          insightsUnlocked: false,
          highContrast: false,
          reducedMotion: false,
          defaultInputMode: 'WHEEL',
          theme: 'original',
          enabledScales: DEFAULT_SCALES.map(s => s.id),
          customScales: [],
          tagOrder: DEFAULT_TAGS.map(t => t.id),
          showGamification: false
        };
        
        const result = request.result ? request.result.value : defaults;
        const merged = { 
            ...defaults, 
            ...result, 
            reminders: { ...defaults.reminders, ...result.reminders },
            enabledScales: result.enabledScales || defaults.enabledScales,
            customScales: result.customScales || defaults.customScales,
            insightsUnlocked: result.insightsUnlocked || defaults.insightsUnlocked,
            showGamification: result.showGamification !== undefined ? result.showGamification : defaults.showGamification,
            tagOrder: result.tagOrder || defaults.tagOrder
        };
        resolve(merged);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORE_SETTINGS);
      const request = store.put({ key: 'app_settings', value: settings });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveCustomTag(tag: ContextTag): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_TAGS], 'readwrite');
      const store = transaction.objectStore(STORE_TAGS);
      const request = store.put(tag);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCustomTags(): Promise<ContextTag[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_TAGS], 'readonly');
      const store = transaction.objectStore(STORE_TAGS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as ContextTag[]);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCustomTag(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_TAGS], 'readwrite');
      const store = transaction.objectStore(STORE_TAGS);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearData(): Promise<void> {
     const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_CHECKINS, STORE_SETTINGS, STORE_TAGS], 'readwrite');
      
      const p1 = new Promise<void>((res, rej) => {
         const req = transaction.objectStore(STORE_CHECKINS).clear();
         req.onsuccess = () => res();
         req.onerror = () => rej(req.error);
      });

      const p2 = new Promise<void>((res, rej) => {
         const req = transaction.objectStore(STORE_SETTINGS).clear();
         req.onsuccess = () => res();
         req.onerror = () => rej(req.error);
      });

      const p3 = new Promise<void>((res, rej) => {
         const req = transaction.objectStore(STORE_TAGS).clear();
         req.onsuccess = () => res();
         req.onerror = () => rej(req.error);
      });

      Promise.all([p1, p2, p3]).then(() => resolve()).catch(reject);
    });
  }

  // --- EXPORT / IMPORT ---

  async exportData(): Promise<string> {
    const [checkIns, settings, customTags] = await Promise.all([
       this.getAllCheckIns(),
       this.getSettings(),
       this.getCustomTags()
    ]);
    
    return JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        checkIns,
        settings,
        customTags
    }, null, 2);
  }

  async importData(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString);
      
      // Simple validation
      if (data.checkIns && !Array.isArray(data.checkIns)) throw new Error("Invalid checkIns format");
      
      const db = await this.dbPromise;
      
      return new Promise((resolve, reject) => {
        const stores: string[] = [];
        if (data.checkIns) stores.push(STORE_CHECKINS);
        if (data.settings) stores.push(STORE_SETTINGS);
        if (data.customTags) stores.push(STORE_TAGS);
        
        if (stores.length === 0) { resolve(); return; }

        const transaction = db.transaction(stores, 'readwrite');

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

        if (data.checkIns && Array.isArray(data.checkIns)) {
          const store = transaction.objectStore(STORE_CHECKINS);
          // Clear existing or merge? Strategy: Overwrite by ID, Keep existing if not present
          // For V1 simple restore: We iterate and put.
          data.checkIns.forEach((item: any) => store.put(item));
        }

        if (data.settings) {
           const store = transaction.objectStore(STORE_SETTINGS);
           // Preserve unlocked state if importing settings that might have it false?
           // Strategy: Overwrite settings with import
           store.put({ key: 'app_settings', value: data.settings });
        }

        if (data.customTags && Array.isArray(data.customTags)) {
            const store = transaction.objectStore(STORE_TAGS);
            data.customTags.forEach((item: any) => store.put(item));
        }
      });
    } catch (e) {
      console.error("Import Error:", e);
      throw new Error("Invalid data format");
    }
  }
}

export const db = new StorageService();
