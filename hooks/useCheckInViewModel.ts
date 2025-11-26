
import { useState, useEffect, useCallback } from 'react';
import { CheckIn, InputMode, FeelingNode, CheckInEmotionPath } from '../types';
import { FEELING_NODES, getEmotionPath } from '../constants';
import { db } from '../services/db';
import { Haptics } from '../utils/haptics';
import { v4 as uuidv4 } from 'uuid';
import { useAdaptiveConfig } from './useAdaptiveConfig';

const DRAFT_KEY = 'checkin_draft';

export interface CheckInFormState {
    selectedNodeIds: string[];
    primaryNodeId: string | null;
    note: string;
    selectedTags: string[];
    intensity: number | null;
    scaleValues: Record<string, number>;
    customTimestamp: string;
}

interface UseCheckInViewModelProps {
    initialCheckIn?: CheckIn;
    enabledScales: string[];
    onComplete: () => void;
    onCancel: () => void;
    defaultInputMode: InputMode;
}

export const useCheckInViewModel = ({ 
    initialCheckIn, 
    enabledScales, 
    onComplete, 
    onCancel,
    defaultInputMode
}: UseCheckInViewModelProps) => {
    // UI State
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [viewMode, setViewMode] = useState<InputMode>(defaultInputMode);
    const [wheelHistory, setWheelHistory] = useState<FeelingNode[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    
    // Graceful Failure State
    const [saveError, setSaveError] = useState<string | null>(null);
    
    // Voice Input State
    const [isListening, setIsListening] = useState(false);
    const [hasSpeechSupport, setHasSpeechSupport] = useState(false);

    // Adaptive Config
    const { isLowEndDevice } = useAdaptiveConfig();

    // Data State (History for Undo/Redo capability in future)
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

    // --- INITIALIZATION ---
    useEffect(() => {
        // check speech support
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            setHasSpeechSupport(true);
        }

        let initialState: CheckInFormState = {
            selectedNodeIds: [],
            primaryNodeId: null,
            note: '',
            selectedTags: [],
            intensity: null,
            scaleValues: {},
            customTimestamp: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        };

        // Check for existing draft first
        const draftJson = localStorage.getItem(DRAFT_KEY);
        let draftObj = null;
        if (draftJson) {
            try { draftObj = JSON.parse(draftJson); } catch (e) {}
        }

        if (initialCheckIn) {
            // EDIT MODE
            // Prioritize draft if it matches this specific check-in ID (user was editing this exact entry before failure)
            if (draftObj && draftObj.editingId === initialCheckIn.id) {
                 initialState = { ...initialState, ...draftObj };
            } else {
                 // Otherwise load fresh from DB
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
            }
        } else {
            // NEW ENTRY MODE
            // Load draft if it exists and is also a new entry (no editingId)
            if (draftObj && !draftObj.editingId) {
                initialState = { ...initialState, ...draftObj };
            }
        }
        
        // Initialize Scales (values are stored in form state, this just ensures we know what's available if needed)
        // Note: enabledScales prop handles the UI filtering.
        
        setHistory({ past: [], present: initialState, future: [] });
    }, [initialCheckIn]);

    // --- PERSISTENCE (Drafts) ---
    useEffect(() => {
        // Automatically save draft on every state change
        if (present.selectedNodeIds.length > 0) {
            const draft = { editingId: initialCheckIn?.id, ...present, timestamp: Date.now() };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        }
    }, [present, initialCheckIn]);

    const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

    // --- STATE UPDATES ---
    const updateState = useCallback((updates: Partial<CheckInFormState>, replace = false) => {
        // Clear error when user makes changes (assuming they are fixing the issue or retrying)
        setSaveError(null);
        
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

    // --- ACTIONS ---

    const transitionToStep = (newStep: 1 | 2 | 3) => {
        if (document.startViewTransition && !isLowEndDevice) {
            document.startViewTransition(() => setStep(newStep));
        } else {
            setStep(newStep);
        }
    };

    const handleToggleNode = (nodeId: string) => {
       const prevIds = present.selectedNodeIds;
       const exists = prevIds.includes(nodeId);
       let newSelection = exists ? prevIds.filter(id => id !== nodeId) : [...prevIds, nodeId];
       let newPrimary = present.primaryNodeId;
       
       // Smart primary selection logic
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
        const parentPath = path.slice(0, -1);
        setWheelHistory(parentPath);
        setViewMode('WHEEL');
    };

    const handleSave = async () => {
        if (present.selectedNodeIds.length === 0 || !present.primaryNodeId || isSaving) return;
        
        setIsSaving(true);
        setSaveError(null);
        Haptics.success();
    
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
    
        try {
            await db.saveCheckIn(checkInToSave);
            clearDraft();
            setTimeout(() => {
                onComplete();
            }, 400);
        } catch (e) {
            setIsSaving(false);
            console.error("Save failed", e);
            // GRACEFUL FAILURE: Set error state to UI, do not alert(), do not clear draft.
            // Provide specific actionable context.
            setSaveError("We couldn't save your entry. Storage might be full or unavailable.");
            Haptics.error();
        }
    };

    const toggleListening = () => {
        if (isListening) {
            setIsListening(false);
        } else {
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                alert("Voice input is not supported in this browser.");
                return;
            }
            
            Haptics.medium();
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            
            recognition.onstart = () => setIsListening(true);
            
            recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                if (text) {
                    const newNote = present.note ? `${present.note} ${text}` : text;
                    updateState({ note: newNote }, true);
                }
            };
            
            recognition.onend = () => {
                setIsListening(false);
                Haptics.light();
            };
            
            recognition.onerror = () => setIsListening(false);
            recognition.start();
        }
    };

    // Standard cancel: Clears draft
    const handleCancel = () => {
        clearDraft();
        onCancel();
    };

    // Graceful Failure Exit: Leaves draft in localStorage
    const handleKeepDraft = () => {
        // Draft is already persisted via the useEffect hook on every change.
        // We just exit the screen WITHOUT calling clearDraft().
        // This ensures the data is waiting for the user when they return.
        onCancel();
    };

    return {
        // State
        step,
        viewMode,
        wheelHistory,
        isSaving,
        saveError,
        isListening,
        hasSpeechSupport,
        presentState: present,
        
        // Setters
        setStep: transitionToStep,
        setViewMode,
        setWheelHistory,
        updateState,
        
        // Actions
        handleToggleNode,
        handleSetPrimary,
        handleNavigateWheel,
        handleSave,
        toggleListening,
        handleCancel,
        handleKeepDraft
    };
};
