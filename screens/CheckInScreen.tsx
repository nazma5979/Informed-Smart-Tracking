
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CheckIn, InputMode, ContextTag, FeelingNode, CheckInEmotionPath, Scale, AppSettings } from '../types';
import { FEELING_NODES, DEFAULT_TAGS, DEFAULT_SCALES, getEmotionPath } from '../constants';
import WheelOfFeels from '../components/WheelOfFeels';
import ListModeWheel from '../components/ListModeWheel';
import WheelBreadcrumbChips from '../components/WheelBreadcrumbChips';
import { PieChart as PieIcon, List, Clock, Plus, ChevronRight, Activity, CheckCircle2, X, Star, RotateCcw, RotateCw, ChevronLeft, AlignLeft, Check, Loader2 } from 'lucide-react';
import { ICON_MAP } from '../utils/icons';
import { db } from '../services/db';
import { Haptics } from '../utils/haptics';
import ConfirmDialog from '../components/ConfirmDialog';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  initialCheckIn?: CheckIn;
  onComplete: () => void;
  onCancel: () => void;
  defaultInputMode: InputMode;
  availableTags: ContextTag[];
  onAddTag: (t: ContextTag) => Promise<void>;
  enabledScales: string[];
}

interface CheckInFormState {
    selectedNodeIds: string[];
    primaryNodeId: string | null;
    note: string;
    selectedTags: string[];
    intensity: number | null;
    scaleValues: Record<string, number>;
    customTimestamp: string;
}

const StepIndicator: React.FC<{ current: number, total: number }> = ({ current, total }) => (
    <div className="flex justify-center gap-2 mb-6">
        {[...Array(total)].map((_, i) => (
            <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-500 ${i + 1 === current ? 'w-8 bg-slate-800' : 'w-2 bg-slate-300/50'}`}
            />
        ))}
    </div>
);

const CheckInScreen: React.FC<Props> = ({ initialCheckIn, onComplete, onCancel, defaultInputMode, availableTags, onAddTag, enabledScales }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1); 
  const [viewMode, setViewMode] = useState<InputMode>(defaultInputMode);
  
  const [wheelHistory, setWheelHistory] = useState<FeelingNode[]>([]); 
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagCategory, setNewTagCategory] = useState<ContextTag['category']>('activity');
  const [tagError, setTagError] = useState<string | undefined>();
  const [allScales, setAllScales] = useState<Scale[]>(DEFAULT_SCALES);
  
  // Visual State for Saving
  const [isSaving, setIsSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [history, setHistory] = useState<{
      past: CheckInFormState[];
      present: CheckInFormState;
      future: CheckInFormState[];
  }>({
      past: [],
      present: {
          selectedNodeIds: [],
          primaryNodeId: null,
          note: '',
          selectedTags: [],
          intensity: null,
          scaleValues: {},
          customTimestamp: ''
      },
      future: []
  });

  const { present } = history;
  const DRAFT_KEY = 'checkin_draft';

  const updateState = useCallback((updates: Partial<CheckInFormState>, replace = false) => {
      setHistory(curr => {
          if (replace) {
              return { ...curr, present: { ...curr.present, ...updates } };
          }
          return {
              past: [...curr.past, curr.present],
              present: { ...curr.present, ...updates },
              future: [] 
          };
      });
  }, []);

  const transitionToStep = (newStep: 1 | 2 | 3) => {
      if (document.startViewTransition) {
          document.startViewTransition(() => setStep(newStep));
      } else {
          setStep(newStep);
      }
  };

  useEffect(() => {
      db.getSettings().then(s => {
          setAllScales([...DEFAULT_SCALES, ...s.customScales]);
      });

      let initialState: CheckInFormState = {
          selectedNodeIds: [],
          primaryNodeId: null,
          note: '',
          selectedTags: [],
          intensity: null,
          scaleValues: {},
          customTimestamp: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      };

      if (initialCheckIn) {
          const d = new Date(initialCheckIn.timestamp);
          d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
          initialState = {
              selectedNodeIds: initialCheckIn.emotions.map(e => e.nodeId),
              primaryNodeId: initialCheckIn.emotions.find(e => e.isPrimary)?.nodeId || null,
              note: initialCheckIn.note || '',
              selectedTags: initialCheckIn.tags || [],
              intensity: initialCheckIn.intensity,
              scaleValues: initialCheckIn.scaleValues || {},
              customTimestamp: d.toISOString().slice(0, 16)
          };
      } else {
          const draft = localStorage.getItem(DRAFT_KEY);
          if (draft) {
             try {
                 const parsed = JSON.parse(draft);
                 const isSameContext = initialCheckIn ? (parsed.editingId === initialCheckIn.id) : !parsed.editingId;
                 if (isSameContext) initialState = { ...initialState, ...parsed };
             } catch(e) { localStorage.removeItem(DRAFT_KEY); }
          }
      }
      if (Object.keys(initialState.scaleValues).length === 0) {
          const defaults: Record<string, number> = {};
          DEFAULT_SCALES.forEach(s => {
              if (enabledScales.includes(s.id)) defaults[s.id] = s.defaultValue;
          });
          initialState.scaleValues = { ...defaults, ...initialState.scaleValues };
      }
      setHistory({ past: [], present: initialState, future: [] });
  }, [initialCheckIn, enabledScales]);

  useEffect(() => {
      if (present.selectedNodeIds.length > 0) {
          const draft = { editingId: initialCheckIn?.id, ...present, timestamp: Date.now() };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
  }, [present, initialCheckIn]);

  const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

  const handleToggleNode = (nodeId: string) => {
     const prevIds = present.selectedNodeIds;
     const exists = prevIds.includes(nodeId);
     let newSelection = exists ? prevIds.filter(id => id !== nodeId) : [...prevIds, nodeId];
     let newPrimary = present.primaryNodeId;
     if (!exists && newSelection.length === 1) newPrimary = nodeId;
     else if (exists && present.primaryNodeId === nodeId) newPrimary = newSelection.length > 0 ? newSelection[newSelection.length - 1] : null;
     updateState({ selectedNodeIds: newSelection, primaryNodeId: newPrimary });
  };

  const handleSetPrimary = (nodeId: string) => { 
      if (present.selectedNodeIds.includes(nodeId)) {
          Haptics.light();
          updateState({ primaryNodeId: nodeId });
      }
  };
  
  const handleNavigateWheel = (nodeId: string) => {
      const path = getEmotionPath(nodeId);
      setWheelHistory(path);
      setViewMode('WHEEL');
  };

  const handleSave = async () => {
    if (present.selectedNodeIds.length === 0 || !present.primaryNodeId || isSaving) return;
    
    setIsSaving(true);
    Haptics.success(); // Satisfying bump

    const now = Date.now();
    const userTime = present.customTimestamp ? new Date(present.customTimestamp).getTime() : now;
    const emotions: CheckInEmotionPath[] = present.selectedNodeIds.map(id => {
       const node = FEELING_NODES[id];
       return { pathId: uuidv4(), nodeId: id, ringIndex: node.ringIndex, isPrimary: id === present.primaryNodeId };
    });
    
    const checkInToSave: CheckIn = {
      id: initialCheckIn ? initialCheckIn.id : uuidv4(),
      timestamp: userTime, 
      timezoneOffset: new Date().getTimezoneOffset(),
      createdAt: initialCheckIn ? initialCheckIn.createdAt : now,
      modifiedAt: initialCheckIn ? now : undefined,
      emotions,
      note: present.note,
      intensity: present.intensity,
      tags: present.selectedTags,
      scaleValues: present.scaleValues
    };

    await db.saveCheckIn(checkInToSave);
    clearDraft();
    
    // Slight delay so user sees the "Saved!" state before navigation
    setTimeout(() => {
        onComplete();
    }, 500);
  };
  
  const handleCancel = () => {
      if(present.selectedNodeIds.length === 0) { onCancel(); return; }
      setConfirmOpen(true);
  }
  
  const confirmCancel = () => {
      clearDraft();
      onCancel();
  }

  const handleCreateTag = async () => {
      const trimmed = newTagLabel.trim();
      if (!trimmed) return;
      const isDuplicate = availableTags.some(t => t.label.toLowerCase() === trimmed.toLowerCase());
      if (isDuplicate) { setTagError("Tag exists"); Haptics.error(); return; }
      Haptics.medium();
      const tag: ContextTag = { id: uuidv4(), label: trimmed, category: newTagCategory, isUserCreated: true };
      await onAddTag(tag);
      updateState({ selectedTags: [...present.selectedTags, tag.id] });
      setNewTagLabel('');
      setTagError(undefined);
      setShowAddTag(false);
  };

  const groupedTags = useMemo(() => {
      const groups: Record<string, ContextTag[]> = { people: [], place: [], activity: [], sleep: [], weather: [] };
      availableTags.forEach(t => { if (groups[t.category]) groups[t.category].push(t); });
      return groups;
  }, [availableTags]);

  const primaryNode = present.primaryNodeId ? FEELING_NODES[present.primaryNodeId] : null;
  const activeScales = allScales.filter(s => enabledScales.includes(s.id));
  const hasScales = activeScales.length > 0;
  const totalSteps = hasScales ? 3 : 2;

  // Background Logic: White with calm gradient
  // WARMTH FIX: Increased opacity from 95% transparent (5%) to 85% transparent (15%)
  const ambientStyle = useMemo(() => {
      if (!primaryNode) return { backgroundColor: 'var(--bg-app)' };
      return {
          background: `linear-gradient(180deg, color-mix(in srgb, ${primaryNode.color}, transparent 85%) 0%, var(--bg-app) 40%)`,
      };
  }, [primaryNode]);

  return (
    <div className="flex flex-col h-full relative bg-white transition-colors duration-700" style={ambientStyle}>
        
        <ConfirmDialog 
            isOpen={confirmOpen}
            title="Discard Check-in?"
            message="You have unsaved changes. Are you sure you want to discard them?"
            confirmLabel="Discard"
            cancelLabel="Keep Editing"
            isDestructive={true}
            onConfirm={confirmCancel}
            onCancel={() => setConfirmOpen(false)}
        />

        {/* Focus Header */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-lg border-b border-slate-100/50">
             <div className="flex items-center gap-4">
                <button 
                    onClick={handleCancel} 
                    disabled={isSaving}
                    className="p-3 -ml-3 rounded-full text-secondary hover:bg-slate-100 transition-colors active:scale-90"
                    aria-label="Cancel"
                >
                    <X size={24} />
                </button>
             </div>
             <div className="flex items-center gap-2">
                {step > 1 && (
                     <button 
                        onClick={() => !isSaving && transitionToStep(step - 1 as any)} 
                        disabled={isSaving}
                        className="text-sm font-bold text-secondary hover:text-primary px-3 py-2 rounded-lg active:bg-slate-100"
                     >
                        Back
                     </button>
                )}
             </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-32">
             <div className="pt-6 pb-2">
                <StepIndicator current={step} total={totalSteps} />
             </div>

             {/* STEP 1: EMOTION */}
             {step === 1 && (
                <div className="px-4 flex flex-col items-center animate-fade-in">
                    <div className="mb-6 text-center">
                        <h2 className="text-2xl font-black text-primary mb-1">How do you feel?</h2>
                        <p className="text-secondary text-sm">Tap slices to dive deeper</p>
                    </div>

                    <div className="bg-slate-100 p-1 rounded-xl flex mb-8 shadow-inner">
                        <button onClick={() => { setViewMode('WHEEL'); Haptics.light(); }} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'WHEEL' ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}><PieIcon size={14} /> Wheel</button>
                        <button onClick={() => { setViewMode('LIST'); Haptics.light(); }} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'LIST' ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}><List size={14} /> List</button>
                    </div>

                    <div className="w-full flex justify-center min-h-[320px]">
                        {viewMode === 'WHEEL' ? (
                            <WheelOfFeels selectedIds={present.selectedNodeIds} primaryId={present.primaryNodeId} onToggle={handleToggleNode} history={wheelHistory} onHistoryChange={setWheelHistory} width={window.innerWidth > 380 ? 340 : 300} height={window.innerWidth > 380 ? 340 : 300} />
                        ) : (
                            <ListModeWheel selectedIds={present.selectedNodeIds} primaryId={present.primaryNodeId} onToggle={handleToggleNode} onSetPrimary={handleSetPrimary} />
                        )}
                    </div>
                    
                    <div className="mt-6 w-full max-w-xs">
                        <WheelBreadcrumbChips selectedNodeIds={present.selectedNodeIds} primaryNodeId={present.primaryNodeId} onSetPrimary={handleSetPrimary} onNavigate={handleNavigateWheel} />
                    </div>
                </div>
             )}

             {/* STEP 2: CONTEXT */}
             {step === 2 && (
                <div className="px-6 space-y-8 animate-fade-in max-w-md mx-auto">
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-black text-primary mb-1">Add Context</h2>
                        <p className="text-secondary text-sm">What's happening right now?</p>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 border border-theme shadow-sm space-y-6">
                         {/* Primary Emotion Card */}
                        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-2xl shadow-lg animate-pulse" style={{ backgroundColor: primaryNode ? primaryNode.color : '#ccc', animationDuration: '3s' }}>
                                {primaryNode ? primaryNode.label.substring(0,1) : '?'}
                            </div>
                            <div>
                                <p className="text-[10px] text-secondary uppercase font-bold tracking-widest mb-1">Primary Emotion</p>
                                <h2 className="text-2xl font-black text-primary leading-none">{primaryNode ? primaryNode.label : 'None'}</h2>
                            </div>
                        </div>

                        {/* Journal Note */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-widest mb-3"><AlignLeft size={14}/> Note</label>
                            <textarea 
                                value={present.note} 
                                onChange={(e) => updateState({ note: e.target.value }, true)} 
                                onBlur={() => updateState({ note: present.note })} 
                                placeholder="Write your thoughts..." 
                                className="w-full p-4 rounded-xl bg-slate-50 border-0 focus:ring-2 focus:ring-indigo-100 outline-none resize-none min-h-[120px] text-base text-primary placeholder:text-slate-400 leading-relaxed" 
                            />
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-primary text-lg">Tags</h3>
                            <button onClick={() => setShowAddTag(true)} className="text-xs text-indigo-600 font-bold flex items-center gap-1 px-3 py-1.5 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors"><Plus size={14} /> Create New</button>
                        </div>
                        <div className="space-y-6">
                            {Object.entries(groupedTags).map(([cat, tags]) => tags.length > 0 && (
                                <div key={cat}>
                                    <h4 className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-3 flex items-center gap-2 opacity-60">{ICON_MAP[cat]} {cat}</h4>
                                    <div className="flex flex-wrap gap-2.5">
                                        {tags.map(tag => {
                                            const isSelected = present.selectedTags.includes(tag.id);
                                            return (
                                                <button 
                                                    key={tag.id} 
                                                    onClick={() => {
                                                        Haptics.light();
                                                        if(isSelected) updateState({ selectedTags: present.selectedTags.filter(t => t !== tag.id) });
                                                        else updateState({ selectedTags: [...present.selectedTags, tag.id] });
                                                    }} 
                                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${isSelected ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105' : 'bg-white text-secondary border-slate-200 shadow-sm hover:border-slate-300'}`}
                                                >
                                                    {tag.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
             )}

             {/* STEP 3: SCALES */}
             {step === 3 && (
                <div className="px-6 space-y-8 animate-fade-in max-w-md mx-auto">
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-black text-primary mb-1">Measurements</h2>
                        <p className="text-secondary text-sm">Rate the intensity</p>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-theme shadow-sm space-y-6">
                        <div>
                            <label className="text-sm font-bold text-primary flex items-center gap-2 mb-4"><Activity size={18} className="text-indigo-500" /> Emotion Intensity</label>
                            <div className="flex gap-2 p-1.5 rounded-2xl bg-slate-50 border border-slate-100">
                                {[1, 2, 3].map((level) => (
                                    <button 
                                        key={level} 
                                        onClick={() => { Haptics.light(); updateState({ intensity: level }); }} 
                                        className={`flex-1 py-4 rounded-xl text-sm font-bold transition-all ${present.intensity === level ? 'bg-white text-slate-900 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                    {level === 1 ? 'Mild' : level === 2 ? 'Moderate' : 'Strong'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-slate-100 my-6"></div>

                        {activeScales.map(scale => {
                            const val = present.scaleValues[scale.id] || scale.defaultValue;
                            return (
                            <div key={scale.id} className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-primary text-sm">{scale.label}</span>
                                    <span className="bg-slate-900 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold text-white">{val}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min={scale.min} max={scale.max} step={scale.step} 
                                    value={val} 
                                    onChange={(e) => updateState({ scaleValues: { ...present.scaleValues, [scale.id]: parseInt(e.target.value) } }, true)} 
                                    onMouseUp={() => Haptics.tick()}
                                    onTouchEnd={() => Haptics.tick()}
                                    className="w-full accent-slate-900 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer" 
                                />
                                <div className="flex justify-between text-[10px] text-secondary font-bold uppercase tracking-wider">
                                    <span>{scale.minLabel}</span>
                                    <span>{scale.maxLabel}</span>
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
             )}
        </div>

        {/* Sticky Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
            <div className="max-w-md mx-auto bg-white/90 backdrop-blur-xl border-t border-slate-100 p-6 pb-safe pt-4 px-6 pointer-events-auto shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                {step === 1 ? (
                    <button 
                        onClick={() => transitionToStep(2)} 
                        disabled={present.selectedNodeIds.length === 0} 
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl shadow-slate-200 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all flex justify-center items-center gap-2 active:scale-[0.98] text-lg"
                    >
                        Continue <ChevronRight size={20} />
                    </button>
                ) : (
                    step === 2 && hasScales ? (
                        <button onClick={() => transitionToStep(3)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl shadow-slate-200 transition-all flex justify-center items-center gap-2 active:scale-[0.98] text-lg">
                            Next Step <ChevronRight size={20} />
                        </button>
                    ) : (
                        <button 
                            onClick={handleSave} 
                            disabled={isSaving}
                            className={`w-full py-4 rounded-2xl font-bold shadow-xl transition-all flex justify-center items-center gap-2 active:scale-[0.98] text-lg ${
                                isSaving 
                                ? 'bg-emerald-500 text-white shadow-emerald-200' 
                                : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'
                            }`}
                        >
                            {isSaving ? (
                                <>
                                    <CheckCircle2 size={24} className="animate-bounce" /> 
                                    Saved!
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={24} /> 
                                    Save Entry
                                </>
                            )}
                        </button>
                    )
                )}
            </div>
        </div>
        
        {/* Add Tag Modal */}
        {showAddTag && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[60] flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm shadow-2xl space-y-6 animate-fade-in-up">
                    <div className="flex justify-between items-center">
                        <h3 className="font-black text-xl text-primary">New Tag</h3>
                        <button onClick={() => setShowAddTag(false)} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20} className="text-slate-500" /></button>
                    </div>
                    
                    <div className="space-y-4">
                        {tagError && <p className="text-xs text-rose-600 font-bold p-3 bg-rose-50 rounded-xl flex items-center gap-2"><Activity size={14}/> {tagError}</p>}
                        <input 
                            autoFocus 
                            placeholder="e.g. Gaming, Reading..." 
                            value={newTagLabel} 
                            onChange={(e) => { setNewTagLabel(e.target.value); setTagError(undefined); }} 
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()} 
                            className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-primary outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 text-lg bg-white" 
                        />
                        
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase ml-1">Category</label>
                            <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
                                {['people', 'place', 'activity', 'sleep', 'weather'].map(cat => (
                                    <button 
                                        key={cat} 
                                        onClick={() => setNewTagCategory(cat as any)} 
                                        className={`text-xs px-4 py-2.5 rounded-xl capitalize font-bold border-2 transition-all ${newTagCategory === cat ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button onClick={handleCreateTag} disabled={!newTagLabel.trim()} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold disabled:opacity-50 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">Create Tag</button>
                </div>
            </div>
        )}
    </div>
  );
};

export default CheckInScreen;
