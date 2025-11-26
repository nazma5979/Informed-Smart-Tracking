
import { useState, useCallback, useEffect } from 'react';
import { AppSettings, CheckIn, ContextTag } from '../types';
import { db } from '../services/db';

const PAGE_SIZE = 20;
const UNLOCK_COUNT_THRESHOLD = 10;
const UNLOCK_DAYS_THRESHOLD = 7;
const DASHBOARD_CACHE_KEY = 'mood_patterns_dashboard_snapshot_v1';

export const useAppData = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [totalCheckInCount, setTotalCheckInCount] = useState(0);
  const [daysTracked, setDaysTracked] = useState(0);
  const [customTags, setCustomTags] = useState<ContextTag[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [isFullHistoryLoaded, setIsFullHistoryLoaded] = useState(false);

  // Initial Load: Try Cache First (Stale-While-Revalidate)
  useEffect(() => {
    const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (data.settings && data.checkIns) {
                setSettings(data.settings);
                setCheckIns(data.checkIns);
                setCustomTags(data.customTags || []);
                setTotalCheckInCount(data.totalCheckInCount || 0);
                setDaysTracked(data.daysTracked || 0);
                // Show cached content immediately
                setLoading(false);
            }
        } catch (e) {
            console.error("Cache parse error", e);
        }
    }
    // Always trigger fresh load to revalidate
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          const oldest = await db.getOldestCheckIn();
          if (oldest) {
             diffDays = Math.ceil(Math.abs(Date.now() - oldest.timestamp) / (1000 * 60 * 60 * 24));
          }
      }
      setDaysTracked(diffDays);

      // Unlock Logic
      let currentSettings = s;
      if (!s.insightsUnlocked && count > 0) {
          if (count >= UNLOCK_COUNT_THRESHOLD || diffDays >= UNLOCK_DAYS_THRESHOLD) {
              currentSettings = { ...s, insightsUnlocked: true };
              await db.saveSettings(currentSettings);
          }
      }
      
      // Migration for Haptics
      if (currentSettings.hapticsEnabled === undefined) {
          currentSettings = { ...currentSettings, hapticsEnabled: true };
      }

      setSettings(currentSettings);
      setCheckIns(c);
      setCustomTags(t);

      // Update Cache if on first page (Dashboard view)
      if (limit === PAGE_SIZE) {
          const snapshot = {
              settings: currentSettings,
              checkIns: c,
              customTags: t,
              totalCheckInCount: count,
              daysTracked: diffDays,
              timestamp: Date.now()
          };
          localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(snapshot));
      }
      
    } catch (e) {
      console.error("Failed to load data", e);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const loadFullHistory = useCallback(async () => {
      if (isFullHistoryLoaded) return;
      const all = await db.getAllCheckIns();
      setCheckIns(all);
      setIsFullHistoryLoaded(true);
  }, [isFullHistoryLoaded]);

  const updateSettings = async (newSettings: AppSettings) => {
      setSettings(newSettings);
      await db.saveSettings(newSettings);
      // Update cache immediately to prevent flicker on reload
      const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
      if (cached) {
          const data = JSON.parse(cached);
          data.settings = newSettings;
          localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(data));
      }
  };

  const updateCustomTag = async (tag: ContextTag) => {
      await db.saveCustomTag(tag);
      setCustomTags(prev => {
          const exists = prev.find(t => t.id === tag.id);
          const newTags = exists ? prev.map(t => t.id === tag.id ? tag : t) : [...prev, tag];
          
          // Update cache
          const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
          if (cached) {
             const data = JSON.parse(cached);
             data.customTags = newTags;
             localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(data));
          }
          
          return newTags;
      });
  };
  
  const deleteCustomTag = async (id: string) => {
      await db.deleteCustomTag(id);
      setCustomTags(prev => prev.filter(t => t.id !== id));
  };

  return {
    loading,
    settings,
    checkIns,
    totalCheckInCount,
    daysTracked,
    customTags,
    setLimit,
    loadData,
    updateSettings,
    updateCustomTag,
    deleteCustomTag,
    loadFullHistory,
    isFullHistoryLoaded,
    setCheckIns,
    setTotalCheckInCount
  };
};
