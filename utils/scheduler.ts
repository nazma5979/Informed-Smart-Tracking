
import { AppSettings, ScheduleType } from '../types';

const STORAGE_KEY = 'mood_patterns_next_reminder';

export const Scheduler = {
  getNextReminder: (): number | null => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  },

  // Call this after a check-in or when settings change
  scheduleNext: (settings: AppSettings): number | null => {
    if (!settings.reminders.enabled) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // Check if we already have a valid future reminder? 
    // Actually, we usually want to reschedule after a check-in. 
    // If called from Settings change, we might want to force recalc.
    
    const now = Date.now();
    let nextTime = 0;

    if (settings.reminders.scheduleType === ScheduleType.Fixed) {
       const enabledTimes = settings.reminders.fixedTimes.filter(t => t.enabled);
       if (enabledTimes.length === 0) {
           localStorage.removeItem(STORAGE_KEY);
           return null;
       }
       
       // Sort by minute of day
       enabledTimes.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
       
       const current = new Date();
       const currentMinutes = current.getHours() * 60 + current.getMinutes();
       
       // Find first time strictly later today
       const nextToday = enabledTimes.find(t => (t.hour * 60 + t.minute) > currentMinutes);
       
       const target = new Date();
       target.setSeconds(0);
       target.setMilliseconds(0);

       if (nextToday) {
         target.setHours(nextToday.hour, nextToday.minute);
       } else {
         // Use first time tomorrow
         target.setDate(target.getDate() + 1);
         target.setHours(enabledTimes[0].hour, enabledTimes[0].minute);
       }
       nextTime = target.getTime();

    } else {
       // Random Logic
       // Next = now + random(freq/2, freq)
       const freqMs = settings.reminders.frequencyHours * 60 * 60 * 1000;
       const minDelay = freqMs / 2;
       const maxDelay = freqMs;
       const delay = minDelay + Math.random() * (maxDelay - minDelay);
       
       let candidate = new Date(now + delay);
       
       const startHour = settings.reminders.windowStartHour;
       const endHour = settings.reminders.windowEndHour;
       
       // Adjust for Window
       if (candidate.getHours() >= endHour) {
          // Too late, move to tomorrow start
          candidate.setDate(candidate.getDate() + 1);
          candidate.setHours(startHour, 0, 0, 0);
          // Add random offset into the start of the day (up to 1 hour) to avoid predictability
          candidate.setTime(candidate.getTime() + Math.random() * 60 * 60 * 1000);
       } else if (candidate.getHours() < startHour) {
          // Too early, move to today start
          candidate.setHours(startHour, 0, 0, 0);
          candidate.setTime(candidate.getTime() + Math.random() * 60 * 60 * 1000);
       }
       
       // Adjust for Active Days
       // Look ahead up to 7 days to find an active day
       for(let i=0; i<8; i++) {
          if (settings.reminders.days.includes(candidate.getDay())) {
             break;
          }
          // If not active today, move to start of next day
          candidate.setDate(candidate.getDate() + 1);
          candidate.setHours(startHour, 0, 0, 0);
          candidate.setTime(candidate.getTime() + Math.random() * 60 * 60 * 1000);
       }
       
       nextTime = candidate.getTime();
    }
    
    localStorage.setItem(STORAGE_KEY, nextTime.toString());
    return nextTime;
  }
};
