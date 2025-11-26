
import { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { Scheduler } from '../utils/scheduler';

export const useReminders = (settings: AppSettings | null) => {
  const [reminderState, setReminderState] = useState<{ show: boolean, title?: string, message?: string }>({ show: false });

  // Polling
  useEffect(() => {
      if (!settings?.reminders.enabled) return;
      
      const interval = setInterval(() => {
         const nextTime = Scheduler.getNextReminder();
         if (!nextTime) return;
         
         if (Date.now() >= nextTime) {
             setReminderState({
                 show: true,
                 title: "Time to check in",
                 message: "How are you feeling right now?"
             });
             if (Notification.permission === 'granted') {
                 new Notification("Time to check in", { body: "How are you feeling right now?" });
             }
             Scheduler.scheduleNext(settings);
         }
      }, 30000);
      
      return () => clearInterval(interval);
  }, [settings]);

  // Initial Check (missed reminders)
  useEffect(() => {
      if (!settings?.reminders.enabled) return;
      
      const nextTime = Scheduler.getNextReminder();
      if (!nextTime) {
          Scheduler.scheduleNext(settings);
          return;
      }

      if (Date.now() > nextTime) {
          setReminderState({
              show: true,
              title: "Missed Check-in",
              message: `You had a reminder scheduled for ${new Date(nextTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. Want to log now?`
          });
          Scheduler.scheduleNext(settings);
      }
  }, [settings?.reminders.enabled]);

  return { reminderState, setReminderState };
};
