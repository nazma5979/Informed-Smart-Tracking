
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Star, Smile, Trash2, Lock, Search, Filter, X, ChevronDown } from 'lucide-react';
import { CheckIn, ContextTag } from '../types';
import { FEELING_NODES, getEmotionPath } from '../constants';
import ConfirmDialog from '../components/ConfirmDialog';

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
    availableTags 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRootEmotion, setSelectedRootEmotion] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('Hello');
  
  // Delete Confirmation State
  const [deleteConfig, setDeleteConfig] = useState<{ isOpen: boolean, checkInId: string | null }>({ isOpen: false, checkInId: null });

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

  return (
    <div className="p-6 space-y-6 pb-safe animate-fade-in">
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
            
            <h2 className="text-2xl font-bold mb-1 relative z-10">{greeting},</h2>
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
                    className="w-full pl-10 pr-4 py-2.5 bg-card border border-theme rounded-xl text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
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
          <div className="space-y-3 pb-24 animate-fade-in-up">
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
            {hasMore && !isFiltering && (
                <button onClick={onLoadMore} className="w-full py-3 text-sm font-bold text-secondary bg-card border border-theme rounded-xl hover:bg-slate-50 transition-colors">
                    Load More
                </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeScreen;
