
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppSettings, ReminderConfig, Theme, ContextTag, Scale, ScheduleType, FixedTime } from '../types';
import { Bell, ChevronRight, Palette, Shield, PlayCircle, Trash2, X, Trophy, Plus, Tag, Pencil, ArrowUp, ArrowDown, Download, Check, Share, Eye, Moon, AlertCircle, Clock, Sliders, Calendar, Upload, FileJson, Save } from 'lucide-react';
import { DEFAULT_SCALES, DEFAULT_TAGS } from '../constants';
import { Haptics } from '../utils/haptics';
import ConfirmDialog from '../components/ConfirmDialog';
import { v4 as uuidv4 } from 'uuid';

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

const Card: React.FC<{ children: React.ReactNode, title?: string, className?: string }> = ({ children, title, className = '' }) => (
    <div className={`bg-card border border-theme rounded-3xl overflow-hidden shadow-sm mb-8 ${className}`}>
        {title && (
            <div className="bg-slate-50/50 border-b border-theme px-6 py-4">
                <h3 className="text-xs font-extrabold uppercase text-secondary tracking-widest">{title}</h3>
            </div>
        )}
        <div className="p-6">{children}</div>
    </div>
);

const ToggleRow: React.FC<{ label: string, subLabel?: string, icon?: React.ReactNode, value: boolean, onChange: (v: boolean) => void }> = ({ label, subLabel, icon, value, onChange }) => (
    <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
        <div className="flex items-center gap-4">
            {icon && <div className="text-secondary bg-slate-50 p-2 rounded-xl">{icon}</div>}
            <div>
                <div className="font-bold text-primary text-base">{label}</div>
                {subLabel && <div className="text-xs text-secondary font-medium leading-snug max-w-[220px] mt-0.5">{subLabel}</div>}
            </div>
        </div>
        <button 
            onClick={() => { Haptics.light(); onChange(!value); }}
            className={`w-14 h-8 rounded-full p-1 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-accent/20 ${value ? 'bg-accent' : 'bg-slate-200'}`}
            aria-pressed={value}
        >
            <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${value ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </button>
    </div>
);
  
const ThemeSwatch: React.FC<{ themeId: Theme, label: string, isActive: boolean, onClick: () => void, color1: string, color2: string }> = ({ themeId, label, isActive, onClick, color1, color2 }) => (
    <button 
        onClick={() => { Haptics.light(); onClick(); }}
        className={`relative rounded-2xl p-1.5 transition-all flex flex-col items-center gap-2 group ${isActive ? 'ring-2 ring-accent ring-offset-2 bg-accent/5' : 'hover:bg-slate-50'}`}
    >
        <div className="w-full aspect-square rounded-xl shadow-sm flex overflow-hidden border border-theme group-hover:shadow-md transition-shadow">
            <div className="flex-1 h-full" style={{ backgroundColor: color1 }}></div>
            <div className="flex-1 h-full" style={{ backgroundColor: color2 }}></div>
        </div>
        <span className={`text-xs font-bold ${isActive ? 'text-accent' : 'text-secondary'}`}>{label}</span>
        {isActive && <div className="absolute top-0 right-0 bg-accent text-white rounded-full p-1 shadow-sm translate-x-1/4 -translate-y-1/4"><Check size={10} strokeWidth={4}/></div>}
    </button>
);

const SettingsScreen: React.FC<SettingsScreenProps> = ({ settings, onSaveSettings, onClearData, onReplayOnboarding, onDeleteCustomTag, onUpdateCustomTag, customTags, availableTags = [], onDone, installPromptEvent, onInstallApp, onExportData, onImportData }) => {
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
    const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
    const [isIOS, setIsIOS] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Modals
    const [activeModal, setActiveModal] = useState<'tags' | 'scales' | null>(null);
    
    // Confirmation State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        isDestructive: boolean;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', isDestructive: false, onConfirm: () => {} });

    // Temp State for Fixed Time Input
    const [newFixedTime, setNewFixedTime] = useState<string>('09:00');

    useEffect(() => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    }, []);
    
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
        { id: 'original', label: 'Original', c1: '#f8fafc', c2: '#4f46e5' },
        { id: 'light', label: 'Light', c1: '#fbfbfb', c2: '#f58846' },
        { id: 'dark', label: 'Dark', c1: '#111111', c2: '#277da1' },
        { id: 'sepia', label: 'Sepia', c1: '#f8f1e3', c2: '#d6625c' },
        { id: 'grey', label: 'Grey', c1: '#5a5a5c', c2: '#8ba7c4' },
        { id: 'pastel', label: 'Pastel', c1: '#e8e6ea', c2: '#90f1ef' },
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

    // Combine default and custom scales
    const allScales = useMemo(() => {
        return [...DEFAULT_SCALES, ...localSettings.customScales];
    }, [localSettings.customScales]);

    const handleSaveAll = async () => {
        Haptics.success();
        await onSaveSettings(localSettings);
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
    }

    // --- CONFIRMATION HELPER ---
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

    // --- TAG LOGIC ---
    const handleEditTag = (tag: ContextTag) => {
        setTagFormState({ isOpen: true, tag, label: tag.label, category: tag.category });
    }

    const handleCreateTag = () => {
        setTagFormState({ isOpen: true, tag: undefined, label: '', category: 'activity' });
    }

    const handleSaveTag = async () => {
        const trimmed = tagFormState.label.trim();
        if (!trimmed) return;

        const isDuplicate = tagsToRender.some(t => 
            (tagFormState.tag ? t.id !== tagFormState.tag.id : true) && 
            t.label.toLowerCase() === trimmed.toLowerCase()
        );

        if (isDuplicate) {
            setTagFormState(prev => ({ ...prev, error: "Tag already exists." }));
            Haptics.error();
            return;
        }

        const updatedTag: ContextTag = {
            id: tagFormState.tag ? tagFormState.tag.id : uuidv4(),
            label: trimmed,
            category: tagFormState.category,
            isUserCreated: true
        };

        await onUpdateCustomTag(updatedTag);
        
        if (!tagFormState.tag) {
             setLocalSettings(prev => ({
                 ...prev,
                 tagOrder: prev.tagOrder ? [...prev.tagOrder, updatedTag.id] : undefined
             }));
        }

        setTagFormState({ isOpen: false, label: '', category: 'activity' });
        Haptics.success();
    }

    const handleDeleteTag = async (tagId: string) => {
        requestConfirm(
            "Delete Tag?", 
            "This tag will be permanently removed from your list.", 
            true, 
            async () => {
                await onDeleteCustomTag(tagId);
                setLocalSettings(prev => ({
                    ...prev,
                    tagOrder: prev.tagOrder ? prev.tagOrder.filter(id => id !== tagId) : []
                }));
                Haptics.medium();
            }
        );
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

    // --- SCALE LOGIC ---
    const handleToggleScale = (id: string) => {
        setLocalSettings(prev => {
            const exists = prev.enabledScales.includes(id);
            return {
                ...prev,
                enabledScales: exists 
                    ? prev.enabledScales.filter(sid => sid !== id) 
                    : [...prev.enabledScales, id]
            };
        });
    }

    const handleEditScale = (scale: Scale) => {
        setScaleFormState({
            isOpen: true,
            scale,
            label: scale.label,
            minLabel: scale.minLabel,
            maxLabel: scale.maxLabel,
            min: scale.min,
            max: scale.max
        });
    }

    const handleCreateScale = () => {
        setScaleFormState({
            isOpen: true,
            scale: undefined,
            label: '',
            minLabel: 'Low',
            maxLabel: 'High',
            min: 1,
            max: 5
        });
    }

    const handleSaveScale = () => {
        const label = scaleFormState.label.trim();
        if (!label) {
            setScaleFormState(prev => ({ ...prev, error: "Label is required" }));
            return;
        }
        if (scaleFormState.min >= scaleFormState.max) {
            setScaleFormState(prev => ({ ...prev, error: "Min must be less than Max" }));
            return;
        }

        const newScale: Scale = {
            id: scaleFormState.scale ? scaleFormState.scale.id : uuidv4(),
            label,
            minLabel: scaleFormState.minLabel,
            maxLabel: scaleFormState.maxLabel,
            min: scaleFormState.min,
            max: scaleFormState.max,
            step: 1,
            defaultValue: Math.floor((scaleFormState.max + scaleFormState.min) / 2),
            isUserCreated: true
        };

        setLocalSettings(prev => {
            const isEdit = !!scaleFormState.scale;
            const newCustomScales = isEdit 
                ? prev.customScales.map(s => s.id === newScale.id ? newScale : s)
                : [...prev.customScales, newScale];
            
            const newEnabled = isEdit ? prev.enabledScales : [...prev.enabledScales, newScale.id];

            return {
                ...prev,
                customScales: newCustomScales,
                enabledScales: newEnabled
            };
        });

        setScaleFormState(prev => ({ ...prev, isOpen: false }));
        Haptics.success();
    }

    const handleDeleteScale = (id: string) => {
        requestConfirm(
            "Delete Scale?",
            "History will be preserved, but you won't be able to log new values for this scale.",
            true,
            () => {
                setLocalSettings(prev => ({
                    ...prev,
                    customScales: prev.customScales.filter(s => s.id !== id),
                    enabledScales: prev.enabledScales.filter(s => s !== id)
                }));
                Haptics.medium();
            }
        );
    }

    // --- REMINDER LOGIC ---
    const handleToggleReminders = async (enabled: boolean) => {
        if (enabled) {
            if (Notification.permission === 'default') {
                const result = await Notification.requestPermission();
                if (result !== 'granted') {
                    requestConfirm("Permission Required", "Please enable notifications in your browser settings to receive reminders.", false, () => {});
                    return;
                }
            } else if (Notification.permission === 'denied') {
                requestConfirm("Permission Blocked", "Notifications are blocked. Please check your browser settings.", false, () => {});
                return;
            }
        }
        setLocalSettings(prev => ({ ...prev, reminders: { ...prev.reminders, enabled } }));
    };

    const handleToggleDay = (dayIndex: number) => {
        setLocalSettings(prev => {
            const currentDays = prev.reminders.days;
            const newDays = currentDays.includes(dayIndex) 
                ? currentDays.filter(d => d !== dayIndex) 
                : [...currentDays, dayIndex].sort();
            return { ...prev, reminders: { ...prev.reminders, days: newDays } };
        });
    };

    const handleAddFixedTime = () => {
        const [h, m] = newFixedTime.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return;
        
        const newTime: FixedTime = {
            id: uuidv4(),
            hour: h,
            minute: m,
            enabled: true
        };
        
        setLocalSettings(prev => ({
            ...prev,
            reminders: {
                ...prev.reminders,
                fixedTimes: [...prev.reminders.fixedTimes, newTime].sort((a,b) => (a.hour*60+a.minute) - (b.hour*60+b.minute))
            }
        }));
        Haptics.success();
    };

    const handleRemoveFixedTime = (id: string) => {
        setLocalSettings(prev => ({
            ...prev,
            reminders: {
                ...prev.reminders,
                fixedTimes: prev.reminders.fixedTimes.filter(ft => ft.id !== id)
            }
        }));
        Haptics.error();
    };
    
    // --- FILE IMPORT ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onImportData(e.target.files[0]);
        }
        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="p-6 pb-32 space-y-8 max-w-md mx-auto animate-fade-in">
            
            <ConfirmDialog 
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                isDestructive={confirmConfig.isDestructive}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({...prev, isOpen: false}))}
            />

            {/* SECTION 1: APPEARANCE */}
            <Card title="Appearance">
                <div className="grid grid-cols-3 gap-4 mb-8">
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
                <div className="space-y-2 border-t border-theme pt-4">
                    <ToggleRow 
                        label="High Contrast" 
                        icon={<Eye size={20} />}
                        value={localSettings.highContrast} 
                        onChange={(v) => setLocalSettings(s => ({...s, highContrast: v}))} 
                    />
                    <ToggleRow 
                        label="Reduced Motion" 
                        subLabel="Simplify animations"
                        icon={<Clock size={20} />}
                        value={localSettings.reducedMotion} 
                        onChange={(v) => setLocalSettings(s => ({...s, reducedMotion: v}))} 
                    />
                </div>
            </Card>

            {/* SECTION 2: ROUTINE */}
            <Card title="Gentle Nudges">
                <ToggleRow 
                    label="Daily Check-in" 
                    subLabel="Get reminders to log your mood"
                    icon={<Bell size={20} />}
                    value={localSettings.reminders.enabled} 
                    onChange={handleToggleReminders} 
                />
                
                {localSettings.reminders.enabled && (
                    <div className="mt-6 pl-4 border-l-2 border-theme space-y-6 animate-fade-in">
                        {/* Active Days */}
                        <div>
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2 block">Active Days</label>
                            <div className="flex justify-between gap-1">
                                {['S','M','T','W','T','F','S'].map((day, i) => {
                                    const isActive = localSettings.reminders.days.includes(i);
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => { Haptics.light(); handleToggleDay(i); }}
                                            className={`w-9 h-9 rounded-full text-xs font-bold transition-all ${
                                                isActive 
                                                ? 'bg-accent text-white shadow-md' 
                                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                            }`}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-slate-100 p-1 rounded-xl flex">
                             <button 
                                onClick={() => setLocalSettings(s => ({...s, reminders: {...s.reminders, scheduleType: ScheduleType.Random}}))}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${localSettings.reminders.scheduleType === ScheduleType.Random ? 'bg-white shadow text-primary' : 'text-secondary hover:text-primary'}`}
                             >
                                Random
                             </button>
                             <button 
                                onClick={() => setLocalSettings(s => ({...s, reminders: {...s.reminders, scheduleType: ScheduleType.Fixed}}))}
                                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${localSettings.reminders.scheduleType === ScheduleType.Fixed ? 'bg-white shadow text-primary' : 'text-secondary hover:text-primary'}`}
                             >
                                Fixed Time
                             </button>
                        </div>
                        
                        {localSettings.reminders.scheduleType === ScheduleType.Random ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Active Hours</label>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="relative flex-1">
                                            <select 
                                                className="w-full bg-white border border-theme rounded-xl p-3 text-sm font-bold appearance-none"
                                                value={localSettings.reminders.windowStartHour}
                                                onChange={(e) => setLocalSettings(s => ({...s, reminders: {...s.reminders, windowStartHour: parseInt(e.target.value)}}))}
                                            >
                                                {[...Array(24).keys()].map(h => <option key={h} value={h}>{h}:00</option>)}
                                            </select>
                                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary rotate-90 pointer-events-none" size={14} />
                                        </div>
                                        <span className="text-secondary font-bold text-lg">to</span>
                                        <div className="relative flex-1">
                                            <select 
                                                className="w-full bg-white border border-theme rounded-xl p-3 text-sm font-bold appearance-none"
                                                value={localSettings.reminders.windowEndHour}
                                                onChange={(e) => setLocalSettings(s => ({...s, reminders: {...s.reminders, windowEndHour: parseInt(e.target.value)}}))}
                                            >
                                                {[...Array(24).keys()].map(h => <option key={h} value={h}>{h}:00</option>)}
                                            </select>
                                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary rotate-90 pointer-events-none" size={14} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest flex justify-between">
                                        <span>Frequency</span>
                                        <span>Every {localSettings.reminders.frequencyHours}h</span>
                                    </label>
                                    <input 
                                        type="range" min="1" max="12" 
                                        value={localSettings.reminders.frequencyHours}
                                        onChange={(e) => setLocalSettings(s => ({...s, reminders: {...s.reminders, frequencyHours: parseInt(e.target.value)}}))}
                                        className="w-full accent-accent mt-3 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] text-secondary mt-1 font-medium">
                                        <span>Often</span>
                                        <span>Rarely</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                             <div className="space-y-3">
                                 <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Scheduled Times</label>
                                 {localSettings.reminders.fixedTimes.length === 0 && (
                                     <p className="text-xs text-secondary italic p-2 text-center">No times added yet.</p>
                                 )}
                                 <div className="space-y-2">
                                     {localSettings.reminders.fixedTimes.map(ft => (
                                         <div key={ft.id} className="flex items-center justify-between p-3 bg-white border border-theme rounded-xl shadow-sm">
                                             <div className="flex items-center gap-3">
                                                 <Clock size={16} className="text-accent"/>
                                                 <span className="font-bold text-primary">
                                                     {ft.hour.toString().padStart(2, '0')}:{ft.minute.toString().padStart(2, '0')}
                                                 </span>
                                             </div>
                                             <button onClick={() => handleRemoveFixedTime(ft.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                 <Trash2 size={16} />
                                             </button>
                                         </div>
                                     ))}
                                 </div>
                                 <div className="flex gap-2 pt-2">
                                     <input 
                                        type="time" 
                                        value={newFixedTime} 
                                        onChange={(e) => setNewFixedTime(e.target.value)}
                                        className="flex-1 p-3 bg-slate-50 border border-theme rounded-xl font-bold text-sm outline-none focus:border-accent"
                                     />
                                     <button onClick={handleAddFixedTime} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm shadow-md hover:bg-slate-700 active:scale-95">
                                         Add
                                     </button>
                                 </div>
                             </div>
                        )}
                    </div>
                )}
            </Card>

            {/* SECTION 3: CUSTOMIZATION */}
            <Card title="Personalization">
                <div className="space-y-3">
                    <button 
                        onClick={() => setActiveModal('tags')} 
                        className="w-full py-4 bg-white border border-theme rounded-2xl text-primary text-sm font-bold flex items-center justify-between px-4 hover:bg-slate-50 transition-colors shadow-sm group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl"><Tag size={18} /></div>
                            <span>Manage Tags</span>
                        </div>
                        <div className="flex items-center gap-2 text-secondary">
                            <span className="text-xs">{tagsToRender.length} tags</span>
                            <ChevronRight size={16} />
                        </div>
                    </button>

                    <button 
                        onClick={() => setActiveModal('scales')} 
                        className="w-full py-4 bg-white border border-theme rounded-2xl text-primary text-sm font-bold flex items-center justify-between px-4 hover:bg-slate-50 transition-colors shadow-sm group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-50 text-orange-600 p-2 rounded-xl"><Sliders size={18} /></div>
                            <span>Manage Scales</span>
                        </div>
                        <div className="flex items-center gap-2 text-secondary">
                            <span className="text-xs">{allScales.length} scales</span>
                            <ChevronRight size={16} />
                        </div>
                    </button>
                </div>
            </Card>

            {/* SECTION 4: DATA & SYSTEM */}
            <Card title="Data Management">
                 <div className="space-y-2">
                    <button onClick={onExportData} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group">
                        <div className="flex items-center gap-3">
                            <div className="bg-sky-50 text-sky-600 p-2 rounded-xl group-hover:bg-sky-100 transition-colors"><Save size={18} /></div>
                            <div>
                                <div className="font-bold text-primary text-sm">Backup Data</div>
                                <div className="text-[10px] text-secondary">Download JSON file</div>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-secondary group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group">
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-100 text-slate-600 p-2 rounded-xl group-hover:bg-slate-200 transition-colors"><Upload size={18} /></div>
                            <div>
                                <div className="font-bold text-primary text-sm">Restore Backup</div>
                                <div className="text-[10px] text-secondary">Upload JSON file</div>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-secondary group-hover:translate-x-1 transition-transform" />
                    </button>
                    <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

                    <button onClick={onReplayOnboarding} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl group-hover:bg-indigo-100 transition-colors"><PlayCircle size={18} /></div>
                            <span className="font-bold text-primary text-sm">Replay Tutorial</span>
                        </div>
                        <ChevronRight size={16} className="text-secondary group-hover:translate-x-1 transition-transform" />
                    </button>

                    {installPromptEvent && (
                         <button onClick={onInstallApp} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left group">
                            <div className="flex items-center gap-3">
                                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl group-hover:bg-emerald-100 transition-colors"><Download size={18} /></div>
                                <span className="font-bold text-primary text-sm">Install App</span>
                            </div>
                            <ChevronRight size={16} className="text-secondary group-hover:translate-x-1 transition-transform" />
                        </button>
                    )}
                    
                    <div className="pt-4 border-t border-theme mt-2">
                        <button 
                            onClick={() => requestConfirm("Delete All Data?", "This will permanently wipe your history, settings, and tags. This action cannot be undone.", true, onClearData)}
                            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-rose-50 text-rose-600 font-bold text-sm hover:bg-rose-100 transition-colors"
                        >
                            <Trash2 size={18} />
                            Delete All Data
                        </button>
                    </div>
                 </div>
            </Card>
            
            <div className="text-center text-[10px] text-secondary opacity-50 pb-8">
                v1.0.0 • Offline-first
            </div>

            {/* PERSISTENT SAVE */}
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

            {/* TAG MANAGER MODAL */}
            {activeModal === 'tags' && (
                <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-end sm:items-center justify-center p-4 sm:p-6">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl max-h-[85vh] flex flex-col animate-fade-in-up ring-1 ring-white/20">
                        <div className="p-6 border-b border-theme flex justify-between items-center bg-slate-50/50 rounded-t-[2rem]">
                            <h3 className="font-black text-xl text-primary">Manage Tags</h3>
                            <div className="flex gap-2">
                                <button onClick={handleCreateTag} className="p-2 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 transition-colors"><Plus size={20}/></button>
                                <button onClick={() => setActiveModal(null)} className="p-2 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors"><X size={20}/></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                             {tagsToRender.map((tag, index) => (
                                 <div key={tag.id} className="flex items-center justify-between p-3 bg-white border border-theme rounded-2xl shadow-sm">
                                     <div className="flex items-center gap-3">
                                         <div className="flex flex-col -my-1">
                                            <button 
                                                onClick={() => handleMoveTag(tag.id, -1)}
                                                disabled={index === 0}
                                                className="p-1 text-slate-300 hover:text-accent disabled:opacity-30"
                                            ><ArrowUp size={12} /></button>
                                            <button 
                                                onClick={() => handleMoveTag(tag.id, 1)}
                                                disabled={index === tagsToRender.length - 1}
                                                className="p-1 text-slate-300 hover:text-accent disabled:opacity-30"
                                            ><ArrowDown size={12} /></button>
                                         </div>

                                         <span className="text-[10px] uppercase font-bold text-secondary bg-slate-100 px-2 py-1 rounded-md border border-slate-200 min-w-[60px] text-center tracking-wider">{tag.category}</span>
                                         <span className="font-bold text-primary text-sm">{tag.label}</span>
                                     </div>
                                     {tag.isUserCreated && (
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEditTag(tag)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Pencil size={16}/></button>
                                            <button onClick={() => handleDeleteTag(tag.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                     )}
                                 </div>
                             ))}
                        </div>
                    </div>
                </div>
            )}

            {/* SCALE MANAGER MODAL */}
            {activeModal === 'scales' && (
                <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-end sm:items-center justify-center p-4 sm:p-6">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl max-h-[85vh] flex flex-col animate-fade-in-up ring-1 ring-white/20">
                        <div className="p-6 border-b border-theme flex justify-between items-center bg-slate-50/50 rounded-t-[2rem]">
                            <h3 className="font-black text-xl text-primary">Manage Scales</h3>
                            <div className="flex gap-2">
                                <button onClick={handleCreateScale} className="p-2 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 transition-colors"><Plus size={20}/></button>
                                <button onClick={() => setActiveModal(null)} className="p-2 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors"><X size={20}/></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                             {allScales.map((scale) => {
                                 const isEnabled = localSettings.enabledScales.includes(scale.id);
                                 return (
                                     <div key={scale.id} className={`flex items-center justify-between p-3 border rounded-2xl shadow-sm transition-all ${isEnabled ? 'bg-white border-theme' : 'bg-slate-50 border-transparent opacity-60'}`}>
                                         <div className="flex items-center gap-3 flex-1">
                                             <button onClick={() => handleToggleScale(scale.id)} className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isEnabled ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                                {isEnabled && <Check size={12} className="text-white" strokeWidth={3} />}
                                             </button>
                                             <div className="flex flex-col">
                                                 <span className="font-bold text-primary text-sm">{scale.label}</span>
                                                 <span className="text-[10px] text-secondary">{scale.minLabel} - {scale.maxLabel}</span>
                                             </div>
                                         </div>
                                         {scale.isUserCreated && (
                                            <div className="flex gap-1">
                                                <button onClick={() => handleEditScale(scale)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Pencil size={16}/></button>
                                                <button onClick={() => handleDeleteScale(scale.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                            </div>
                                         )}
                                     </div>
                                 );
                             })}
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT TAG FORM MODAL OVERLAY */}
            {tagFormState.isOpen && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl space-y-6 animate-fade-in ring-1 ring-white/20">
                         <div>
                             <h3 className="font-black text-xl text-primary mb-1">{tagFormState.tag ? 'Edit Tag' : 'New Tag'}</h3>
                             <p className="text-secondary text-sm">{tagFormState.tag ? 'Rename or recategorize your tag.' : 'Create a new tag for your check-ins.'}</p>
                         </div>
                         
                         {tagFormState.error && <div className="bg-rose-50 text-rose-600 text-xs p-3 rounded-xl font-bold flex items-center gap-2"><AlertCircle size={14}/> {tagFormState.error}</div>}
                         
                         <input 
                            autoFocus
                            value={tagFormState.label}
                            onChange={(e) => setTagFormState(prev => ({...prev, label: e.target.value, error: undefined}))}
                            placeholder="e.g. Gaming, Reading..."
                            className="w-full p-4 bg-slate-50 border border-theme rounded-2xl font-bold text-primary outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-lg"
                        />
                        
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-secondary uppercase ml-1">Category</label>
                            <div className="flex flex-wrap gap-2">
                                {['people', 'place', 'activity', 'sleep', 'weather'].map(cat => (
                                    <button 
                                        key={cat} 
                                        onClick={() => setTagFormState(prev => ({...prev, category: cat as any}))}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold capitalize border-2 transition-all ${tagFormState.category === cat ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'border-slate-100 text-slate-400 bg-white hover:border-slate-200'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setTagFormState({isOpen: false, label: '', category: 'activity'})} className="flex-1 py-4 font-bold text-secondary bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={handleSaveTag} className="flex-1 py-4 font-bold text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT SCALE FORM MODAL OVERLAY */}
            {scaleFormState.isOpen && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl space-y-6 animate-fade-in ring-1 ring-white/20 max-h-[90vh] overflow-y-auto">
                         <div>
                             <h3 className="font-black text-xl text-primary mb-1">{scaleFormState.scale ? 'Edit Scale' : 'New Scale'}</h3>
                             <p className="text-secondary text-sm">Define what you want to measure.</p>
                         </div>
                         
                         {scaleFormState.error && <div className="bg-rose-50 text-rose-600 text-xs p-3 rounded-xl font-bold flex items-center gap-2"><AlertCircle size={14}/> {scaleFormState.error}</div>}
                         
                         <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-secondary uppercase ml-1 mb-1 block">Label</label>
                                <input 
                                    value={scaleFormState.label}
                                    onChange={(e) => setScaleFormState(prev => ({...prev, label: e.target.value, error: undefined}))}
                                    placeholder="e.g. Anxiety, Hunger"
                                    className="w-full p-4 bg-slate-50 border border-theme rounded-2xl font-bold text-primary outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase ml-1 mb-1 block">Min Label</label>
                                    <input 
                                        value={scaleFormState.minLabel}
                                        onChange={(e) => setScaleFormState(prev => ({...prev, minLabel: e.target.value}))}
                                        className="w-full p-3 bg-slate-50 border border-theme rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase ml-1 mb-1 block">Max Label</label>
                                    <input 
                                        value={scaleFormState.maxLabel}
                                        onChange={(e) => setScaleFormState(prev => ({...prev, maxLabel: e.target.value}))}
                                        className="w-full p-3 bg-slate-50 border border-theme rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase ml-1 mb-1 block">Min Value</label>
                                    <input 
                                        type="number"
                                        value={scaleFormState.min}
                                        onChange={(e) => setScaleFormState(prev => ({...prev, min: parseInt(e.target.value)}))}
                                        className="w-full p-3 bg-slate-50 border border-theme rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-secondary uppercase ml-1 mb-1 block">Max Value</label>
                                    <input 
                                        type="number"
                                        value={scaleFormState.max}
                                        onChange={(e) => setScaleFormState(prev => ({...prev, max: parseInt(e.target.value)}))}
                                        className="w-full p-3 bg-slate-50 border border-theme rounded-xl font-bold text-sm outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                         </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setScaleFormState(prev => ({...prev, isOpen: false}))} className="flex-1 py-4 font-bold text-secondary bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={handleSaveScale} className="flex-1 py-4 font-bold text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">Save</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SettingsScreen;
