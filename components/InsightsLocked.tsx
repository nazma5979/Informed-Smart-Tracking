import React from 'react';
import { LockKeyhole, Plus } from 'lucide-react';

interface InsightsLockedProps {
    count: number;
    days: number;
    onCheckIn: () => void;
    unlockCountThreshold: number;
    unlockDaysThreshold: number;
}

const InsightsLocked: React.FC<InsightsLockedProps> = ({ count, days, onCheckIn, unlockCountThreshold, unlockDaysThreshold }) => {
    const countProgress = Math.min(100, (count / unlockCountThreshold) * 100);
    const daysProgress = Math.min(100, (days / unlockDaysThreshold) * 100);

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6 animate-fade-in">
            <div className="relative">
                <div className="w-24 h-24 bg-card border border-theme rounded-full flex items-center justify-center shadow-sm z-10 relative">
                    <LockKeyhole size={40} className="text-secondary" />
                </div>
                <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl transform scale-110"></div>
            </div>
            
            <div>
                <h2 className="text-xl font-bold text-primary mb-2">Insights are Locked</h2>
                <p className="text-secondary text-sm max-w-xs mx-auto">
                    Keep tracking to unlock patterns. Reach either goal:
                </p>
            </div>

            <div className="w-full max-w-xs space-y-4 bg-card border border-theme p-4 rounded-2xl">
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase text-secondary">
                        <span>Entries</span>
                        <span>{count} / {unlockCountThreshold}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-accent transition-all duration-1000 ease-out" 
                            style={{ width: `${countProgress}%` }}
                        ></div>
                    </div>
                </div>
                
                <div className="flex items-center justify-center text-[10px] text-secondary font-bold uppercase tracking-widest opacity-50">
                    — OR —
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase text-secondary">
                        <span>Days Active</span>
                        <span>{days} / {unlockDaysThreshold}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-purple-400 transition-all duration-1000 ease-out" 
                            style={{ width: `${daysProgress}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            <button 
                onClick={onCheckIn}
                className="bg-accent text-accent-fg px-8 py-3 rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
                <Plus size={18} />
                Log Mood
            </button>
        </div>
    );
};

export default InsightsLocked;