
import React, { useState, useRef, useEffect } from 'react';
import { Smile, PieChart as PieIcon, Wind, BarChart2, ShieldCheck } from 'lucide-react';

interface Props {
    onComplete: () => void;
}

const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    
    // Performance Optimization: Use Ref for drag updates to avoid React render cycle on every touchmove
    const trackRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number>(0);
    const currentTouchX = useRef<number>(0);
    
    const slides = [
        {
            title: "Private & Offline",
            desc: "No account required. Your data stays on this device, secure and private by default.",
            icon: <ShieldCheck size={64} className="text-emerald-500" />
        },
        {
            title: "Welcome to Mood Patterns",
            desc: "Track your emotions with granularity and uncover hidden patterns in your life.",
            icon: <Smile size={64} className="text-accent" />
        },
        {
            title: "The Wheel of Feels",
            desc: "Don't just say 'Good' or 'Bad'. Drill down to find the precise word for how you feel.",
            icon: <PieIcon size={64} className="text-accent" />
        },
        {
            title: "Context Matters",
            desc: "Tag your check-ins with what you were doing, who you were with, and where you were.",
            icon: <Wind size={64} className="text-accent" />
        },
        {
            title: "Unlock Insights",
            desc: "After 10 check-ins or 7 days of tracking, we'll start showing you trends and emotional fingerprints.",
            icon: <BarChart2 size={64} className="text-accent" />
        }
    ];

    // Touch Handlers for Swiper
    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        touchStartX.current = e.touches[0].clientX;
        currentTouchX.current = e.touches[0].clientX;
        
        // Remove transition during drag for 1:1 movement
        if (trackRef.current) {
            trackRef.current.style.transition = 'none';
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        currentTouchX.current = e.touches[0].clientX;
        const diff = currentTouchX.current - touchStartX.current;
        
        // Direct DOM manipulation for 60fps performance
        if (trackRef.current) {
            trackRef.current.style.transform = `translateX(calc(-${step * 100}% + ${diff}px))`;
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        const diff = currentTouchX.current - touchStartX.current;
        const threshold = 50; // min px to swipe

        let nextStep = step;
        if (diff < -threshold && step < slides.length - 1) {
            nextStep = step + 1;
        } else if (diff > threshold && step > 0) {
            nextStep = step - 1;
        }

        setStep(nextStep);
        
        // Restore transition and let React state take over via style prop
        // We clear the manual override so the React style prop works
        if (trackRef.current) {
            trackRef.current.style.transition = '';
            trackRef.current.style.transform = '';
        }
    };

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden select-none">
            {/* Swiper Container */}
            <div 
                className="flex-1 relative flex items-center w-full"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: 'pan-y' }} // Allow vertical scroll but capture horizontal
            >
                <div 
                    ref={trackRef}
                    className="flex w-full h-full items-center will-change-transform"
                    style={{ 
                        transform: `translateX(-${step * 100}%)`,
                        transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' 
                    }}
                >
                    {slides.map((slide, index) => (
                        <div key={index} className="w-full h-full flex-shrink-0 flex flex-col items-center justify-center p-8 text-center space-y-8 select-none">
                             <div className="p-8 bg-slate-50 rounded-full shadow-sm mb-4">
                                {slide.icon}
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900">{slide.title}</h1>
                            <p className="text-slate-500 max-w-xs text-lg leading-relaxed">{slide.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Controls */}
            <div className="w-full flex flex-col items-center justify-end pb-12 px-8 space-y-8 bg-white/90 backdrop-blur-sm">
                <div className="flex justify-center gap-2">
                    {slides.map((_, i) => (
                        <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200'}`}></div>
                    ))}
                </div>
                
                <button 
                    onClick={() => {
                        if (step < slides.length - 1) setStep(step + 1);
                        else onComplete();
                    }}
                    className="w-full max-w-xs bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
                >
                    {step === slides.length - 1 ? "Get Started" : "Next"}
                </button>
                
                <div className="h-4">
                {step < slides.length - 1 && (
                    <button onClick={onComplete} className="text-slate-400 font-bold text-sm hover:text-slate-600">Skip</button>
                )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingScreen;
