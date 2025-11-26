
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Star, Smile, Trash2, Lock, Search, Filter, X, ChevronDown, Loader2, Download, Share, PlusSquare, Zap, ArrowRight, Lightbulb } from 'lucide-react';
import { CheckIn, ContextTag } from '../types';
import { FEELING_NODES, getEmotionPath } from '../constants';
import ConfirmDialog from '../components/ConfirmDialog';
import { calculateSmartPatterns } from '../utils/analytics';

interface Props {
    recentCheckIns: CheckIn[];
    totalCount: number;
    hasMore: boolean;
    onCheckIn: () => void;
    onEditCheckIn: (checkIn: CheckIn) => void;
    onDeleteCheckIn: (id: string) => void;
    onLoadMore: () => void;
    daysTracked: number;
    isInsightsUnlocked: boolean;
    showGamification: boolean;
    availableTags: ContextTag[];
    installPrompt?: any;
    onInstallApp?: () => void;
    isIOS?: boolean;
    isStandalone?: boolean;
    userName?: string;
}

const HomeScreen: React.FC<Props> = ({ 
    onCheckIn, 
    onEditCheckIn, 
    recentCheckIns, 
    onDeleteCheckIn, 
    onLoadMore, 
    hasMore, 
    totalCount, 
    daysTracked, 
    isInsightsUnlocked, 
    showGamification,
    availableTags,
    installPrompt,
    onInstallApp,
    isIOS,
    isStandalone,
    userName
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRootEmotion, setSelectedRootEmotion] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('Hello');
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  
  // Delete Confirmation State
  const [deleteConfig, setDeleteConfig] = useState<{ isOpen: boolean, checkInId: string | null }>({ isOpen: false, checkInId: null });

  // Infinite Scroll Ref
  const loaderRef = useRef<HTMLDivElement>(null);

  // Smart Install Prompt Logic
  useEffect(() => {
    // Check if dismissed recently (14 days)
    const dismissedAt = localStorage.getItem('install_banner_dismissed_at');
    const now = Date.now();
    const isRecentlyDismissed = dismissedAt && (now - parseInt(dismissedAt, 10) < 14 * 24 * 60 * 60 * 1000);

    if (!isRecentlyDismissed && !isStandalone) {
        if (isIOS) {
            setShowIOSPrompt(true);
        } else if (installPrompt) {
            setShowAndroidPrompt(true);
        }
    }
  }, [installPrompt, isIOS, isStandalone]);

  const handleDismissInstall = () => {
      localStorage.setItem('install_banner_dismissed_at', Date.now().toString());
      setShowIOSPrompt(false);
      setShowAndroidPrompt(false);
  };

  useEffect(() => {
      const observer = new IntersectionObserver(
          (entries) => {
              const target = entries[0];
              if (target.isIntersecting && hasMore && !searchQuery && !selectedRootEmotion && !selectedTagId) {
                  onLoadMore();
              }
          },
          { rootMargin: '100px' }
      );

      if (loaderRef.current) observer.observe(loaderRef.current);

      return () => {
          if (loaderRef.current) observer.unobserve(loaderRef.current);
      };
  }, [hasMore, onLoadMore, searchQuery, selectedRootEmotion, selectedTagId]);

  useEffect(() => {
      const hour = new Date().getHours();
      if (hour < 5) setGreeting('Good evening'); // Late night
      else if (hour < 12) setGreeting('Good morning');
      else if (hour < 18) setGreeting('Good afternoon');
      else setGreeting('Good evening');
  }, []);

  const promptDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDeleteConfig({ isOpen: true, checkInId: id });
  };
  
  const confirmDelete = () => {
      if (deleteConfig.checkInId) {
          onDeleteCheckIn(deleteConfig.checkInId);
          setDeleteConfig({ isOpen: false, checkInId: null });
      }
  };

  const todayCount = recentCheckIns.filter(c => new Date(c.timestamp).toDateString() === new Date().toDateString()).length;
  
  // Progress Calculations
  const countProgress = Math.min(100, (totalCount / 10) * 100);
  const daysProgress = Math.min(100, (daysTracked / 7) * 100);
  const bestProgress = Math.max(countProgress, daysProgress);

  // --- Filtering Logic ---
  const filteredCheckIns = useMemo(() => {
      return recentCheckIns.filter(c => {
          // 1. Text Search (Note)
          if (searchQuery && !c.note.toLowerCase().includes(searchQuery.toLowerCase())) {
              return false;
          }
          
          // 2. Root Emotion Filter
          if (selectedRootEmotion) {
              const primary = c.emotions.find(e => e.isPrimary);
              if (!primary) return false;
              const path = getEmotionPath(primary.nodeId);
              // Path[0] is root
              if (path[0].id !== selectedRootEmotion) return false;
          }

          // 3. Tag Filter
          if (selectedTagId) {
              if (!c.tags.includes(selectedTagId)) return false;
          }

          return true;
      });
  }, [recentCheckIns, searchQuery, selectedRootEmotion, selectedTagId]);

  const isFiltering = searchQuery || selectedRootEmotion || selectedTagId;
  
  // Get root nodes for filter dropdown
  const rootNodes = useMemo(() => Object.values(FEELING_NODES).filter(n => n.parentId === null), []);

  // --- UTILITY INSIGHT CALCULATION ---
  // Calculates one high-value pattern to show on home screen
  const topUtilityInsight = useMemo(() => {
      if (recentCheckIns.length < 5) return null;
      // We pass the full list (recentCheckIns might be paginated, ideally we'd use full history but for quick insight recent is okay or we'd need full list prop)
      // For immediate utility, even recent patterns are valuable.
      const patterns = calculateSmartPatterns(recentCheckIns, availableTags);
      if (patterns.length === 0) return null;
      
      // Prioritize Predictive, then highest Lift
      return patterns.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'predictive' ? -1 : 1;
          return b.lift - a.lift;
      })[0];
  }, [recentCheckIns, availableTags]);

  const emptyStateMessage = useMemo(() => {
    if (!isFiltering) return "Your mood history will appear here once you start checking in.";
    
    const parts = [];
    if (selectedRootEmotion) parts.push(`'${FEELING_NODES[selectedRootEmotion]?.label}'`);
    if (selectedTagId) {
        const tag = availableTags.find(t => t.id === selectedTagId);
        if (tag) parts.push(`tagged '${tag.label}'`);
    }
    if (searchQuery) parts.push(`matching "${searchQuery}"`);
    
    if (parts.length === 0) return "No matching entries found.";
    return `No entries found for ${parts.join(', ')}.`;
}, [isFiltering, selectedRootEmotion, selectedTagId, searchQuery, availableTags]);

  const finalGreeting = userName ? `${greeting}, ${userName}` : `${greeting},`;

  return (
    <div className="p-6 space-y-6 pb-24 animate-fade-in">
      <ConfirmDialog 
        isOpen={deleteConfig.isOpen}
        title="Delete Entry?"
        message="This check-in will be permanently removed."
        isDestructive={true}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfig({ isOpen: false, checkInId: null })}
      />

      {/* Hero / Call to Action */}
      {!isFiltering && (
          <div className="rounded-3xl p-6 text-accent-fg shadow-xl relative overflow-hidden transition-transform active:scale-[0.99]" style={{ backgroundColor: 'var(--color-accent)' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black opacity-5 rounded-full translate-y-1/2 -translate-x-1/3 pointer-events-none blur-xl"></div>
            
            <h2 className="text-2xl font-bold mb-1 relative z-10 truncate pr-4">{finalGreeting}</h2>
            <p className="mb-6 text-sm opacity-90 relative z-10 font-medium">Ready to log your mood?</p>
            
            <button 
            onClick={onCheckIn}
            className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.97]"
            >
            <Plus size={20} />
            Check In Now
            </button>
            {todayCount > 0 && (
                <div className="mt-4 text-xs opacity-80 font-medium flex items-center gap-1">
                    <Star size={12} fill="currentColor" /> You've checked in {todayCount} time{todayCount !== 1 ? 's' : ''} today.
                </div>
            )}
          </div>
      )}
      
      {/* HIGH UTILITY INSIGHT: Immediate Value Exchange */}
      {/* "Users will trade privacy for utility... if the value is exceptional and immediate." */}
      {!isFiltering && topUtilityInsight && (
          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm animate-fade-in-up flex flex-col gap-3 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
               <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                       <Lightbulb size={16} />
                   </div>
                   <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Daily Forecast</span>
               </div>
               
               <div className="flex items-center gap-2">
                   <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-sm">{topUtilityInsight.trigger}</span>
                   <ArrowRight size={14} className="text-slate-300" />
                   <span className={`font-bold px-2 py-0.5 rounded text-sm ${topUtilityInsight.sentiment === 'negative' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                       {topUtilityInsight.emotion}
                   </span>
               </div>

               <p className="text-sm font-medium text-slate-600 leading-relaxed">
                   {topUtilityInsight.message} 
                   <span className="block mt-1 text-xs opacity-70">
                       {topUtilityInsight.type === 'predictive' ? 'Based on patterns from the last 12 hours.' : 'Based on your recent history.'}
                   </span>
               </p>
          </div>
      )}
      
      {/* PWA Install Banner (Android) */}
      {!isFiltering && showAndroidPrompt && (
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg animate-fade-in relative">
            <button onClick={handleDismissInstall} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white"><X size={16} /></button>
            <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Download size={20} />
            </div>
            <div>
                <h3 className="font-bold text-sm">Install App</h3>
                <p className="text-[10px] text-slate-300">Add to Home Screen for offline access</p>
            </div>
            </div>
            <button onClick={onInstallApp} className="bg-white text-slate-900 px-4 py-2 rounded-lg text-xs font-bold active:scale-95 transition-transform">
            Install
            </button>
        </div>
      )}

      {/* PWA Install Instructions (iOS) */}
      {!isFiltering && showIOSPrompt && (
        <div className="bg-slate-100 border border-slate-200 text-slate-800 p-4 rounded-2xl relative animate-fade-in">
            <button onClick={handleDismissInstall} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                   <Download size={20} className="text-accent" />
                </div>
                <div>
                    <h3 className="font-bold text-sm mb-1">Install for iOS</h3>
                    <p className="text-xs text-slate-600 leading-relaxed mb-2">
                        For the best offline experience:
                    </p>
                    <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside font-medium">
                        <li className="flex items-center gap-1">Tap <Share size={12} className="inline text-accent"/> <span className="underline">Share</span> in toolbar</li>
                        <li className="flex items-center gap-1">Select <PlusSquare size={12} className="inline text-accent"/> <span className="underline">Add to Home Screen</span></li>
                    </ol>
                </div>
            </div>
        </div>
      )}
      
      {/* Gamification / Hook Area */}
      {!isFiltering && showGamification && !isInsightsUnlocked && totalCount > 0 && (
          <div className="bg-card border border-theme rounded-2xl p-4 flex items-center justify-between shadow-sm animate-fade-in">
              <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                      <Lock size={14} className="text-secondary" />
                      <span>Unlock Insights</span>
                  </div>
                  <p className="text-[10px] text-secondary">Log 10 times or track for 7 days</p>
              </div>
              <div className="flex items-center gap-3">
                  <div className="text-right">
                       <span className="text-xs font-bold text-accent">{Math.floor(bestProgress)}%</span>
                  </div>
                  <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${bestProgress}%` }}></div>
                  </div>
              </div>
          </div>
      )}

      {/* Search & Filter Bar */}
      <div className="space-y-2">
          <div className="flex items-center gap-2">
             <div className="flex-1 relative">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                    type="text" 
                    placeholder="Search notes..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-card border border-theme rounded-xl text-base outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-slate-400"
                 />
                 {searchQuery && (
                     <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                         <X size={14} />
                     </button>
                 )}
             </div>
             <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2.5 rounded-xl border transition-colors flex items-center gap-2 ${showFilters || (selectedRootEmotion || selectedTagId) ? 'bg-accent text-accent-fg border-accent' : 'bg-card border-theme text-secondary'}`}
             >
                 <Filter size={18} />
                 {(selectedRootEmotion || selectedTagId) && <div className="w-2 h-2 bg-white rounded-full"></div>}
             </button>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
              <div className="p-4 bg-card border border-theme rounded-xl space-y-4 animate-fade-in">
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-secondary uppercase">Emotion</label>
                      <div className="flex flex-wrap gap-2">
                          <button 
                             onClick={() => setSelectedRootEmotion(null)}
                             className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${!selectedRootEmotion ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-theme text-secondary'}`}
                          >
                             All
                          </button>
                          {rootNodes.map(node => (
                              <button
                                 key={node.id}
                                 onClick={() => setSelectedRootEmotion(selectedRootEmotion === node.id ? null : node.id)}
                                 className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedRootEmotion === node.id ? 'ring-2 ring-offset-1 ring-slate-300' : 'opacity-70 hover:opacity-100'}`}
                                 style={{ 
                                     backgroundColor: node.color, 
                                     color: node.textColor || '#fff',
                                     borderColor: node.color
                                 }}
                              >
                                  {node.label}
                              </button>
                          ))}
                      </div>
                  </div>
                  
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-secondary uppercase">Tag</label>
                      <div className="relative">
                         <select 
                            value={selectedTagId || ''} 
                            onChange={(e) => setSelectedTagId(e.target.value || null)}
                            className="w-full p-2 bg-white border border-theme rounded-lg text-sm text-primary appearance-none outline-none focus:border-accent"
                         >
                             <option value="">Any Tag</option>
                             {availableTags.map(tag => (
                                 <option key={tag.id} value={tag.id}>{tag.label}</option>
                             ))}
                         </select>
                         <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                  </div>

                  {(selectedRootEmotion || selectedTagId) && (
                      <div className="pt-2 flex justify-end">
                          <button 
                            onClick={() => { setSelectedRootEmotion(null); setSelectedTagId(null); }}
                            className="text-xs text-rose-500 font-bold hover:underline"
                          >
                              Clear Filters
                          </button>
                      </div>
                  )}
              </div>
          )}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end px-1">
           <h3 className="text-lg font-bold text-primary">
               {isFiltering ? 'Search Results' : 'Recent History'} 
               <span className="text-xs font-normal text-secondary opacity-60 ml-2">
                   ({isFiltering ? filteredCheckIns.length : recentCheckIns.length} {isFiltering ? 'found' : `of ${totalCount}`})
               </span>
           </h3>
        </div>
        
        {filteredCheckIns.length === 0 ? (
          <div className="text-center py-12 text-secondary bg-card rounded-2xl border border-theme border-dashed flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-app rounded-full flex items-center justify-center">
                <Smile className="w-8 h-8 text-secondary opacity-50" />
            </div>
            <div>
                <p className="font-bold text-primary">No matching entries</p>
                <p className="text-xs text-secondary max-w-[200px] mx-auto">
                   {emptyStateMessage}
                </p>
            </div>
            {!isFiltering && <button onClick={onCheckIn} className="text-accent text-xs font-bold hover:underline">Start your first entry</button>}
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in-up">
            {filteredCheckIns.map(ci => {
              const primaryPath = ci.emotions.find(e => e.isPrimary);
              const node = primaryPath ? FEELING_NODES[primaryPath.nodeId] : null;
              const otherCount = ci.emotions.length - 1;
              
              return (
                <div 
                    key={ci.id} 
                    onClick={() => onEditCheckIn(ci)}
                    className="p-4 rounded-2xl border border-theme shadow-sm flex items-center justify-between transition-all group relative overflow-hidden cursor-pointer hover:bg-slate-50/50 active:scale-[0.98]" 
                    style={{backgroundColor: 'var(--bg-card)'}}
                >
                  <div className="flex items-center gap-4">
                     <div className="w-3 h-12 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: node?.color || '#cbd5e1' }}></div>
                     <div className="min-w-0">
                        <div className="flex items-center gap-2">
                           <p className="font-bold text-primary text-lg truncate">{node?.label || 'Unknown'}</p>
                           {otherCount > 0 && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-medium shrink-0">+{otherCount}</span>}
                        </div>
                        <p className="text-xs text-secondary mt-0.5 flex items-center gap-1">
                            {new Date(ci.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                            <span className="opacity-50">•</span>
                            {new Date(ci.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}
                        </p>
                        {/* Show tags in search view for context */}
                        {isFiltering && ci.tags.length > 0 && (
                            <div className="flex gap-1 mt-1.5">
                                {ci.tags.slice(0, 3).map(tid => {
                                    const tag = availableTags.find(t => t.id === tid);
                                    return tag ? <span key={tid} className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{tag.label}</span> : null;
                                })}
                            </div>
                        )}
                     </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                      {ci.note && <div className="w-2 h-2 bg-slate-300 rounded-full" title="Has note"></div>}
                      <button onClick={(e) => promptDelete(e, ci.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-2 rounded-full hover:bg-rose-50">
                          <Trash2 size={18} />
                      </button>
                  </div>
                </div>
              );
            })}
            
            {/* Infinite Scroll Loader */}
            {!isFiltering && hasMore && (
                <div ref={loaderRef} className="py-6 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-secondary opacity-50" />
                </div>
            )}
            
            {!hasMore && !isFiltering && totalCount > 5 && (
                 <div className="py-6 text-center text-xs text-secondary opacity-40 font-medium">
                     — End of History —
                 </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeScreen;
