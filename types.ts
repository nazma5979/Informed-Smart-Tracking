
export enum RingIndex {
  Centre = 0,
  Middle = 1,
  Outer = 2,
}

export interface FeelingNode {
  id: string;
  label: string;
  parentId: string | null;
  ringIndex: RingIndex;
  color?: string;
  textColor?: string; // Hex override for contrast (e.g. Happy = yellow bg needs dark text)
  children?: string[]; // helper for traversal
}

export interface CheckInEmotionPath {
  pathId: string; // UUID
  nodeId: string;
  ringIndex: number;
  isPrimary: boolean;
}

export interface ContextTag {
  id: string;
  category: 'people' | 'place' | 'activity' | 'sleep' | 'weather';
  label: string;
  icon?: string;
  isUserCreated?: boolean;
}

export interface Scale {
  id: string;
  label: string;
  minLabel: string;
  maxLabel: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  isUserCreated?: boolean;
}

export interface CheckIn {
  id: string; // UUID
  timestamp: number; // event_ts_epoch_ms
  timezoneOffset: number; // in minutes
  emotions: CheckInEmotionPath[];
  note: string;
  intensity: number | null; // 1-3
  scaleValues: Record<string, number>; // scaleId -> value
  tags: string[]; // List of tag IDs
  createdAt: number;
  modifiedAt?: number; // Track last edit time
}

export type ScreenName = 'HOME' | 'CHECK_IN' | 'INSIGHTS' | 'SETTINGS';

export enum ScheduleType {
  Random = 'RANDOM',
  Fixed = 'FIXED'
}

export interface FixedTime {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
}

export interface ReminderConfig {
  enabled: boolean;
  scheduleType: ScheduleType;
  
  // Random Mode Settings
  windowStartHour: number; // 0-23
  windowEndHour: number; // 0-23
  frequencyHours: number; // approx every X hours
  
  // Fixed Mode Settings
  fixedTimes: FixedTime[];

  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

export type Theme = 'original' | 'light' | 'dark' | 'sepia' | 'grey' | 'pastel';
export type InputMode = 'WHEEL' | 'LIST';

export interface AppSettings {
  userName?: string; // Personalization Level 1: Identify
  reminders: ReminderConfig;
  hasCompletedOnboarding: boolean;
  insightsUnlocked: boolean; // New persistent flag
  clinicalModeEnabled: boolean; // Advanced Mode Flag
  highContrast: boolean;
  reducedMotion: boolean;
  hapticsEnabled: boolean;
  defaultInputMode: InputMode;
  theme: Theme;
  enabledScales: string[]; // IDs of enabled scales
  customScales: Scale[]; // User defined scales
  tagOrder?: string[]; // Custom sort order for tags
  sortTagsByUsage: boolean; // Personalization Level 3: Optimize
  showGamification: boolean; // Opt-in gamification features
}

export interface AppState {
  currentScreen: ScreenName;
  lastCheckIn: number | null;
}
