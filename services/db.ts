
import { CheckIn, AppSettings, ScheduleType, ContextTag, Scale, CheckInEmotionPath, Theme } from '../types';
import { DEFAULT_SCALES, DEFAULT_TAGS, FEELING_NODES, getEmotionPath } from '../constants';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'mood_patterns_db';
const DB_VERSION = 4;
const STORE_CHECKINS = 'checkins';
const STORE_SETTINGS = 'settings';
const STORE_TAGS = 'custom_tags';

// Detect system preference for default theme
const getSystemTheme = (): Theme => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'original';
};

const DEFAULT_SETTINGS: AppSettings = {
  userName: '',
  reminders: {
    enabled: false,
    scheduleType: ScheduleType.Random,
    windowStartHour: 9,
    windowEndHour: 21,
    frequencyHours: 4,
    fixedTimes: [],
    days: [0, 1, 2, 3, 4, 5, 6]
  },
  hasCompletedOnboarding: false,
  insightsUnlocked: false,
  clinicalModeEnabled: false, // Default to OFF
  highContrast: false,
  reducedMotion: false,
  hapticsEnabled: true,
  defaultInputMode: 'WHEEL',
  theme: getSystemTheme(),
  enabledScales: ['energy', 'stress', 'focus'],
  customScales: [],
  tagOrder: undefined,
  sortTagsByUsage: true,
  showGamification: true
};

export class StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.openDB();
    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => {
            if (this.dbPromise) {
                this.dbPromise.then(db => db.close());
                this.dbPromise = null;
            }
        });
    }
  }

  private openDB() {
    if (this.dbPromise) return;

    this.dbPromise = new Promise((resolve, reject) => {
      try {
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
            console.error("IndexedDB Open Error", (event.target as IDBOpenDBRequest).error);
            reject((event.target as IDBOpenDBRequest).error);
          };
      } catch (e) {
          console.error("Critical IndexedDB Initialization Error", e);
          reject(e);
      }
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
        this.openDB();
    }
    return this.dbPromise!;
  }

  async saveCheckIn(checkIn: CheckIn): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CHECKINS, 'readwrite');
      const store = tx.objectStore(STORE_CHECKINS);
      const request = store.put(checkIn);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCheckInCount(): Promise<number> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_CHECKINS, 'readonly');
          const store = tx.objectStore(STORE_CHECKINS);
          const request = store.count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
      });
  }

  async getRecentStats(limit: number): Promise<CheckIn[]> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_CHECKINS, 'readonly');
          const store = tx.objectStore(STORE_CHECKINS);
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
  
  async getOldestCheckIn(): Promise<CheckIn | null> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_CHECKINS, 'readonly');
          const store = tx.objectStore(STORE_CHECKINS);
          const index = store.index('timestamp');
          const request = index.openCursor(null, 'next'); // Ascending
          
          request.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest).result;
              if (cursor) {
                  resolve(cursor.value);
              } else {
                  resolve(null);
              }
          };
          request.onerror = () => reject(request.error);
      });
  }

  async getAllCheckIns(): Promise<CheckIn[]> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_CHECKINS, 'readonly');
          const store = tx.objectStore(STORE_CHECKINS);
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
      });
  }

  async deleteCheckIn(id: string): Promise<void> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_CHECKINS, 'readwrite');
          const store = tx.objectStore(STORE_CHECKINS);
          const request = store.delete(id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
      });
  }

  async getSettings(): Promise<AppSettings> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_SETTINGS, 'readonly');
          const store = tx.objectStore(STORE_SETTINGS);
          const request = store.get('app_settings');
          request.onsuccess = () => {
              if (request.result) {
                  resolve({ ...DEFAULT_SETTINGS, ...request.result.value });
              } else {
                  const currentSystemTheme = getSystemTheme();
                  resolve({ ...DEFAULT_SETTINGS, theme: currentSystemTheme });
              }
          };
          request.onerror = () => reject(request.error);
      });
  }

  async saveSettings(settings: AppSettings): Promise<void> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_SETTINGS, 'readwrite');
          const store = tx.objectStore(STORE_SETTINGS);
          const request = store.put({ key: 'app_settings', value: settings });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
      });
  }

  async getCustomTags(): Promise<ContextTag[]> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_TAGS, 'readonly');
          const store = tx.objectStore(STORE_TAGS);
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
      });
  }
  
  async saveCustomTag(tag: ContextTag): Promise<void> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_TAGS, 'readwrite');
          const store = tx.objectStore(STORE_TAGS);
          const request = store.put(tag);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
      });
  }
  
  async deleteCustomTag(id: string): Promise<void> {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_TAGS, 'readwrite');
          const store = tx.objectStore(STORE_TAGS);
          const request = store.delete(id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
      });
  }

  async exportData(): Promise<string> {
      const checkIns = await this.getAllCheckIns();
      const settings = await this.getSettings();
      const customTags = await this.getCustomTags();
      
      const data = {
          version: 1,
          timestamp: Date.now(),
          checkIns,
          settings,
          customTags
      };
      return JSON.stringify(data);
  }

  async exportAsCSV(): Promise<string> {
      const checkIns = await this.getAllCheckIns();
      const customTags = await this.getCustomTags();
      const allTags = [...DEFAULT_TAGS, ...customTags];

      const headers = [
          "ID", "Timestamp_ISO", "Date", "Time", 
          "Emotion_Primary_Root", "Emotion_Primary_Leaf", "Emotion_Path_Full", 
          "Intensity", "Note", "Tags", "Scales_JSON"
      ];

      const rows = checkIns.map(c => {
          const date = new Date(c.timestamp);
          const primaryEmotion = c.emotions.find(e => e.isPrimary);
          let rootLabel = "";
          let leafLabel = "";
          let fullPathStr = "";

          if (primaryEmotion) {
              const path = getEmotionPath(primaryEmotion.nodeId);
              if (path.length > 0) rootLabel = path[0].label;
              if (path.length > 0) leafLabel = path[path.length - 1].label;
              fullPathStr = path.map(p => p.label).join(" > ");
          }

          const tagLabels = c.tags.map(tid => {
              const t = allTags.find(tag => tag.id === tid);
              return t ? t.label : tid;
          }).join("; ");

          const scalesStr = JSON.stringify(c.scaleValues).replace(/"/g, '""');

          const row = [
              c.id,
              date.toISOString(),
              date.toLocaleDateString(),
              date.toLocaleTimeString(),
              rootLabel,
              leafLabel,
              fullPathStr,
              c.intensity || "",
              (c.note || "").replace(/"/g, '""').replace(/\n/g, " "),
              tagLabels.replace(/"/g, '""'),
              scalesStr
          ];

          return row.map(val => `"${val}"`).join(",");
      });

      return [headers.join(","), ...rows].join("\n");
  }

  async importData(json: string): Promise<void> {
      try {
          const data = JSON.parse(json);
          if (!data.checkIns || !data.settings) throw new Error("Invalid data");

          const db = await this.getDB();
          const tx = db.transaction([STORE_CHECKINS, STORE_SETTINGS, STORE_TAGS], 'readwrite');
          
          await new Promise<void>((resolve, reject) => {
              const req = tx.objectStore(STORE_CHECKINS).clear();
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
          });
          
          for (const c of data.checkIns) {
              tx.objectStore(STORE_CHECKINS).put(c);
          }
          
          tx.objectStore(STORE_SETTINGS).put({ key: 'app_settings', value: data.settings });
          
          if (data.customTags) {
               const tagStore = tx.objectStore(STORE_TAGS);
               await new Promise<void>((resolve, reject) => {
                  const req = tagStore.clear();
                  req.onsuccess = () => resolve();
                  req.onerror = () => reject(req.error);
               });
               for (const t of data.customTags) {
                   tagStore.put(t);
               }
          }
          
          return new Promise((resolve, reject) => {
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
          });

      } catch (e) {
          console.error("Import error", e);
          throw e;
      }
  }
  
  async clearData(): Promise<void> {
      const db = await this.getDB();
      const tx = db.transaction([STORE_CHECKINS, STORE_SETTINGS, STORE_TAGS], 'readwrite');
      tx.objectStore(STORE_CHECKINS).clear();
      tx.objectStore(STORE_SETTINGS).clear();
      tx.objectStore(STORE_TAGS).clear();
      
      return new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
      });
  }

  async seedSampleData(): Promise<void> {
      const db = await this.getDB();
      const tx = db.transaction(STORE_CHECKINS, 'readwrite');
      const store = tx.objectStore(STORE_CHECKINS);

      const oneDay = 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      // We generate 45 days of data to populate heatmap
      // We purposefully create correlations: 
      // Work -> Stress (High), Energy (Low), Emotion: Anxious/Tired
      // Nature/Exercise -> Stress (Low), Energy (High), Emotion: Happy/Peaceful
      
      const Scenarios = [
          // SCENARIO 1: WORK STRESS (Weekdays)
          {
             tags: ['work', 'colleagues'],
             emotions: [
                 'fearful_anxious_overwhelmed', 'fearful_anxious_worried', 
                 'angry_frustrated_annoyed', 'bad_stressed_overwhelmed',
                 'bad_tired_sleepy'
             ],
             noteVariants: [
                 "Big deadline coming up.", "Too many meetings today.", 
                 "Feeling behind on everything.", "Exhausted after that call.",
                 "Just want to go home."
             ],
             scales: { stress: [4, 5], energy: [1, 2], focus: [2, 3] },
             intensity: [2, 3] // Varied intensity
          },
          // SCENARIO 2: RECOVERY (Weekends/Evenings)
          {
             tags: ['home', 'relaxing', 'partner'],
             emotions: [
                 'happy_content_free', 'happy_peaceful_thankful',
                 'happy_playful_cheeky', 'happy_content_joyful'
             ],
             noteVariants: [
                 "Finally relaxing.", "Nice dinner with partner.",
                 "Reading a good book.", "Feeling grateful for the weekend.",
                 "Just chilling on the couch."
             ],
             scales: { stress: [1, 2], energy: [3, 4], focus: [3] },
             intensity: [1, 2] // Lower intensity
          },
          // SCENARIO 3: ACTIVE (Exercise)
          {
             tags: ['exercise', 'nature'],
             emotions: [
                 'happy_powerful_courageous', 'happy_optimistic_inspired',
                 'happy_peaceful_loving'
             ],
             noteVariants: [
                 "Great run in the park.", "Morning yoga session.",
                 "Fresh air feels amazing.", "Hit a new personal best."
             ],
             scales: { stress: [1], energy: [5], focus: [5] },
             intensity: [3] // Peak intensity
          },
          // SCENARIO 4: SLEEP ISSUES
          {
             tags: ['bad_sleep', 'home'],
             emotions: [
                 'bad_tired_unfocused', 'angry_distant_withdrawn',
                 'sad_depressed_empty'
             ],
             noteVariants: [
                 "Tossed and turned all night.", "Woke up groggy.",
                 "Need more coffee.", "Brain fog is heavy today."
             ],
             scales: { stress: [3, 4], energy: [1], focus: [1] },
             intensity: [1, 2]
          }
      ];

      // Helper to build emotion path
      const buildEmotions = (leafId: string): CheckInEmotionPath[] => {
          const path = getEmotionPath(leafId);
          return path.map(node => ({
              pathId: uuidv4(),
              nodeId: node.id,
              ringIndex: node.ringIndex,
              isPrimary: node.id === leafId
          }));
      };

      for (let i = 0; i < 45; i++) {
          const date = new Date(now - (i * oneDay));
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          
          // Determine how many entries for this day (1 to 4) to create variance for volatility envelope
          const entriesCount = Math.floor(Math.random() * 4) + 1; 

          for (let j = 0; j < entriesCount; j++) {
             // Pick a scenario based on day type
             let scenario;
             if (isWeekend) {
                 // 70% chance of recovery/active, 30% other
                 scenario = Math.random() > 0.3 
                    ? Scenarios[Math.floor(Math.random() * 2) + 1] // Index 1 or 2
                    : Scenarios[Math.floor(Math.random() * Scenarios.length)];
             } else {
                 // Weekday: 60% Work, 40% Other
                 scenario = Math.random() > 0.4
                    ? Scenarios[0]
                    : Scenarios[Math.floor(Math.random() * Scenarios.length)];
             }

             // Time of day logic (spread them out)
             const hour = 8 + (j * 4) + Math.floor(Math.random() * 2); // e.g. 8, 12, 16
             date.setHours(hour, Math.floor(Math.random() * 60));

             // Pick emotion leaf
             const leafId = scenario.emotions[Math.floor(Math.random() * scenario.emotions.length)];
             
             // Pick scales
             const scaleValues: Record<string, number> = {};
             if (scenario.scales.stress) scaleValues['stress'] = scenario.scales.stress[Math.floor(Math.random() * scenario.scales.stress.length)];
             if (scenario.scales.energy) scaleValues['energy'] = scenario.scales.energy[Math.floor(Math.random() * scenario.scales.energy.length)];
             if (scenario.scales.focus) scaleValues['focus'] = scenario.scales.focus[Math.floor(Math.random() * scenario.scales.focus.length)];

             // Variance in intensity: Pick base intensity from scenario, then perturb slightly
             // This ensures within-day variance for EVI
             const baseIntensity = scenario.intensity[Math.floor(Math.random() * scenario.intensity.length)];
             // 20% chance to flip intensity (e.g. happy but low intensity, or sad but high intensity) to create outliers
             const finalIntensity = Math.random() > 0.8 
                 ? Math.max(1, Math.min(3, baseIntensity + (Math.random() > 0.5 ? 1 : -1)))
                 : baseIntensity;

             const checkIn: CheckIn = {
                  id: uuidv4(),
                  timestamp: date.getTime(),
                  timezoneOffset: date.getTimezoneOffset(),
                  emotions: buildEmotions(leafId),
                  note: scenario.noteVariants[Math.floor(Math.random() * scenario.noteVariants.length)],
                  intensity: finalIntensity,
                  scaleValues: scaleValues,
                  tags: scenario.tags,
                  createdAt: Date.now()
             };

             store.put(checkIn);
          }
      }

      return new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
      });
  }
}

export const db = new StorageService();
