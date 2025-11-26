
import React, { useState, useEffect, useMemo } from 'react';
import { CheckIn, InputMode, ContextTag, Scale } from '../types';
import { FEELING_NODES, DEFAULT_SCALES } from '../constants';
import WheelOfFeels from '../components/WheelOfFeels';
import ListModeWheel from '../components/ListModeWheel';
import WheelBreadcrumbChips from '../components/WheelBreadcrumbChips';
import { PieChart as PieIcon, List, Plus, ChevronRight, Activity, CheckCircle2, X, ArrowLeft, AlignLeft, Mic, AlertTriangle, RefreshCw, Save } from 'lucide-react';
import { ICON_MAP } from '../utils/icons';
import { db } from '../services/db';
import { Haptics } from '../utils/haptics';
import ConfirmDialog from '../components/ConfirmDialog';
import { v4 as uuidv4 } from 'uuid';
import { useCheckInViewModel } from '../hooks/useCheckInViewModel';

interface Props {
  initialCheckIn?: CheckIn;
  onComplete: () => void;
  onCancel: () => void;
  defaultInputMode: InputMode;
  availableTags: ContextTag[];
  onAddTag: (t: ContextTag) => Promise<void>;
  enabledScales: string[];
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

const OptimizedSlider: React.FC<{ 
    value: number, 
    min: number, 
    max: number, 
    step: number, 
    onChange: (val: number) => void 
}> = ({ value, min, max, step, onChange }) => {
    const [localValue, setLocalValue] = useState(value);
    useEffect(() => setLocalValue(value), [value]);
    return (
        <input 
            type="range" min={min} max={max} step={step} 
            value={localValue} 
            onChange={(e) => setLocalValue(parseInt(e.target.value))} 
            onMouseUp={() => { if(localValue!==value) { onChange(localValue); Haptics.tick(); }}}
            onTouchEnd={() => { if(localValue!==value) { onChange(localValue); Haptics.tick(); }}}
            onBlur={() => { if(localValue!==value) { onChange(localValue); Haptics.tick(); }}}
            className="w-full accent-slate-900 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer" 
        />
    );
};

const CheckInScreen: React.FC<Props> = ({ initialCheckIn, onComplete, onCancel, defaultInputMode, availableTags, onAddTag, enabledScales }) => {
  // Use ViewModel (SSOT)
  const vm = useCheckInViewModel({ initialCheckIn, enabledScales, onComplete, onCancel, defaultInputMode });
  
  // Local UI State (Modals/Forms not part of the core Check-In Data Model)
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagCategory, setNewTagCategory] = useState<ContextTag['category']>('activity');
  const [tagError, setTagError] = useState<string | undefined>();
  const [allScales, setAllScales] = useState<Scale[]>(DEFAULT_SCALES);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewportStyle, setViewportStyle] = useState<React.CSSProperties>({ height: '100%' });

  // Load scales locally for rendering
  useEffect(() => {
      db.getSettings().then(s => setAllScales([...DEFAULT_SCALES, ...s.customScales]));
  }, []);

  // Visual Viewport logic
  useEffect(() => {
    if (!window.visualViewport) return;
    const handleResize = () => {
        if (!window.visualViewport) return;
        setViewportStyle({ height: `${window.visualViewport.height}px`, transform: `translateY(${window.visualViewport.offsetTop}px)` });
    };
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();
    return () => { window.visualViewport?.removeEventListener('resize', handleResize); window.visualViewport?.removeEventListener('scroll', handleResize); };
  }, []);

  const handleCreateTag = async () => {
      const trimmed = newTagLabel.trim();
      if (!trimmed) return;
      if (availableTags.some(t => t.label.toLowerCase() === trimmed.toLowerCase())) { setTagError("Tag exists"); Haptics.error(); return; }
      Haptics.medium();
      const tag: ContextTag = { id: uuidv4(), label: trimmed, category: newTagCategory, isUserCreated: true };
      await onAddTag(tag);
      vm.updateState({ selectedTags: [...vm.presentState.selectedTags, tag.id] });
      setNewTagLabel('');
      setTagError(undefined);
      setShowAddTag(false);
  };

  const handleCancelClick = () => {
      if(vm.presentState.selectedNodeIds.length === 0 && !vm.presentState.note) { vm.handleCancel(); return; }
      setConfirmOpen(true);
  }

  const groupedTags = useMemo(() => {
      const groups: Record<string, ContextTag[]> = { people: [], place: [], activity: [], sleep: [], weather: [] };
      availableTags.forEach(t => { if (groups[t.category]) groups[t.category].push(t); });
      return groups;
  }, [availableTags]);

  const primaryNode = vm.presentState.primaryNodeId ? FEELING_NODES[vm.presentState.primaryNodeId] : null;
  const activeScales = allScales.filter(s => enabledScales.includes(s.id));
  const hasScales = activeScales.length > 0;
  const totalSteps = hasScales ? 3 : 2;
  const canGoBackInWheel = vm.step === 1 && vm.viewMode === 'WHEEL' && vm.wheelHistory.length > 0;

  const ambientStyle = useMemo(() => {
      if (!primaryNode) return { backgroundColor: 'var(--bg-app)' };
      return { background: `linear-gradient(180deg, color-mix(in srgb, ${primaryNode.color}, transparent 85%) 0%, var(--bg-app) 40%)` };
  }, [primaryNode]);

  return (
    <>
        <ConfirmDialog 
            isOpen={confirmOpen}
            title="Discard Check-in?"
            message="You have unsaved changes. Are you sure you want to discard them?"
            confirmLabel="Discard"
            cancelLabel="Keep Editing"
            isDestructive={true}
            onConfirm={vm.handleCancel}
            onCancel={() => setConfirmOpen(false)}
        />

        <div className="flex flex-col relative bg-white transition-colors duration-700 overflow-hidden" style={{ ...ambientStyle, ...viewportStyle }}>
            {/* Header */}
            <div className="flex-none sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-lg border-b border-slate-100/50">
                 <div className="flex items-center gap-4">
                    <button 
                        type="button"
                        onClick={() => canGoBackInWheel ? vm.setWheelHistory(prev => prev.slice(0, -1)) : handleCancelClick()}
                        disabled={vm.isSaving}
                        className="p-3 -ml-3 rounded-full text-secondary hover:bg-slate-100 transition-colors active-press"
                    >
                        {canGoBackInWheel ? <ArrowLeft size={24} /> : <X size={24} />}
                    </button>
                 </div>
                 <div className="flex items-center gap-2">
                    {vm.step > 1 && (
                         <button onClick={() => !vm.isSaving && vm.setStep(vm.step - 1 as any)} disabled={vm.isSaving} className="text-sm font-bold text-secondary hover:text-primary px-3 py-2 rounded-lg active-press">Back</button>
                    )}
                 </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
                 <div className="pt-6 pb-2"><StepIndicator current={vm.step} total={totalSteps} /></div>

                 {/* STEP 1: EMOTION */}
                 {vm.step === 1 && (
                    <div className="px-4 flex flex-col items-center animate-fade-in">
                        <div className="mb-6 text-center">
                            <h2 className="text-2xl font-black text-primary mb-1">How do you feel?</h2>
                            <p className="text-secondary text-sm">Tap slices to dive deeper</p>
                        </div>
                        <div className="bg-slate-100 p-1 rounded-xl flex mb-8 shadow-inner">
                            <button type="button" onClick={() => { vm.setViewMode('WHEEL'); Haptics.light(); }} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all active-press ${vm.viewMode === 'WHEEL' ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}><PieIcon size={14} /> Wheel</button>
                            <button type="button" onClick={() => { vm.setViewMode('LIST'); Haptics.light(); }} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all active-press ${vm.viewMode === 'LIST' ? 'bg-white text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}><List size={14} /> List</button>
                        </div>
                        <div className="w-full flex justify-center min-h-[320px]">
                            {vm.viewMode === 'WHEEL' ? (
                                <WheelOfFeels selectedIds={vm.presentState.selectedNodeIds} primaryId={vm.presentState.primaryNodeId} onToggle={vm.handleToggleNode} history={vm.wheelHistory} onHistoryChange={vm.setWheelHistory} width={window.innerWidth > 380 ? 340 : 300} height={window.innerWidth > 380 ? 340 : 300} />
                            ) : (
                                <ListModeWheel selectedIds={vm.presentState.selectedNodeIds} primaryId={vm.presentState.primaryNodeId} onToggle={vm.handleToggleNode} onSetPrimary={vm.handleSetPrimary} />
                            )}
                        </div>
                        <div className="mt-6 w-full max-w-xs">
                            <WheelBreadcrumbChips selectedNodeIds={vm.presentState.selectedNodeIds} primaryNodeId={vm.presentState.primaryNodeId} onSetPrimary={vm.handleSetPrimary} onNavigate={vm.handleNavigateWheel} />
                        </div>
                    </div>
                 )}

                 {/* STEP 2: CONTEXT */}
                 {vm.step === 2 && (
                    <div className="px-6 space-y-8 animate-fade-in max-w-md mx-auto">
                        <div className="text-center mb-4"><h2 className="text-2xl font-black text-primary mb-1">Add Context</h2><p className="text-secondary text-sm">What's happening right now?</p></div>
                        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 border border-theme shadow-sm space-y-6">
                            <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-2xl shadow-lg" style={{ backgroundColor: primaryNode ? primaryNode.color : '#ccc' }}>{primaryNode ? primaryNode.label.substring(0,1) : '?'}</div>
                                <div><p className="text-[10px] text-secondary uppercase font-bold tracking-widest mb-1">Primary Emotion</p><h2 className="text-2xl font-black text-primary leading-none">{primaryNode ? primaryNode.label : 'None'}</h2></div>
                            </div>
                            <div className="relative">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="flex items-center gap-2 text-xs font-bold text-secondary uppercase tracking-widest"><AlignLeft size={14}/> Note</label>
                                    {vm.hasSpeechSupport && (
                                        <button type="button" onClick={vm.toggleListening} className={`p-2 rounded-full transition-all active-press ${vm.isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-secondary hover:bg-slate-200'}`}><Mic size={16} /></button>
                                    )}
                                </div>
                                <textarea value={vm.presentState.note} onChange={(e) => vm.updateState({ note: e.target.value }, true)} placeholder={vm.isListening ? "Listening..." : "Write your thoughts..."} className={`w-full p-4 rounded-xl bg-slate-50 border-0 focus:ring-2 focus:ring-indigo-100 outline-none resize-none min-h-[120px] text-base text-primary placeholder:text-slate-400 leading-relaxed transition-colors ${vm.isListening ? 'ring-2 ring-red-100 bg-red-50/30' : ''}`} />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center"><h3 className="font-bold text-primary text-lg">Tags</h3><button type="button" onClick={() => setShowAddTag(true)} className="text-xs text-indigo-600 font-bold flex items-center gap-1 px-3 py-1.5 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors active-press"><Plus size={14} /> Create New</button></div>
                            <div className="space-y-6">
                                {Object.entries(groupedTags).map(([cat, tags]) => tags.length > 0 && (
                                    <div key={cat}>
                                        <h4 className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-3 flex items-center gap-2 opacity-60">{ICON_MAP[cat]} {cat}</h4>
                                        <div className="flex flex-wrap gap-2.5">
                                            {tags.map(tag => {
                                                const isSelected = vm.presentState.selectedTags.includes(tag.id);
                                                return <button type="button" key={tag.id} onClick={() => { Haptics.light(); isSelected ? vm.updateState({ selectedTags: vm.presentState.selectedTags.filter(t => t !== tag.id) }) : vm.updateState({ selectedTags: [...vm.presentState.selectedTags, tag.id] }); }} className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all active-press ${isSelected ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105' : 'bg-white text-secondary border-slate-200 shadow-sm hover:border-slate-300'}`}>{tag.label}</button>
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                 )}

                 {/* STEP 3: SCALES */}
                 {vm.step === 3 && (
                    <div className="px-6 space-y-8 animate-fade-in max-w-md mx-auto">
                        <div className="text-center mb-4"><h2 className="text-2xl font-black text-primary mb-1">Measurements</h2><p className="text-secondary text-sm">Rate the intensity</p></div>
                        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-theme shadow-sm space-y-6">
                            <div>
                                <label className="text-sm font-bold text-primary flex items-center gap-2 mb-4"><Activity size={18} className="text-indigo-500" /> Emotion Intensity</label>
                                <div className="flex gap-2 p-1.5 rounded-2xl bg-slate-50 border border-slate-100">
                                    {[1, 2, 3].map((level) => (
                                        <button type="button" key={level} onClick={() => { Haptics.light(); vm.updateState({ intensity: level }); }} className={`flex-1 py-4 rounded-xl text-sm font-bold transition-all active-press ${vm.presentState.intensity === level ? 'bg-white text-slate-900 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}>{level === 1 ? 'Mild' : level === 2 ? 'Moderate' : 'Strong'}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="border-t border-slate-100 my-6"></div>
                            {activeScales.map(scale => {
                                const val = vm.presentState.scaleValues[scale.id] || scale.defaultValue;
                                return (
                                <div key={scale.id} className="space-y-4">
                                    <div className="flex justify-between items-center"><span className="font-bold text-primary text-sm">{scale.label}</span><span className="bg-slate-900 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold text-white">{val}</span></div>
                                    <OptimizedSlider min={scale.min} max={scale.max} step={scale.step} value={val} onChange={(newVal) => vm.updateState({ scaleValues: { ...vm.presentState.scaleValues, [scale.id]: newVal } }, true)} />
                                    <div className="flex justify-between text-[10px] text-secondary font-bold uppercase tracking-wider"><span>{scale.minLabel}</span><span>{scale.maxLabel}</span></div>
                                </div>
                            )})}
                        </div>
                    </div>
                 )}
            </div>

            {/* Action Bar */}
            <div className="flex-none bg-white/90 backdrop-blur-xl border-t border-slate-100 p-6 pt-4 px-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
                <div className="max-w-md mx-auto">
                    {/* Graceful Failure UI: Shown only on save error */}
                    {vm.saveError ? (
                        <div className="flex flex-col gap-3 w-full animate-fade-in-up">
                            <div className="flex items-center gap-3 text-rose-700 bg-rose-50 p-4 rounded-2xl text-sm font-bold border border-rose-100 shadow-sm">
                                <AlertTriangle size={20} className="shrink-0" />
                                <div>
                                    <p>Connection Interrupted</p>
                                    <p className="text-xs font-medium text-rose-500 opacity-80 mt-0.5">{vm.saveError}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={vm.handleKeepDraft} 
                                    className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                                >
                                    <Save size={18} />
                                    Save Draft & Exit
                                </button>
                                <button 
                                    type="button" 
                                    onClick={vm.handleSave} 
                                    className="flex-1 py-3.5 bg-rose-600 text-white rounded-xl font-bold shadow-lg shadow-rose-200 flex items-center justify-center gap-2 active:scale-95 transition-transform animate-pulse"
                                >
                                    <RefreshCw size={18} />
                                    Retry
                                </button>
                            </div>
                        </div>
                    ) : (
                        // Standard Flow
                        vm.step === 1 ? (
                            <button type="button" onClick={() => vm.setStep(2)} disabled={vm.presentState.selectedNodeIds.length === 0} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl shadow-slate-200 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all flex justify-center items-center gap-2 active-press text-lg">Continue <ChevronRight size={20} /></button>
                        ) : (
                            vm.step === 2 && hasScales ? (
                                <button type="button" onClick={() => vm.setStep(3)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl shadow-slate-200 transition-all flex justify-center items-center gap-2 active-press text-lg">Next Step <ChevronRight size={20} /></button>
                            ) : (
                                <button type="button" onClick={vm.handleSave} disabled={vm.isSaving} className={`w-full py-4 rounded-2xl font-bold shadow-xl transition-all flex justify-center items-center gap-2 active-press text-lg ${vm.isSaving ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'}`}>{vm.isSaving ? <><CheckCircle2 size={24} className="animate-bounce" /> Saved!</> : <><CheckCircle2 size={24} /> Save Entry</>}</button>
                            )
                        )
                    )}
                </div>
            </div>
            
            {showAddTag && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[60] flex items-center justify-center p-6">
                    <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm shadow-2xl space-y-6 animate-fade-in-up">
                        <div className="flex justify-between items-center"><h3 className="font-black text-xl text-primary">New Tag</h3><button type="button" onClick={() => setShowAddTag(false)} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20} className="text-slate-500" /></button></div>
                        <div className="space-y-4">
                            {tagError && <p className="text-xs text-rose-600 font-bold p-3 bg-rose-50 rounded-xl flex items-center gap-2"><Activity size={14}/> {tagError}</p>}
                            <input autoFocus enterKeyHint="done" placeholder="e.g. Gaming, Reading..." value={newTagLabel} onChange={(e) => { setNewTagLabel(e.target.value); setTagError(undefined); }} onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()} className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold text-primary outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 text-lg bg-white" />
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-secondary uppercase ml-1">Category</label>
                                <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
                                    {['people', 'place', 'activity', 'sleep', 'weather'].map(cat => (
                                        <button type="button" key={cat} onClick={() => setNewTagCategory(cat as any)} className={`text-xs px-4 py-2.5 rounded-xl capitalize font-bold border-2 transition-all active-press ${newTagCategory === cat ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>{cat}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button type="button" onClick={handleCreateTag} disabled={!newTagLabel.trim()} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold disabled:opacity-50 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors active-press">Create Tag</button>
                    </div>
                </div>
            )}
        </div>
    </>
  );
};

export default CheckInScreen;
