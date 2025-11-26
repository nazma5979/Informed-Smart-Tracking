
import React, { useEffect, useState } from 'react';
import { ScreenName } from '../types';
import { X, LayoutDashboard, BarChart2, Settings, Zap, Home } from 'lucide-react';
import { db } from '../services/db';
import { Haptics } from '../utils/haptics';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentScreen: ScreenName;
    onNavigate: (screen: ScreenName) => void;
    onSeedData: () => void;
}

const SlideOutMenu: React.FC<Props> = ({ isOpen, onClose, currentScreen, onNavigate, onSeedData }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300); // Wait for animation
            document.body.style.overflow = '';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible) return null;

    const handleNav = (screen: ScreenName) => {
        Haptics.light();
        onNavigate(screen);
        onClose();
    };

    const handleSeed = () => {
        Haptics.medium();
        onSeedData();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex">
            {/* Backdrop */}
            <div 
                className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            ></div>

            {/* Slideout Panel */}
            <div 
                className={`relative w-3/4 max-w-xs bg-white h-full shadow-2xl flex flex-col transition-transform duration-300 ease-out will-change-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Mood Patterns</h2>
                        <p className="text-xs text-slate-500 font-medium">Your private tracker</p>
                    </div>
                    <button onClick={onClose} className="p-3 -mr-3 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 active:scale-95 transition-all">
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <button 
                        onClick={() => handleNav('HOME')}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-all ${currentScreen === 'HOME' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Home size={20} />
                        Home
                    </button>

                    <button 
                        onClick={() => handleNav('INSIGHTS')}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-all ${currentScreen === 'INSIGHTS' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <BarChart2 size={20} />
                        Insights
                    </button>

                    <button 
                        onClick={() => handleNav('SETTINGS')}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-all ${currentScreen === 'SETTINGS' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Settings size={20} />
                        Settings
                    </button>

                    <div className="border-t border-slate-100 my-4"></div>

                    <div className="px-4 py-2">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">Developer Tools</p>
                        <button 
                            onClick={handleSeed}
                            className="w-full flex items-center gap-4 p-4 rounded-xl font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-all border border-emerald-100"
                        >
                            <Zap size={20} />
                            Seed 10 Sample Entries
                        </button>
                    </div>
                </nav>

                <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 font-medium">Offline-first • v1.0.0</p>
                </div>
            </div>
        </div>
    );
};

export default SlideOutMenu;
