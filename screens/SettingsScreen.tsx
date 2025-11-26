
import React, { useState, useMemo, useRef } from 'react';
import { AppSettings, ReminderConfig, Theme, ContextTag, Scale, ScheduleType, FixedTime } from '../types';
import { Bell, ChevronRight, Eye, Clock, Zap, Trash2, Plus, Tag, Sliders, Save, Upload, FileSpreadsheet, PlayCircle, Download, Check, AlertCircle, ArrowUp, ArrowDown, Pencil, X, Activity, User, SortAsc, ShieldCheck, Database, WifiOff, Lock, Stethoscope, BookOpen } from 'lucide-react';
import { DEFAULT_SCALES, DEFAULT_TAGS } from '../constants';
import { Haptics } from '../utils/haptics';
import ConfirmDialog from '../components/ConfirmDialog';
import SlideOver from '../components/SlideOver';
import ClinicalModeWalkthrough from '../components/ClinicalModeWalkthrough';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/db';

interface SettingsScreenProps {
    settings: AppSettings;
    onSaveSettings: (s: AppSettings) => Promise<void>;
    onClearData: () => void;
    onReplayOnboarding: () => void;
    onDeleteCustomTag: (id: string) => void;
    onUpdateCustomTag: (tag: ContextTag) => Promise<void>;
    customTags: ContextTag[];
    availableTags?: ContextTag[];
    onDone: () => void;
    installPromptEvent: any;
    onInstallApp: () => void;
    onExportData: () => Promise<void>;
    onImportData: (file: File) => Promise<void>;
}

// UI Components
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h3 className="text-xs font-extrabold uppercase text-secondary tracking-widest px-4 mb-2 mt-8 first:mt-2">
        {title}
    </h3>
);

const SettingItem: React.FC<{ 
    label: string; 
    subLabel?: string; 
    icon?: React.ReactNode; 
    onClick?: () => void; 
    rightContent?: React.ReactNode;
    isLast?: boolean;
    destructive?: boolean;
}> = ({ label, subLabel, icon, onClick, rightContent, isLast, destructive }) => (
    <button 
        onClick={onClick}
        disabled={!onClick}
        className={`w-full flex items-center justify-between p-4 bg-card transition-colors ${!isLast ? 'border-b border-theme' : ''} ${onClick ? 'active:bg-slate-50' : 'cursor-default'}`}
    >
        <div className="flex items-center gap-4">
            {icon && (
                <div className={`p-2 rounded-xl ${destructive ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-indigo-500'}`}>
                    {icon}
                </div>
            )}
            <div className="text-left">
                <div className={`font-bold text-sm ${destructive ? 'text-rose-600' : 'text-primary'}`}>{label}</div>
                {subLabel && <div className="text-xs text-secondary font-medium mt-0.5">{subLabel}</div>}
            </div>
        </div>
        {rightContent ? rightContent : (onClick && <ChevronRight size={16} className="text-slate-300" />)}
    </button>
);

const Toggle: React.FC<{ value: boolean, onChange: (v: boolean) => void }> = ({ value, onChange }) => (
    <button 
        onClick={(e) => { e.stopPropagation(); Haptics.light(); onChange(!value); }}
        className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/20 ${value ? 'bg-accent' : 'bg-slate-200'}`}
        aria-pressed={value}
    >
        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`}></div>
    </button>
);

const ThemeSwatch: React.FC<{ themeId: Theme, label: string, isActive: boolean, onClick: () => void, color1: string, color2: string }> = ({ themeId, label, isActive, onClick, color1, color2 }) => (
    <button 
        onClick={() => { Haptics.light(); onClick(); }}
        className={`relative flex flex-col items-center gap-2 group`}
    >
        <div className={`w-full aspect-[4/3] rounded-2xl shadow-sm flex overflow-hidden border-2 transition-all ${isActive ? 'border-accent ring-2 ring-accent/20 ring-offset-1' : 'border-transparent'}`}>
            <div className="flex-1 h-full" style={{ backgroundColor: color1 }}></div>
            <div className="flex-1 h-full" style={{ backgroundColor: color2 }}></div>
        </div>
        <span className={`text-[10px] font-bold ${isActive ? 'text-accent' : 'text-secondary'}`}>{label}</span>
    </button>
);

const TrustIndicator = ({ icon: Icon, label, value, color }: any) => (
    <div className="flex flex-col items-center gap-1">
        <div className={`p-2 rounded-full bg-slate-50 ${color}`}>
            <Icon size={16} />
        </div>
        <div className="text-[10px] text-secondary font-bold uppercase tracking-wide">{label}</div>
        <div className="text-xs font-black text-primary">{value}</div>
    </div>
);

const SettingsScreen: React.FC<SettingsScreenProps> = ({ settings, onSaveSettings, onClearData, onReplayOnboarding, onDeleteCustomTag, onUpdateCustomTag, customTags, availableTags = [], onDone, installPromptEvent, onInstallApp, onExportData, onImportData }) => {
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
    const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
    const [showClinicalWalkthrough, setShowClinicalWalkthrough] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // SlideOvers
    const [activeSlide, setActiveSlide] = useState<'tags' | 'scales' | null>(null);
    
    // Confirmation
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        isDestructive: boolean;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', isDestructive: false, onConfirm: () => {} });

    // Temp State for Fixed Time Input
    const [newFixedTime, setNewFixedTime] = useState<string>('09:00');
    
    // Tag Form State
    const [tagFormState, setTagFormState] = useState<{
        isOpen: boolean;
        tag?: ContextTag;
        label: string;
        category: ContextTag['category'];
        error?: string;
    }>({ isOpen: false, label: '', category: 'activity' });

    // Scale Form State
    const [scaleFormState, setScaleFormState] = useState<{
        isOpen: boolean;
        scale?: Scale;
        label: string;
        minLabel: string;
        maxLabel: string;
        min: number;
        max: number;
        error?: string;
    }>({ isOpen: false, label: '', minLabel: 'Low', maxLabel: 'High', min: 1, max: 5 });

    const themes: {id: Theme, label: string, c1: string, c2: string}[] = [
        { id: 'original', label: 'Default', c1: '#f8fafc', c2: '#4f46e5' },
        { id: 'light', label: 'Warm', c1: '#fbfbfb', c2: '#f58846' },
        { id: 'dark', label: 'Dark', c1: '#111111', c2: '#277da1' },
        { id: 'sepia', label: 'Earthy', c1: '#f8f1e3', c2: '#d6625c' },
        { id: 'grey', label: 'Muted', c1: '#5a5a5c', c2: '#8ba7c4' },
        { id: 'pastel', label: 'Soft', c1: '#e8e6ea', c2: '#90f1ef' },
    ];

    const tagsToRender = useMemo(() => {
        const allTags = [...DEFAULT_TAGS, ...customTags];
        if (!localSettings.tagOrder || localSettings.tagOrder.length === 0) {
            return availableTags.length > 0 ? availableTags : allTags;
        }
        const orderedTags = localSettings.tagOrder
            .map(id => allTags.find(t => t.id === id))
            .filter(Boolean) as ContextTag[];
        const unlistedTags = allTags.filter(t => !localSettings.tagOrder!.includes(t.id));
        return [...orderedTags, ...unlistedTags];
    }, [localSettings.tagOrder, customTags, availableTags]);

    const allScales = useMemo(() => {
        return [...DEFAULT_SCALES, ...localSettings.customScales];
    }, [localSettings.customScales]);

    const handleSaveAll = async () => {
        Haptics.success();
        await onSaveSettings(localSettings);
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
    }

    const requestConfirm = (title: string, message: string, isDestructive: boolean, action: () => void) => {
        setConfirmConfig({
            isOpen: true,
            title,
            message,
            isDestructive,
            onConfirm: () => {
                action();
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // --- LOGIC HANDLERS ---
    const handleToggleScale = (id: string) => {
        setLocalSettings(prev => {
            const exists = prev.enabledScales.includes(id);
            return { ...prev, enabledScales: exists ? prev.enabledScales.filter(sid => sid !== id) : [...prev.enabledScales, id] };
        });
    }

    const handleEditScale = (scale: Scale) => setScaleFormState({ isOpen: true, scale, label: scale.label, minLabel: scale.minLabel, maxLabel: scale.maxLabel, min: scale.min, max: scale.max });
    const handleCreateScale = () => setScaleFormState({ isOpen: true, scale: undefined, label: '', minLabel: 'Low', maxLabel: 'High', min: 1, max: 5 });
    
    const handleSaveScale = () => {
        const label = scaleFormState.label.trim();
        if (!label) { setScaleFormState(prev => ({ ...prev, error: "Label is required" })); return; }
        const newScale: Scale = {
            id: scaleFormState.scale ? scaleFormState.scale.id : uuidv4(),
            label, minLabel: scaleFormState.minLabel, maxLabel: scaleFormState.maxLabel, min: scaleFormState.min, max: scaleFormState.max, step: 1,
            defaultValue: Math.floor((scaleFormState.max + scaleFormState.min) / 2),
            isUserCreated: true
        };
        setLocalSettings(prev => {
            const isEdit = !!scaleFormState.scale;
            const newCustomScales = isEdit ? prev.customScales.map(s => s.id === newScale.id ? newScale : s) : [...prev.customScales, newScale];
            return { ...prev, customScales: newCustomScales, enabledScales: isEdit ? prev.enabledScales : [...prev.enabledScales, newScale.id] };
        });
        setScaleFormState(prev => ({ ...prev, isOpen: false }));
        Haptics.success();
    }

    const handleDeleteScale = (id: string) => {
        requestConfirm("Delete Scale?", "History preserved, but you cannot log new values.", true, () => {
            setLocalSettings(prev => ({ ...prev, customScales: prev.customScales.filter(s => s.id !== id), enabledScales: prev.enabledScales.filter(s => s !== id) }));
            Haptics.medium();
        });
    }

    const handleEditTag = (tag: ContextTag) => setTagFormState({ isOpen: true, tag, label: tag.label, category: tag.category });
    const handleCreateTag = () => setTagFormState({ isOpen: true, tag: undefined, label: '', category: 'activity' });
    
    const handleSaveTag = async () => {
        const trimmed = tagFormState.label.trim();
        if (!trimmed) return;
        const updatedTag: ContextTag = { id: tagFormState.tag ? tagFormState.tag.id : uuidv4(), label: trimmed, category: tagFormState.category, isUserCreated: true };
        await onUpdateCustomTag(updatedTag);
        if (!tagFormState.tag) setLocalSettings(prev => ({ ...prev, tagOrder: prev.tagOrder ? [...prev.tagOrder, updatedTag.id] : undefined }));
        setTagFormState({ isOpen: false, label: '', category: 'activity' });
        Haptics.success();
    }

    const handleDeleteTag = async (tagId: string) => {
        requestConfirm("Delete Tag?", "This will be removed permanently.", true, async () => {
            await onDeleteCustomTag(tagId);
            setLocalSettings(prev => ({ ...prev, tagOrder: prev.tagOrder ? prev.tagOrder.filter(id => id !== tagId) : [] }));
            Haptics.medium();
        });
    }

    const handleMoveTag = (tagId: string, direction: -1 | 1) => {
        const currentOrder = localSettings.tagOrder ? [...localSettings.tagOrder] : tagsToRender.map(t => t.id);
        const currentIndex = currentOrder.indexOf(tagId);
        if (currentIndex === -1) return;
        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= currentOrder.length) return;
        [currentOrder[currentIndex], currentOrder[newIndex]] = [currentOrder[newIndex], currentOrder[currentIndex]];
        setLocalSettings(prev => ({ ...prev, tagOrder: currentOrder }));
        Haptics.light();
    };

    const handleToggleReminders = async (enabled: boolean) => {
        if (enabled && Notification.permission === 'default') {
            const result = await Notification.requestPermission();
            if (result !== 'granted') return;
        }
        setLocalSettings(prev => ({ ...prev, reminders: { ...prev.reminders, enabled } }));
    };
    
    const handleEnableClinicalMode = () => {
        setLocalSettings(s => ({ ...s, clinicalModeEnabled: true }));
        setShowClinicalWalkthrough(false);
        Haptics.success();
    };

    return (
        <>
            <ConfirmDialog 
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                isDestructive={confirmConfig.isDestructive}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({...prev, isOpen: false}))}
            />

            {showClinicalWalkthrough && (
                <ClinicalModeWalkthrough 
                    onClose={() => setShowClinicalWalkthrough(false)}
                    onEnable={handleEnableClinicalMode}
                />
            )}

            <div className="pb-32 animate-fade-in max-w-lg mx-auto">
                {/* SECTION: DATA TRUST (New - TPC Paradigm) */}
                <div className="mx-4 mt-6 bg-white border border-theme rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck size={18} className="text-emerald-500" />
                        <h3 className="text-sm font-black text-primary">Data Privacy & Trust</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <TrustIndicator icon={Database} label="Storage" value="Local Device" color="text-indigo-600" />
                        <TrustIndicator icon={WifiOff} label="Cloud Sync" value="Disabled" color="text-slate-500" />
                        <TrustIndicator icon={Lock} label="Tracking" value="Zero" color="text-emerald-500" />
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                         <p className="text-[10px] text-secondary leading-tight">Your data never leaves this device unless you manually export it.</p>
                    </div>
                </div>

                {/* SECTION: PERSONALIZATION */}
                <SectionHeader title="Profile" />
                <div className="mx-4 bg-card border border-theme rounded-2xl overflow-hidden mb-4 p-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-indigo-50 text-indigo-500">
                            <User size={24} />
                        </div>
                        <div className="flex-1">
                            <div className="text-xs font-bold text-secondary uppercase mb-1">Your Name</div>
                            <input 
                                placeholder="What should we call you?" 
                                value={localSettings.userName || ''}
                                onChange={(e) => setLocalSettings(s => ({...s, userName: e.target.value}))}
                                className="w-full bg-transparent text-lg font-bold text-primary placeholder:text-slate-300 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* SECTION 1: VISUALS */}
                <SectionHeader title="Look & Feel" />
                <div className="mx-4 bg-card border border-theme rounded-2xl p-4 mb-4">
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {themes.map(t => (
                            <ThemeSwatch 
                                key={t.id} 
                                themeId={t.id} 
                                label={t.label} 
                                isActive={localSettings.theme === t.id} 
                                onClick={() => setLocalSettings(s => ({...s, theme: t.id}))}
                                color1={t.c1}
                                color2={t.c2}
                            />
                        ))}
                    </div>
                    <div className="space-y-1">
                        <SettingItem 
                            label="High Contrast" 
                            rightContent={<Toggle value={localSettings.highContrast} onChange={(v) => setLocalSettings(s => ({...s, highContrast: v}))} />}
                            isLast={false}
                        />
                         <SettingItem 
                            label="Reduced Motion" 
                            rightContent={<Toggle value={localSettings.reducedMotion} onChange={(v) => setLocalSettings(s => ({...s, reducedMotion: v}))} />}
                            isLast={false}
                        />
                         <SettingItem 
                            label="Haptic Feedback" 
                            rightContent={<Toggle value={localSettings.hapticsEnabled} onChange={(v) => setLocalSettings(s => ({...s, hapticsEnabled: v}))} />}
                            isLast={true}
                        />
                    </div>
                </div>

                {/* SECTION 2: INPUTS */}
                <SectionHeader title="Inputs" />
                <div className="mx-4 bg-card border border-theme rounded-2xl overflow-hidden mb-4">
                     <SettingItem 
                        label="Smart Tag Sorting" 
                        subLabel="Prioritize frequent tags automatically"
                        icon={<SortAsc size={18} />}
                        rightContent={<Toggle value={localSettings.sortTagsByUsage} onChange={(v) => setLocalSettings(s => ({...s, sortTagsByUsage: v}))} />}
                    />
                     <SettingItem 
                        label="Manage Tags" 
                        subLabel={`${tagsToRender.length} active tags`}
                        icon={<Tag size={18} />}
                        onClick={() => setActiveSlide('tags')}
                    />
                     <SettingItem 
                        label="Manage Scales" 
                        subLabel={`${allScales.length} scales, ${localSettings.enabledScales.length} enabled`}
                        icon={<Sliders size={18} />}
                        onClick={() => setActiveSlide('scales')}
                        isLast={true}
                    />
                </div>

                {/* SECTION 3: NOTIFICATIONS */}
                <SectionHeader title="Notifications" />
                <div className="mx-4 bg-card border border-theme rounded-2xl overflow-hidden mb-4">
                    <SettingItem 
                        label="Daily Reminders" 
                        icon={<Bell size={18} />}
                        rightContent={<Toggle value={localSettings.reminders.enabled} onChange={handleToggleReminders} />}
                        isLast={!localSettings.reminders.enabled}
                    />
                    
                    {localSettings.reminders.enabled && (
                        <div className="bg-slate-50/50 p-4 border-t border-theme space-y-4">
                            {/* Schedule Logic (Simulated for brevity in this view, same as logic above) */}
                             <div className="flex p-1 bg-slate-200/50 rounded-xl">
                                <button 
                                    onClick={() => setLocalSettings(s => ({...s, reminders: {...s.reminders, scheduleType: ScheduleType.Random}}))}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${localSettings.reminders.scheduleType === ScheduleType.Random ? 'bg-white shadow-sm text-primary' : 'text-secondary'}`}
                                >
                                    Random
                                </button>
                                <button 
                                    onClick={() => setLocalSettings(s => ({...s, reminders: {...s.reminders, scheduleType: ScheduleType.Fixed}}))}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${localSettings.reminders.scheduleType === ScheduleType.Fixed ? 'bg-white shadow-sm text-primary' : 'text-secondary'}`}
                                >
                                    Fixed
                                </button>
                            </div>
                            {/* Days */}
                            <div className="flex justify-between">
                                {['S','M','T','W','T','F','S'].map((day, i) => {
                                    const isActive = localSettings.reminders.days.includes(i);
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => { 
                                                Haptics.light(); 
                                                const newDays = isActive ? localSettings.reminders.days.filter(d => d !== i) : [...localSettings.reminders.days, i].sort();
                                                setLocalSettings(prev => ({ ...prev, reminders: { ...prev.reminders, days: newDays } }));
                                            }}
                                            className={`w-8 h-8 rounded-full text-[10px] font-bold transition-all ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-theme text-secondary'}`}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* SECTION 4: ADVANCED (CLINICAL MODE) */}
                <SectionHeader title="Advanced" />
                <div className="mx-4 bg-card border border-theme rounded-2xl overflow-hidden mb-4">
                    <SettingItem 
                        label="Clinical Framework" 
                        subLabel="VAD, Velocity, EVI & Compliance"
                        icon={<Stethoscope size={18} />}
                        rightContent={<Toggle 
                            value={localSettings.clinicalModeEnabled} 
                            onChange={(v) => {
                                if (v) {
                                    // Turning ON: Must go through Walkthrough to ensure Prep/Consent
                                    setShowClinicalWalkthrough(true);
                                } else {
                                    // Turning OFF: Immediate
                                    setLocalSettings(s => ({...s, clinicalModeEnabled: false}));
                                }
                            }} 
                        />}
                    />
                    <SettingItem 
                        label="Learn about Clinical Mode" 
                        subLabel="Understand the science"
                        icon={<BookOpen size={18} />}
                        onClick={() => setShowClinicalWalkthrough(true)}
                        isLast={true}
                    />
                </div>

                {/* SECTION 5: DATA */}
                <SectionHeader title="Data & System" />
                <div className="mx-4 bg-card border border-theme rounded-2xl overflow-hidden mb-24">
                     <SettingItem 
                        label="Backup Data (JSON)" 
                        icon={<Save size={18} />}
                        onClick={onExportData}
                    />
                     <SettingItem 
                        label="Export as CSV" 
                        icon={<FileSpreadsheet size={18} />}
                        onClick={async () => {
                            try {
                                const csv = await db.exportAsCSV();
                                const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `mood-patterns-export-${new Date().toISOString().slice(0,10)}.csv`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                Haptics.success();
                            } catch(e) { alert("Export failed"); }
                        }}
                    />
                    <SettingItem 
                        label="Restore Backup" 
                        icon={<Upload size={18} />}
                        onClick={() => fileInputRef.current?.click()}
                    />
                    <input type="file" accept=".json" ref={fileInputRef} onChange={(e) => { if(e.target.files?.[0]) onImportData(e.target.files[0]); }} className="hidden" />
                    
                    <SettingItem 
                        label="Replay Tutorial" 
                        icon={<PlayCircle size={18} />}
                        onClick={onReplayOnboarding}
                    />

                    <SettingItem 
                        label="Delete All Data" 
                        icon={<Trash2 size={18} />}
                        destructive
                        onClick={() => requestConfirm("Delete Everything?", "This cannot be undone.", true, onClearData)}
                        isLast={true}
                    />
                </div>
            </div>

            {/* SAVE BAR */}
            <div className="fixed bottom-6 left-0 right-0 px-6 z-30 pointer-events-none">
                <div className="max-w-md mx-auto grid grid-cols-3 gap-3 p-2 bg-white/90 backdrop-blur-2xl border border-white/20 shadow-2xl rounded-2xl pointer-events-auto ring-1 ring-black/5">
                     <button onClick={onDone} className="col-span-1 py-3.5 rounded-xl font-bold text-secondary hover:bg-slate-100 transition-colors">Back</button>
                     <button 
                        onClick={handleSaveAll} 
                        className={`col-span-2 py-3.5 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${saveState === 'saved' ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                    >
                        {saveState === 'saved' ? <><Check size={20} /> Saved!</> : 'Save Changes'}
                     </button>
                </div>
            </div>

            {/* SLIDE OVERS & MODALS (Reused from previous implementations) */}
            <SlideOver isOpen={activeSlide === 'tags'} onClose={() => setActiveSlide(null)} title="Manage Tags" action={<button onClick={handleCreateTag} className="p-2 bg-indigo-100 text-indigo-600 rounded-full"><Plus size={20}/></button>}>
                 <div className="p-4 space-y-3 pb-32">
                    {localSettings.sortTagsByUsage && <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center gap-2 text-indigo-700 text-xs font-bold mb-2"><SortAsc size={16} /> Smart sorting enabled.</div>}
                    {tagsToRender.map((tag, i) => (
                        <div key={tag.id} className="bg-card border border-theme rounded-xl p-3 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                 <div className="flex flex-col gap-1">
                                    <button onClick={() => handleMoveTag(tag.id, -1)} disabled={i===0 || localSettings.sortTagsByUsage} className="text-slate-300 hover:text-indigo-500 disabled:opacity-10"><ArrowUp size={14}/></button>
                                    <button onClick={() => handleMoveTag(tag.id, 1)} disabled={i===tagsToRender.length-1 || localSettings.sortTagsByUsage} className="text-slate-300 hover:text-indigo-500 disabled:opacity-10"><ArrowDown size={14}/></button>
                                </div>
                                <div><span className="text-[10px] font-bold uppercase text-secondary tracking-widest bg-slate-100 px-1.5 py-0.5 rounded">{tag.category}</span><p className="font-bold text-primary">{tag.label}</p></div>
                            </div>
                            {tag.isUserCreated && <div className="flex gap-2"><button onClick={() => handleEditTag(tag)} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg"><Pencil size={16}/></button><button onClick={() => handleDeleteTag(tag.id)} className="p-2 bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg"><Trash2 size={16}/></button></div>}
                        </div>
                    ))}
                 </div>
            </SlideOver>
            
            <SlideOver isOpen={activeSlide === 'scales'} onClose={() => setActiveSlide(null)} title="Manage Scales" action={<button onClick={handleCreateScale} className="p-2 bg-indigo-100 text-indigo-600 rounded-full"><Plus size={20}/></button>}>
                <div className="p-4 space-y-3 pb-32">
                    {allScales.map((scale) => {
                         const isEnabled = localSettings.enabledScales.includes(scale.id);
                         return (
                            <div key={scale.id} className={`bg-card border rounded-xl p-3 flex items-center justify-between shadow-sm transition-opacity ${isEnabled ? 'border-theme opacity-100' : 'border-dashed border-slate-200 opacity-60'}`}>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => handleToggleScale(scale.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${isEnabled ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>{isEnabled && <Check size={14} className="text-white" strokeWidth={3} />}</button>
                                    <div><p className="font-bold text-primary">{scale.label}</p><p className="text-xs text-secondary">{scale.minLabel} - {scale.maxLabel}</p></div>
                                </div>
                                {scale.isUserCreated && <div className="flex gap-2"><button onClick={() => handleEditScale(scale)} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg"><Pencil size={16}/></button><button onClick={() => handleDeleteScale(scale.id)} className="p-2 bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg"><Trash2 size={16}/></button></div>}
                            </div>
                         );
                    })}
                </div>
            </SlideOver>

             {(tagFormState.isOpen || scaleFormState.isOpen) && (
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-fade-in-up">
                        {tagFormState.isOpen ? (
                            <div className="space-y-4">
                                <h3 className="font-black text-xl text-primary">{tagFormState.tag ? 'Edit Tag' : 'New Tag'}</h3>
                                {tagFormState.error && <p className="text-xs text-rose-600 font-bold">{tagFormState.error}</p>}
                                <input autoFocus placeholder="Tag Name" value={tagFormState.label} onChange={e => setTagFormState(p => ({...p, label: e.target.value}))} className="w-full p-4 bg-slate-50 border border-theme rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                                <div className="flex flex-wrap gap-2">{['people', 'place', 'activity', 'sleep', 'weather'].map(c => <button key={c} onClick={() => setTagFormState(p => ({...p, category: c as any}))} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize border ${tagFormState.category === c ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-400 border-slate-200'}`}>{c}</button>)}</div>
                                <div className="flex gap-2 pt-2"><button onClick={() => setTagFormState({isOpen:false, label:'', category:'activity'})} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-secondary">Cancel</button><button onClick={handleSaveTag} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Save</button></div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <h3 className="font-black text-xl text-primary">{scaleFormState.scale ? 'Edit Scale' : 'New Scale'}</h3>
                                {scaleFormState.error && <p className="text-xs text-rose-600 font-bold">{scaleFormState.error}</p>}
                                <input placeholder="Scale Name" value={scaleFormState.label} onChange={e => setScaleFormState(p => ({...p, label: e.target.value}))} className="w-full p-3 bg-slate-50 border border-theme rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                                <div className="grid grid-cols-2 gap-3"><input placeholder="Min Label" value={scaleFormState.minLabel} onChange={e => setScaleFormState(p => ({...p, minLabel: e.target.value}))} className="p-3 bg-slate-50 border border-theme rounded-xl font-bold outline-none text-sm" /><input placeholder="Max Label" value={scaleFormState.maxLabel} onChange={e => setScaleFormState(p => ({...p, maxLabel: e.target.value}))} className="p-3 bg-slate-50 border border-theme rounded-xl font-bold outline-none text-sm" /></div>
                                <div className="flex gap-2 pt-2"><button onClick={() => setScaleFormState(p => ({...p, isOpen:false}))} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-secondary">Cancel</button><button onClick={handleSaveScale} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Save</button></div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default SettingsScreen;
