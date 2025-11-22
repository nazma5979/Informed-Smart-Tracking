import React from 'react';
import { Fingerprint, Coffee, Zap, Moon, Sun, Monitor, Wind, Activity } from 'lucide-react';

export const ICON_MAP: Record<string, React.ReactNode> = {
    'people': <Fingerprint size={14} />, 
    'place': <Coffee size={14} />,
    'activity': <Zap size={14} />,
    'sleep': <Moon size={14} />,
    'weather': <Sun size={14} />,
    // Specifics
    'family': <div className="font-bold text-xs">Fam</div>,
    'friends': <div className="font-bold text-xs">Fri</div>,
    'partner': <div className="font-bold text-xs">❤️</div>,
    'work': <Monitor size={14} />,
    'home': <Coffee size={14} />,
    'nature': <Wind size={14} />,
    'exercise': <Activity size={14} />,
    'sunny': <Sun size={14} />,
    'rainy': <Wind size={14} />,
};