import React, { useState } from 'react';
import { Smile, PieChart as PieIcon, Wind, BarChart2 } from 'lucide-react';

interface Props {
    onComplete: () => void;
}

const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    
    const slides = [
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

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                <div className="p-8 bg-slate-50 rounded-full shadow-sm mb-4 animate-bounce-slow">
                    {slides[step].icon}
                </div>
                <h1 className="text-3xl font-bold text-slate-900">{slides[step].title}</h1>
                <p className="text-slate-500 max-w-xs text-lg leading-relaxed">{slides[step].desc}</p>
            </div>
            
            <div className="w-full max-w-xs space-y-6 mb-8">
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
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
                >
                    {step === slides.length - 1 ? "Get Started" : "Next"}
                </button>
                
                {step < slides.length - 1 && (
                    <button onClick={onComplete} className="text-slate-400 font-bold text-sm hover:text-slate-600">Skip</button>
                )}
            </div>
        </div>
    );
};

export default OnboardingScreen;