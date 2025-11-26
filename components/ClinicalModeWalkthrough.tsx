
import React, { useState } from 'react';
import { X, Brain, Activity, TrendingUp, Stethoscope, ChevronRight, Check, ShieldCheck, Zap, BookOpen, Sparkles } from 'lucide-react';

interface Props {
  onClose: () => void;
  onEnable: () => void;
}

type ExplanationMode = 'scientific' | 'curious';

const ClinicalModeWalkthrough: React.FC<Props> = ({ onClose, onEnable }) => {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<ExplanationMode>('scientific');

  const slides = [
    {
      // SLIDE 1: INTRO
      scientific: {
        title: "Predictive Affective Computing",
        desc: "This framework utilizes longitudinal VAD analysis to transition from descriptive statistics (what happened) to predictive modeling (what might happen). It leverages the physics of emotion to forecast state changes."
      },
      curious: {
        title: "Forecasting Your Mood",
        desc: "Most diaries just look back. We use your history to anticipate what's coming. It's about identifying the patterns that shape your day so you can navigate them better."
      },
      icon: <Brain size={64} className="text-indigo-600" />,
      color: "bg-indigo-50",
      accent: "text-indigo-600"
    },
    {
      // SLIDE 2: VAD
      scientific: {
        title: "Core Affect Space (VAD)",
        desc: "We map categorical emotions to a 3D vector space: Valence (Pleasantness), Arousal (Energy), and Dominance (Control). This dimensional approach allows us to calculate the Euclidean distance and velocity of emotional shifts."
      },
      curious: {
        title: "The GPS of Emotion",
        desc: "We map feelings as coordinates. 'Energy' is your latitude, 'Pleasantness' is your longitude. This lets us track exactly where you are emotionally and how fast you're moving toward burnout or calm."
      },
      visual: (
        <div className="relative w-48 h-48 border border-slate-200 bg-white rounded-2xl flex items-center justify-center shadow-sm overflow-hidden">
             {/* Grid Lines */}
             <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                {[...Array(16)].map((_, i) => <div key={i} className="border-r border-b border-slate-50"></div>)}
             </div>
             {/* Axes */}
             <div className="absolute w-full h-[1px] bg-slate-300"></div>
             <div className="absolute h-full w-[1px] bg-slate-300"></div>
             
             {/* Data Point */}
             <div className="absolute w-4 h-4 bg-violet-500 rounded-full top-10 right-12 animate-pulse shadow-lg shadow-violet-200 z-10"></div>
             
             {/* Labels */}
             <div className="absolute top-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-white/80 px-1 rounded">High Energy</div>
             <div className="absolute bottom-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-white/80 px-1 rounded">Low Energy</div>
             <div className="absolute right-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-white/80 px-1 rounded">Pleasant</div>
             <div className="absolute left-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-white/80 px-1 rounded">Unpleasant</div>
        </div>
      ),
      color: "bg-violet-50",
      accent: "text-violet-600"
    },
    {
      // SLIDE 3: EVI
      scientific: {
        title: "Emotional Volatility Index (EVI)",
        desc: "EVI measures the standard deviation of your VAD vectors over a rolling window. It quantifies dysregulation. A wide 'envelope' on the chart indicates high volatility, a known predictor of psychological risk."
      },
      curious: {
        title: "Measuring Turbulence",
        desc: "Stability isn't about being happy constantly; it's about manageable variance. This score measures the intensity of your ups and downs. A wider range suggests high turbulence, while a narrow range indicates a steady state."
      },
      visual: (
        <div className="relative w-64 h-32 bg-white border border-slate-200 rounded-xl overflow-hidden flex items-center shadow-sm px-4">
            {/* The Envelope (Range) */}
            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <path d="M0,25 Q25,5 50,25 T100,25" fill="none" stroke="#e2e8f0" strokeWidth="20" strokeLinecap="round" className="opacity-50" />
                <path d="M0,25 Q25,5 50,25 T100,25" fill="none" stroke="#10b981" strokeWidth="3" />
            </svg>
            <div className="absolute top-2 right-2 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Stable Envelope</div>
        </div>
      ),
      color: "bg-emerald-50",
      accent: "text-emerald-600"
    },
    {
      // SLIDE 4: LIFT
      scientific: {
        title: "Temporal Lift Analysis",
        desc: "Beyond correlation, we apply a 12-hour lag window to detect Temporal Lift: P(Emotion_t | Context_t-12h). This approximates Granger Causality to identify predictive triggers with epistemic modesty."
      },
      curious: {
        title: "The Ripple Effect",
        desc: "We look for connections across time. Does poor sleep at 7 AM reliably cause irritability at 4 PM? We connect the dots between cause and effect, even when they are hours apart."
      },
      visual: (
        <div className="flex flex-col gap-2 w-full max-w-[200px]">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap size={14} className="text-violet-500" fill="currentColor" />
                    <span className="text-xs font-bold text-slate-600">Poor Sleep</span>
                </div>
                <div className="text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded">12h Lag</div>
            </div>
            <div className="flex justify-center text-[10px] text-slate-400">↓</div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity size={14} className="text-rose-400" />
                    <span className="text-xs font-bold text-slate-600">Irritable</span>
                </div>
            </div>
        </div>
      ),
      color: "bg-violet-50",
      accent: "text-violet-600"
    },
    {
        // SLIDE 5: ETHICS
        scientific: {
            title: "Privacy & Data Sovereignty",
            desc: "This utilizes 'Level 3' personalization techniques (implicit tracking). To adhere to the Transparency & Perceived Control (TPC) paradigm, all computation is local. No data is offloaded."
        },
        curious: {
            title: "Private Intelligence",
            desc: "This is deep analysis, but it happens entirely on your phone's processor. We do not send your emotional patterns to the cloud. You own the data, and you own the insights."
        },
        icon: <ShieldCheck size={64} className="text-sky-500" />,
        color: "bg-sky-50",
        accent: "text-sky-600"
    }
  ];

  const currentContent = slides[step][mode];

  return (
    <div className="fixed inset-0 z-[150] bg-white flex flex-col animate-fade-in">
       {/* Header */}
       <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
           <div className="flex items-center gap-2 text-indigo-700 font-bold">
               <Stethoscope size={20} />
               <span>Clinical Framework</span>
           </div>
           <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors text-slate-500">
               <X size={20} />
           </button>
       </div>

       <div className="flex-1 overflow-y-auto">
           <div className="flex flex-col items-center justify-center min-h-full p-8 pb-12 text-center max-w-lg mx-auto">
                
                {/* Explanation Mode Toggle */}
                <div className="bg-slate-100 p-1 rounded-xl flex mb-8 shadow-inner">
                    <button 
                        onClick={() => setMode('curious')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'curious' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Sparkles size={14} />
                        Curious
                    </button>
                    <button 
                        onClick={() => setMode('scientific')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'scientific' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BookOpen size={14} />
                        Scientific
                    </button>
                </div>

                {/* Visual / Icon */}
                {slides[step].icon ? (
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 shadow-sm ${slides[step].color} transition-all duration-500`}>
                        {slides[step].icon}
                    </div>
                ) : (
                    <div className={`w-full max-w-xs aspect-square flex items-center justify-center mb-8 rounded-3xl ${slides[step].color} transition-all duration-500`}>
                        {slides[step].visual}
                    </div>
                )}
                
                {/* Content */}
                <div className="animate-fade-in" key={`${step}-${mode}`}>
                    <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight leading-tight">{currentContent.title}</h2>
                    <p className="text-slate-500 text-base leading-relaxed">{currentContent.desc}</p>
                </div>
                
                {/* Step Indicator dots */}
                <div className="flex justify-center gap-2 mt-8">
                    {slides.map((_, i) => (
                        <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === step ? `w-8 ${slides[step].accent.replace('text-', 'bg-')}` : 'w-2 bg-slate-200'}`}></div>
                    ))}
                </div>
           </div>
       </div>

       <div className="p-6 border-t border-slate-100 bg-slate-50 safe-area-bottom">
           <div className="max-w-md mx-auto">
               {step < slides.length - 1 ? (
                   <button 
                    onClick={() => setStep(step + 1)}
                    className="w-full py-4 bg-white border border-slate-200 text-slate-800 font-bold rounded-2xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2 text-lg"
                   >
                       Next <ChevronRight size={20} />
                   </button>
               ) : (
                   <button 
                    onClick={onEnable}
                    className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2 text-lg"
                   >
                       <Check size={20} />
                       Enable Clinical Mode
                   </button>
               )}
           </div>
       </div>
    </div>
  );
};

export default ClinicalModeWalkthrough;
