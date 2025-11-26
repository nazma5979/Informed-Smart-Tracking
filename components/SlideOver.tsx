import React, { useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';

interface SlideOverProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}

const SlideOver: React.FC<SlideOverProps> = ({ isOpen, onClose, title, children, action }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            document.body.style.overflow = '';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-app">
            {/* Header */}
            <div className="flex-none bg-white/80 backdrop-blur-md border-b border-theme px-4 py-3 flex items-center justify-between z-10 pt-safe safe-area-top">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onClose}
                        className="p-2 -ml-2 rounded-full text-secondary hover:bg-slate-100 transition-colors active:bg-slate-200"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-lg font-bold text-primary tracking-tight">{title}</h2>
                </div>
                {action && <div>{action}</div>}
            </div>

            {/* Content */}
            <div 
                className={`flex-1 overflow-y-auto overflow-x-hidden bg-app pb-safe transition-transform duration-300 ease-out will-change-transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {children}
            </div>
        </div>
    );
};

export default SlideOver;