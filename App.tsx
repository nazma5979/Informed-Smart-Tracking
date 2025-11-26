
import React, { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import Layout from './components/Layout';
import { AppSettings, CheckIn, ContextTag, ScreenName } from './types';
import { db } from './services/db';
import { Scheduler } from './utils/scheduler';
import ReminderBanner from './components/ReminderBanner';
import { DEFAULT_TAGS } from './constants';
import { useAppData } from './hooks/useAppData';
import { useReminders } from './hooks/useReminders';
import { usePWA } from './hooks/usePWA';
import { useAdaptiveConfig } from './hooks/useAdaptiveConfig';
import { Haptics } from './utils/haptics';

// Lazy Load Screens for Performance
const HomeScreen = React.lazy(() => import('./screens/HomeScreen'));
const CheckInScreen = React.lazy(() => import('./screens/CheckInScreen'));
const SettingsScreen = React.lazy(() => import('./screens/SettingsScreen'));
const InsightsScreen = React.lazy(() => import('./screens/InsightsScreen'));
const OnboardingScreen = React.lazy(() => import('./screens/OnboardingScreen'));

declare global {
  interface Document {
    startViewTransition?: (callback: () => void) => void;
  }
}

// Map themes to their primary background/header color for the meta tag
const THEME_COLORS: Record<string, string> = {
  'original': '#f8fafc', 
  'light': '#fbfbfb',
  'dark': '#000000',
  'sepia': '#f8f1e3',
  'grey': '#5a5a5c',
  'pastel': '#e8e6ea'
};

// Adaptive Skeleton Loader with CLS Protection
const AppSkeleton = () => (
    <div className="h-[100dvh] w-full flex bg-slate-50 overflow-hidden flex-col md:flex-row">
        {/* Desktop Rail Placeholder */}
        <div className="hidden md:flex w-24 border-r border-slate-200 bg-white flex-col items-center py-6 gap-6 shrink-0">
             <div className="w-10 h-10 rounded-xl bg-slate-200 animate-pulse"></div>
             <div className="w-12 h-12 rounded-2xl bg-slate-200 animate-pulse mt-auto"></div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative max-w-2xl mx-auto w-full border-x border-slate-200 bg-white min-h-0">
            {/* Header Placeholder */}
            <div className="h-16 border-b border-slate-100 flex items-center px-4 gap-4 flex-none">
                 <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse md:hidden"></div>
                 <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse"></div>
            </div>
            
            <div className="p-6 space-y-6 animate-pulse flex-1 overflow-hidden">
                {/* Hero Card */}
                <div className="h-48 w-full bg-slate-200 rounded-3xl"></div>
                
                {/* List Items */}
                <div className="space-y-4 pt-4">
                    <div className="h-24 w-full bg-slate-200 rounded-2xl"></div>
                    <div className="h-24 w-full bg-slate-200 rounded-2xl"></div>
                    <div className="h-24 w-full bg-slate-200 rounded-2xl"></div>
                </div>
            </div>
        </div>

        {/* Mobile Bottom Nav Placeholder (Prevents Layout Shift) - HEIGHT MATCHES REAL NAV */}
        <div className="md:hidden flex-none h-[88px] border-t border-slate-200 bg-white flex justify-between items-start px-8 pt-2 pb-safe">
             <div className="w-10 h-10 rounded-lg bg-slate-200 animate-pulse mt-1"></div>
             <div className="w-14 h-14 rounded-full bg-slate-200 animate-pulse -mt-4 border-4 border-slate-50"></div>
             <div className="w-10 h-10 rounded-lg bg-slate-200 animate-pulse mt-1"></div>
        </div>
    </div>
);

const App: React.FC = () => {
  // ROUTING INITIALIZATION: Parse URL to determine start screen
  const getInitialScreen = (): ScreenName => {
    const path = window.location.pathname.toLowerCase();
    if (path === '/check_in') return 'CHECK_IN';
    if (path === '/insights') return 'INSIGHTS';
    if (path === '/settings') return 'SETTINGS';
    return 'HOME';
  };

  const [currentScreen, setCurrentScreen] = useState<ScreenName>(getInitialScreen);
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | undefined>(undefined);
  
  // Navigation robustness: Track if we have pushed state in this session
  const [canGoBack, setCanGoBack] = useState(false);

  // Custom Hooks
  const { 
      loading, settings, checkIns, totalCheckInCount, daysTracked, customTags, 
      setLimit, loadData, updateSettings, updateCustomTag, deleteCustomTag,
      loadFullHistory, isFullHistoryLoaded, setCheckIns, setTotalCheckInCount 
  } = useAppData();
  
  const { reminderState, setReminderState } = useReminders(settings);
  const { installPrompt, installApp, isIOS, isStandalone } = usePWA();
  
  // Adaptive Performance Hooks
  const { isLowEndDevice, isSlowNetwork, isSaveDataMode } = useAdaptiveConfig();

  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Performance: Preload Insights when idle
  // ADAPTIVE: Skip preloading if network is slow or data saver is on
  useEffect(() => {
    if (isSlowNetwork || isSaveDataMode) return;

    const preload = () => {
        // Dynamic import to prime the cache
        import('./screens/InsightsScreen');
    };
    
    if (typeof window !== 'undefined') {
        const rIC = (window as any).requestIdleCallback;
        if (rIC) {
            rIC(preload);
        } else {
            setTimeout(preload, 3000);
        }
    }
  }, [isSlowNetwork, isSaveDataMode]);

  // Initial Data Load & bfcache restore handler
  useEffect(() => {
    loadData();

    // Handle browser back/forward buttons (popstate)
    const handlePopState = (e: PopStateEvent) => {
        if (e.state?.screen) {
          const update = () => setCurrentScreen(e.state.screen);
          // Disable view transitions on low-end devices or user preference
          if (document.startViewTransition && !settings?.reducedMotion && !isLowEndDevice) {
              document.startViewTransition(update);
          } else {
              update();
          }
        } else {
          // If state is null (e.g. root load), parse URL again or default to Home
          setCurrentScreen(getInitialScreen());
        }
    };
    
    // bfcache optimization
    const handlePageShow = (event: PageTransitionEvent) => {
        if (event.persisted) {
            loadData();
        }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pageshow', handlePageShow);
    
    return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('pageshow', handlePageShow);
    }
  }, [loadData, settings?.reducedMotion, isLowEndDevice]);
  
  // Lazy Load Full History for Insights
  useEffect(() => {
      if (currentScreen === 'INSIGHTS' && !isFullHistoryLoaded && !isLoadingInsights) {
          setIsLoadingInsights(true);
          loadFullHistory().then(() => setIsLoadingInsights(false));
      }
  }, [currentScreen, isFullHistoryLoaded, isLoadingInsights, loadFullHistory]);

  // Apply Theme & Haptics Settings
  useEffect(() => {
      if (!settings) return;
      const root = document.documentElement;
      root.setAttribute('data-theme', settings.theme);
      settings.highContrast ? root.classList.add('high-contrast') : root.classList.remove('high-contrast');
      
      // ADAPTIVE: Force reduced motion if device is low-end
      if (settings.reducedMotion || isLowEndDevice) {
          root.classList.add('reduced-motion');
      } else {
          root.classList.remove('reduced-motion');
      }

      Haptics.setEnabled(settings.hapticsEnabled);

      const metaThemeColor = document.querySelector("meta[name=theme-color]");
      if (metaThemeColor) {
          metaThemeColor.setAttribute("content", THEME_COLORS[settings.theme] || THEME_COLORS['original']);
      }
  }, [settings, isLowEndDevice]);

  // --- ROBUST NAVIGATION HANDLERS ---

  const navigateTo = useCallback((screen: ScreenName, replace = false) => {
      const updateScreen = () => {
        setCurrentScreen(screen);
        const url = screen === 'HOME' ? '/' : `/${screen.toLowerCase()}`;
        if (replace) {
            window.history.replaceState({ screen }, '', url);
        } else {
            window.history.pushState({ screen }, '', url);
            setCanGoBack(true); // We added a history entry, so we can go back
        }
      };

      if (document.startViewTransition && !settings?.reducedMotion && !isLowEndDevice) {
          document.startViewTransition(updateScreen);
      } else {
          updateScreen();
      }
  }, [settings?.reducedMotion, isLowEndDevice]);

  // Robust Back Handler: Handles "X" buttons and Back Arrows
  const handleGoBack = useCallback(() => {
      // If we are at HOME, we can't really go back within the app.
      if (currentScreen === 'HOME') return;

      // If we know we have internal history (canGoBack is true), use browser back.
      // Otherwise (e.g. fresh reload on a sub-page), explicit replace to HOME.
      if (canGoBack) {
          window.history.back();
      } else {
          navigateTo('HOME', true);
      }
  }, [currentScreen, canGoBack, navigateTo]);

  const handleCheckInComplete = async () => {
      // 1. Refresh Data
      if (isFullHistoryLoaded) {
          await loadFullHistory();
          const count = await db.getCheckInCount();
          setTotalCheckInCount(count);
      } else {
          await loadData();
      }
      
      // 2. Schedule Next
      if (settings?.reminders.enabled) {
         Scheduler.scheduleNext(settings);
      }

      // 3. Robust Redirect
      navigateTo('HOME', true);
      setEditingCheckIn(undefined);
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
      await updateSettings(newSettings);
      if (newSettings.reminders.enabled) {
          Scheduler.scheduleNext(newSettings);
      } else {
          Scheduler.clear();
      }
  }
  
  const handleUpdateCustomTag = async (tag: ContextTag) => {
      await updateCustomTag(tag);
      if (settings && (!settings.tagOrder || !settings.tagOrder.includes(tag.id))) {
          const newOrder = settings.tagOrder ? [...settings.tagOrder, tag.id] : [...DEFAULT_TAGS.map(d => d.id), tag.id];
          await handleUpdateSettings({ ...settings, tagOrder: newOrder });
      }
  };

  const handleSeedData = async () => {
      await db.seedSampleData();
      await loadData();
      if (isFullHistoryLoaded) {
          await loadFullHistory();
      }
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
                  window.location.reload();
              } catch (err) {
                  alert("Import failed: Invalid file format.");
              }
          }
      };
      reader.readAsText(file);
  }

  // PERSONALIZATION: Optimize (Smart Sort)
  const sortedAvailableTags = useMemo(() => {
      const all = [...DEFAULT_TAGS, ...customTags];
      
      // 1. Smart Usage-Based Sorting (If enabled)
      if (settings?.sortTagsByUsage && checkIns.length > 0) {
          const counts: Record<string, number> = {};
          // Count usage for all tags
          checkIns.forEach(c => c.tags.forEach(t => counts[t] = (counts[t] || 0) + 1));
          
          return [...all].sort((a, b) => {
              const countA = counts[a.id] || 0;
              const countB = counts[b.id] || 0;
              // Sort by frequency (desc), then fall back to default order
              if (countB !== countA) return countB - countA;
              return 0; // Maintain stable sort
          });
      }

      // 2. Manual Sort (Explicit Filter/Sort)
      if (settings?.tagOrder && settings.tagOrder.length > 0) {
          const ordered = settings.tagOrder
            .map(id => all.find(t => t.id === id))
            .filter(Boolean) as ContextTag[];
          const unlisted = all.filter(t => !settings.tagOrder!.includes(t.id));
          return [...ordered, ...unlisted];
      }
      
      return all;
  }, [customTags, settings?.tagOrder, settings?.sortTagsByUsage, checkIns]);

  if (loading || !settings) return <AppSkeleton />;

  if (!settings.hasCompletedOnboarding) {
      return (
        <Suspense fallback={<AppSkeleton />}>
            <OnboardingScreen onComplete={() => handleUpdateSettings({ ...settings, hasCompletedOnboarding: true })} />
        </Suspense>
      );
  }

  return (
    <Layout currentScreen={currentScreen} onNavigate={navigateTo} onBack={handleGoBack} onSeedData={handleSeedData}>
        {reminderState.show && (
            <ReminderBanner 
                title={reminderState.title}
                message={reminderState.message}
                onCheckIn={() => { setReminderState({ show: false }); navigateTo('CHECK_IN'); }} 
                onDismiss={() => setReminderState({ show: false })} 
            />
        )}
        
        <Suspense fallback={<AppSkeleton />}>
            {currentScreen === 'HOME' && (
                <HomeScreen 
                    recentCheckIns={checkIns} 
                    totalCount={totalCheckInCount}
                    hasMore={checkIns.length < totalCheckInCount}
                    onLoadMore={() => setLimit(prev => prev + 20)}
                    onCheckIn={() => { setEditingCheckIn(undefined); navigateTo('CHECK_IN'); }} 
                    onEditCheckIn={(ci) => { setEditingCheckIn(ci); navigateTo('CHECK_IN'); }}
                    onDeleteCheckIn={async (id) => { await db.deleteCheckIn(id); loadData(); }}
                    daysTracked={daysTracked}
                    isInsightsUnlocked={settings.insightsUnlocked}
                    showGamification={settings.showGamification}
                    availableTags={sortedAvailableTags}
                    installPrompt={installPrompt}
                    onInstallApp={installApp}
                    isIOS={isIOS}
                    isStandalone={isStandalone}
                    userName={settings.userName}
                />
            )}
            {currentScreen === 'CHECK_IN' && (
                <CheckInScreen 
                    initialCheckIn={editingCheckIn}
                    onComplete={handleCheckInComplete}
                    onCancel={handleGoBack}
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
                    onDeleteCustomTag={deleteCustomTag}
                    onUpdateCustomTag={handleUpdateCustomTag}
                    availableTags={sortedAvailableTags}
                    onDone={handleGoBack}
                    installPromptEvent={installPrompt}
                    onInstallApp={installApp}
                    onExportData={handleExportData}
                    onImportData={handleImportData}
                />
            )}
        </Suspense>
    </Layout>
  );
};

export default App;
