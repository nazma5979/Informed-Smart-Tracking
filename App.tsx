
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from './components/Layout';
import { AppSettings, CheckIn, ContextTag, ScreenName } from './types';
import { db } from './services/db';
import { Scheduler } from './utils/scheduler';
import HomeScreen from './screens/HomeScreen';
import CheckInScreen from './screens/CheckInScreen';
import SettingsScreen from './screens/SettingsScreen';
import InsightsScreen from './screens/InsightsScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import ReminderBanner from './components/ReminderBanner';
import { DEFAULT_TAGS } from './constants';

// Add missing type definition for startViewTransition API which is experimental
declare global {
  interface Document {
    startViewTransition?: (callback: () => void) => void;
  }
}

const UNLOCK_COUNT_THRESHOLD = 10;
const UNLOCK_DAYS_THRESHOLD = 7;
const PAGE_SIZE = 20;

// Map themes to their primary background/header color for the meta tag
const THEME_COLORS: Record<string, string> = {
  'original': '#f8fafc', // slate-50 (bg-app) or #4f46e5 (primary). Usually better to match header/bg. Let's match bg-app.
  'light': '#fbfbfb',
  'dark': '#000000',
  'sepia': '#f8f1e3',
  'grey': '#5a5a5c',
  'pastel': '#e8e6ea'
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('HOME');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [totalCheckInCount, setTotalCheckInCount] = useState(0);
  const [daysTracked, setDaysTracked] = useState(0);
  const [customTags, setCustomTags] = useState<ContextTag[]>([]);
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | undefined>(undefined);
  
  // Reminder State
  const [reminderState, setReminderState] = useState<{ show: boolean, title?: string, message?: string }>({ show: false });
  
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isFullHistoryLoaded, setIsFullHistoryLoaded] = useState(false);
  
  // PWA Install Prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
      const handler = (e: any) => {
          e.preventDefault();
          setInstallPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
          setInstallPrompt(null);
      }
  };

  const loadData = useCallback(async () => {
    try {
      const [s, c, t, count] = await Promise.all([
        db.getSettings(),
        db.getRecentStats(limit),
        db.getCustomTags(),
        db.getCheckInCount()
      ]);
      
      setTotalCheckInCount(count);

      let diffDays = 0;
      if (count > 0) {
          // Optimization: Use getOldestCheckIn instead of fetching all check-ins
          const oldest = await db.getOldestCheckIn();
          if (oldest) {
             diffDays = Math.ceil(Math.abs(Date.now() - oldest.timestamp) / (1000 * 60 * 60 * 24));
          }
      }
      setDaysTracked(diffDays);

      // Unlock Logic
      if (!s.insightsUnlocked && count > 0) {
          if (count >= UNLOCK_COUNT_THRESHOLD || diffDays >= UNLOCK_DAYS_THRESHOLD) {
              const updated = { ...s, insightsUnlocked: true };
              await db.saveSettings(updated);
              setSettings(updated);
          } else {
              setSettings(s);
          }
      } else {
          setSettings(s);
      }
      
      setCheckIns(c);
      setCustomTags(t);
      
      // Init Reminders
      handleInitReminders(s);

    } catch (e) {
      console.error("Failed to load data", e);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const handleInitReminders = (s: AppSettings) => {
      if (!s.reminders.enabled) return;
      
      const nextTime = Scheduler.getNextReminder();
      
      // 1. First run ever? Schedule it.
      if (!nextTime) {
          Scheduler.scheduleNext(s);
          return;
      }

      // 2. Missed Check-in?
      const now = Date.now();
      if (now > nextTime) {
          // User opened app after a scheduled reminder time
          setReminderState({
              show: true,
              title: "Missed Check-in",
              message: `You had a reminder scheduled for ${new Date(nextTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. Want to log now?`
          });
          // Reschedule immediately to prevent stale state
          Scheduler.scheduleNext(s);
      }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  useEffect(() => {
      if (currentScreen === 'INSIGHTS' && !isFullHistoryLoaded && !isLoadingInsights) {
          setIsLoadingInsights(true);
          db.getAllCheckIns().then(all => {
              setCheckIns(all);
              setIsFullHistoryLoaded(true);
              setIsLoadingInsights(false);
          });
      }
  }, [currentScreen, isFullHistoryLoaded, isLoadingInsights]);

  // --- Intelligent Reminder Polling ---
  useEffect(() => {
      if (!settings?.reminders.enabled) return;
      
      // Check every 30 seconds
      const interval = setInterval(() => {
         const nextTime = Scheduler.getNextReminder();
         if (!nextTime) return;
         
         if (Date.now() >= nextTime) {
             // Trigger Reminder
             setReminderState({
                 show: true,
                 title: "Time to check in",
                 message: "How are you feeling right now?"
             });
             if (Notification.permission === 'granted') {
                 new Notification("Time to check in", { body: "How are you feeling right now?" });
             }
             
             // Schedule next one immediately
             Scheduler.scheduleNext(settings);
         }
      }, 30000);
      
      return () => clearInterval(interval);
  }, [settings]);

  useEffect(() => {
      if (!settings) return;
      const root = document.documentElement;
      root.setAttribute('data-theme', settings.theme);
      settings.highContrast ? root.classList.add('high-contrast') : root.classList.remove('high-contrast');
      settings.reducedMotion ? root.classList.add('reduced-motion') : root.classList.remove('reduced-motion');

      // Update Meta Theme Color
      const metaThemeColor = document.querySelector("meta[name=theme-color]");
      if (metaThemeColor) {
          metaThemeColor.setAttribute("content", THEME_COLORS[settings.theme] || THEME_COLORS['original']);
      }
  }, [settings]);

  useEffect(() => {
      const handlePopState = (e: PopStateEvent) => {
          if (e.state?.screen) {
            if (document.startViewTransition && !settings?.reducedMotion) {
                document.startViewTransition(() => {
                    setCurrentScreen(e.state.screen);
                });
            } else {
                setCurrentScreen(e.state.screen);
            }
          }
          else {
              setCurrentScreen('HOME');
          }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [settings?.reducedMotion]);

  const navigateTo = (screen: ScreenName) => {
      const updateScreen = () => {
        setCurrentScreen(screen);
        window.history.pushState({ screen }, '', screen === 'HOME' ? '/' : `/${screen.toLowerCase()}`);
      };

      if (document.startViewTransition && !settings?.reducedMotion) {
          document.startViewTransition(() => {
              updateScreen();
          });
      } else {
          updateScreen();
      }
  }

  const handleCheckInComplete = async () => {
      // Update data
      if (isFullHistoryLoaded) {
          const all = await db.getAllCheckIns();
          setCheckIns(all);
          const count = await db.getCheckInCount();
          setTotalCheckInCount(count);
      } else {
          await loadData();
      }
      
      // Update Schedule Logic
      if (settings?.reminders.enabled) {
         Scheduler.scheduleNext(settings);
      }

      if (document.startViewTransition && !settings?.reducedMotion) {
          document.startViewTransition(() => {
            window.history.back();
            setEditingCheckIn(undefined);
          });
      } else {
          window.history.back();
          setEditingCheckIn(undefined);
      }
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
      setSettings(newSettings);
      await db.saveSettings(newSettings);
      
      // Recalculate schedule if settings changed
      if (newSettings.reminders.enabled) {
          Scheduler.scheduleNext(newSettings);
      } else {
          Scheduler.clear();
      }
  }
  
  const handleUpdateCustomTag = async (tag: ContextTag) => {
      await db.saveCustomTag(tag);
      setCustomTags(prev => {
          const exists = prev.find(t => t.id === tag.id);
          let newTags = prev;
          if (exists) {
              newTags = prev.map(t => t.id === tag.id ? tag : t);
          } else {
              newTags = [...prev, tag];
          }
          
          // Ensure new tag is in the order list
          if (settings && (!settings.tagOrder || !settings.tagOrder.includes(tag.id))) {
              const newOrder = settings.tagOrder ? [...settings.tagOrder, tag.id] : [...DEFAULT_TAGS.map(d => d.id), tag.id];
              handleUpdateSettings({ ...settings, tagOrder: newOrder });
          }
          
          return newTags;
      });
  };

  const handleExportData = async () => {
      try {
          const json = await db.exportData();
          const blob = new Blob([json], {type: "application/json"});
          const href = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = href;
          link.download = `mood-patterns-backup-${new Date().toISOString().slice(0,10)}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (e) {
          alert("Export failed");
      }
  }

  const handleImportData = async (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
              try {
                  await db.importData(text);
                  window.location.reload(); // Reload to reflect changes
              } catch (err) {
                  alert("Import failed: Invalid file format.");
              }
          }
      };
      reader.readAsText(file);
  }

  // Computed property for sorted tags
  const sortedAvailableTags = useMemo(() => {
      const all = [...DEFAULT_TAGS, ...customTags];
      if (!settings?.tagOrder) return all;
      
      const ordered = settings.tagOrder
          .map(id => all.find(t => t.id === id))
          .filter(Boolean) as ContextTag[];
          
      // Append any tags not in the order (e.g. just created, or defaults added in future)
      const unlisted = all.filter(t => !settings.tagOrder!.includes(t.id));
      return [...ordered, ...unlisted];
  }, [customTags, settings?.tagOrder]);

  if (loading || !settings) return <div className="h-screen w-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-app)' }}><div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!settings.hasCompletedOnboarding) return <OnboardingScreen onComplete={() => handleUpdateSettings({ ...settings, hasCompletedOnboarding: true })} />;

  return (
    <Layout currentScreen={currentScreen} onNavigate={navigateTo}>
        {reminderState.show && (
            <ReminderBanner 
                title={reminderState.title}
                message={reminderState.message}
                onCheckIn={() => { setReminderState({ show: false }); navigateTo('CHECK_IN'); }} 
                onDismiss={() => setReminderState({ show: false })} 
            />
        )}
        
        {currentScreen === 'HOME' && (
            <HomeScreen 
                recentCheckIns={checkIns} 
                totalCount={totalCheckInCount}
                hasMore={checkIns.length < totalCheckInCount}
                onLoadMore={() => setLimit(prev => prev + PAGE_SIZE)}
                onCheckIn={() => { setEditingCheckIn(undefined); navigateTo('CHECK_IN'); }} 
                onEditCheckIn={(ci) => { setEditingCheckIn(ci); navigateTo('CHECK_IN'); }}
                onDeleteCheckIn={async (id) => { await db.deleteCheckIn(id); loadData(); }}
                daysTracked={daysTracked}
                isInsightsUnlocked={settings.insightsUnlocked}
                showGamification={settings.showGamification}
                availableTags={sortedAvailableTags}
            />
        )}
        {currentScreen === 'CHECK_IN' && (
            <CheckInScreen 
                initialCheckIn={editingCheckIn}
                onComplete={handleCheckInComplete}
                onCancel={() => window.history.back()}
                defaultInputMode={settings.defaultInputMode}
                availableTags={sortedAvailableTags}
                onAddTag={handleUpdateCustomTag}
                enabledScales={settings.enabledScales}
            />
        )}
        {currentScreen === 'INSIGHTS' && (
            <InsightsScreen 
                checkIns={checkIns} 
                customTags={customTags} 
                settings={settings} 
                isLoading={isLoadingInsights} 
                totalCount={totalCheckInCount}
                onUnlockCheckIn={() => navigateTo('CHECK_IN')}
            />
        )}
        {currentScreen === 'SETTINGS' && (
            <SettingsScreen 
                settings={settings}
                onSaveSettings={handleUpdateSettings}
                onClearData={async () => { await db.clearData(); window.location.reload(); }}
                onReplayOnboarding={() => handleUpdateSettings({ ...settings, hasCompletedOnboarding: false })}
                customTags={customTags}
                onDeleteCustomTag={async (id) => { await db.deleteCustomTag(id); setCustomTags(prev => prev.filter(t => t.id !== id)); }}
                onUpdateCustomTag={handleUpdateCustomTag}
                availableTags={sortedAvailableTags}
                onDone={() => window.history.back()}
                installPromptEvent={installPrompt}
                onInstallApp={handleInstallApp}
                onExportData={handleExportData}
                onImportData={handleImportData}
            />
        )}
    </Layout>
  );
};

export default App;
