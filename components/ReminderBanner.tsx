
import React from 'react';
import { Bell, X } from 'lucide-react';

interface ReminderBannerProps {
    onCheckIn: () => void;
    onDismiss: () => void;
    title?: string;
    message?: string;
}

const ReminderBanner: React.FC<ReminderBannerProps> = ({ 
    onCheckIn, 
    onDismiss, 
    title = "Time to check in", 
    message = "How are you feeling right now?" 
}) => (
    <div 
        role="alert"
        className="fixed top-4 left-4 right-4 z-50 bg-white/95 backdrop-blur-md border border-indigo-100 p-4 rounded-2xl shadow-xl animate-fade-in-up flex items-center justify-between gap-4"
    >
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shrink-0">
                <Bell size={20} />
            </div>
            <div>
                <p className="font-bold text-slate-800 text-sm">{title}</p>
                <p className="text-xs text-slate-500">{message}</p>
            </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
            <button 
                onClick={onDismiss} 
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" 
                aria-label="Dismiss"
            >
                <X size={18} />
            </button>
            <button 
                onClick={onCheckIn} 
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 hover:bg-indigo-700 transition-colors"
            >
                Check In
            </button>
        </div>
    </div>
);

export default ReminderBanner;
