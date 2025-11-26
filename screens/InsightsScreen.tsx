
import React, { useMemo, useState, useDeferredValue } from 'react';
import { CheckIn, ContextTag, AppSettings } from '../types';
import InsightsLocked from '../components/InsightsLocked';
import { AreaChart, Area, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ScatterChart, Scatter, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { TrendingUp, Fingerprint, ShieldCheck, Share2, Check, Zap, Brain, Lightbulb, Activity, Stethoscope, Clock, Hourglass } from 'lucide-react';
import { Haptics } from '../utils/haptics';
import { useAdaptiveConfig } from '../hooks/useAdaptiveConfig';
import { 
    calculateWeekdayData, 
    calculateTrendsData, 
    calculateRadarData, 
    calculateHeatmapData, 
    calculateSmartPatterns,
    calculateEmotionalGranularity,
    calculateScaleCorrelation,
    calculateMoodStability,
    calculateClinicalMetrics,
    calculateVADData
} from '../utils/analytics';
import { FEELING_NODES, getEmotionPath } from '../constants';

interface Props {
    checkIns: CheckIn[];
    customTags: ContextTag[];
    settings: AppSettings;
    isLoading: boolean;
    totalCount: number;
    onUnlockCheckIn: () => void;
}

// Custom Tooltip for Recharts to match Glassmorphism theme
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/90 backdrop-blur-xl p-3 rounded-2xl shadow-xl border border-white/20 ring-1 ring-black/5 z-50">
                {label && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>}
                {payload.map((p: any, i: number) => {
                     // Filter out the 'intensityRange' tuple from tooltip if not needed, or format it
                     if (p.name === 'intensityRange') return null;
                     return (
                        <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-1 last:mb-0">
                            {p.color && <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: p.color }}></div>}
                            <span className="capitalize">{p.name}: <span className="text-indigo-600">{Array.isArray(p.value) ? `${p.value[0]} - ${p.value[1]}` : p.value}</span></span>
                        </div>
                     );
                })}
            </div>
        );
    }
    return null;
};

// Reusable Bento Card
const BentoCard: React.FC<{ 
    title?: string, 
    subtitle?: string,
    icon?: React.ReactNode, 
    children: React.ReactNode, 
    className?: string,
    accentColor?: string
}> = ({ title, subtitle, icon, children, className = '', accentColor = 'bg-slate-100 text-slate-600' }) => (
    <div className={`bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col ${className}`}>
        {(title || icon) && (
            <div className="p-6 pb-2 flex items-start justify-between">
                <div>
                    {title && <h3 className="text-lg font-black text-slate-800 tracking-tight">{title}</h3>}
                    {subtitle && <p className="text-xs font-medium text-slate-400 mt-1">{subtitle}</p>}
                </div>
                {icon && (
                    <div className={`p-2.5 rounded-2xl ${accentColor}`}>
                        {icon}
                    </div>
                )}
            </div>
        )}
        <div className="flex-1 p-6 pt-2 relative">
            {children}
        </div>
    </div>
);

const InsightsScreen: React.FC<Props> = ({ checkIns, customTags, settings, isLoading, totalCount, onUnlockCheckIn }) => {
    const [justShared, setJustShared] = useState(false);
    
    // Adaptive Loading Configuration
    const { isLowEndDevice } = useAdaptiveConfig();
    const shouldAnimate = !isLowEndDevice && !settings.reducedMotion;

    // Use Deferred Value to unblock main thread during calculations
    const deferredCheckIns = useDeferredValue(checkIns);
    const deferredTags = useDeferredValue(customTags);
    const isStale = deferredCheckIns !== checkIns; 

    // --- ANALYTICS ENGINE ---
    const { 
        trendsData, radarData, radarScales, heatmapData, smartPatterns, 
        granularity, dominantMood, scaleCorrelation, stability, unlockProgress,
        clinicalMetrics, vadData
    } = useMemo(() => {
        let daysActive = 0;
        if (deferredCheckIns.length > 0) {
            const first = deferredCheckIns[deferredCheckIns.length-1];
            const diffTime = Math.abs(Date.now() - first.timestamp);
            daysActive = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        }
        
        if (!settings.insightsUnlocked) {
            return { 
                weekdayData: [], trendsData: [], radarData: [], radarScales: [],
                heatmapData: { grid: [], max: 0, labels: [], days: [] }, 
                smartPatterns: [],
                granularity: { score: 0, level: 'Low', message: '' },
                dominantMood: null,
                scaleCorrelation: null,
                stability: { score: 0, label: '', volatility: 0 },
                unlockProgress: { count: totalCount, daysActive },
                clinicalMetrics: { velocity: 0, compliance: 0, dataIntegrity: 'Low' },
                vadData: []
            };
        }

        // Limit data points on low-end devices
        const dataForHeavyCharts = isLowEndDevice ? deferredCheckIns.slice(0, 50) : deferredCheckIns;

        const radarResult = calculateRadarData(dataForHeavyCharts, settings);
        
        // Find dominant mood
        const moodCounts: Record<string, number> = {};
        deferredCheckIns.forEach(c => {
             const primary = c.emotions.find(e => e.isPrimary);
             if(primary) {
                 const root = getEmotionPath(primary.nodeId)[0]?.label;
                 if(root) moodCounts[root] = (moodCounts[root] || 0) + 1;
             }
        });
        const dominant = Object.entries(moodCounts).sort((a,b) => b[1] - a[1])[0];
        const dominantNode = dominant ? Object.values(FEELING_NODES).find(n => n.label === dominant[0]) : null;

        // Correlation: Prioritize Stress vs Energy if available
        const hasStress = settings.enabledScales.includes('stress');
        const hasEnergy = settings.enabledScales.includes('energy');
        const scaleCorr = (hasStress && hasEnergy) 
            ? calculateScaleCorrelation(dataForHeavyCharts, 'stress', 'energy')
            : null;

        return { 
            weekdayData: calculateWeekdayData(deferredCheckIns),
            trendsData: calculateTrendsData(deferredCheckIns),
            radarData: radarResult.radarData,
            radarScales: radarResult.activeScales,
            heatmapData: calculateHeatmapData(deferredCheckIns),
            smartPatterns: calculateSmartPatterns(deferredCheckIns, deferredTags),
            granularity: calculateEmotionalGranularity(deferredCheckIns),
            dominantMood: dominantNode,
            scaleCorrelation: scaleCorr,
            stability: calculateMoodStability(deferredCheckIns),
            unlockProgress: { count: totalCount, daysActive },
            clinicalMetrics: calculateClinicalMetrics(deferredCheckIns, daysActive),
            vadData: calculateVADData(dataForHeavyCharts)
        };
    }, [deferredCheckIns, deferredTags, settings, totalCount, isLowEndDevice]);

    const handleShare = () => {
        const text = `My Mood Patterns:\nActive for ${unlockProgress.daysActive} days.\nGranularity Score: ${granularity.score}/100\nStability: ${stability.label}`;
        navigator.clipboard.writeText(text);
        setJustShared(true);
        Haptics.success();
        setTimeout(() => setJustShared(false), 2000);
    };

    // Filter Visible Patterns
    const visiblePatterns = smartPatterns.filter(p => settings.clinicalModeEnabled || p.type === 'concurrent').slice(0, 3);

    if (!settings.insightsUnlocked) {
        return <InsightsLocked count={unlockProgress.count} days={unlockProgress.daysActive} onCheckIn={onUnlockCheckIn} unlockCountThreshold={10} unlockDaysThreshold={7} />;
    }

    return (
        <div className={`p-4 pb-32 animate-fade-in max-w-lg mx-auto transition-opacity duration-300 ${isStale ? 'opacity-50' : 'opacity-100'}`}>
            
            {/* Header with Data Trust Badge */}
            <div className="flex items-center justify-between px-2 mb-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter">Your Patterns</h2>
                    <div className="flex items-center gap-1.5 mt-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                        <ShieldCheck size={12} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Private & On-Device</span>
                    </div>
                </div>
                <button 
                    onClick={handleShare} 
                    className={`p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 shadow-sm active:scale-95 transition-all ${justShared ? 'text-emerald-500 bg-emerald-50 border-emerald-100' : ''}`}
                >
                    {justShared ? <Check size={20} /> : <Share2 size={20} />}
                </button>
            </div>

            <div className="flex flex-col gap-4">
                
                {/* HERO: Emotional Climate */}
                <BentoCard 
                    className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none shadow-xl shadow-indigo-200"
                    title="Emotional Climate"
                    subtitle={settings.clinicalModeEnabled ? "Volatility Envelope (Range)" : "Intensity Trend"}
                    accentColor="bg-white/10 text-white"
                    icon={<TrendingUp size={20} />}
                >
                    <div className="flex items-end justify-between mt-2">
                        <div>
                            <div className="text-5xl font-black tracking-tight mb-1">{dominantMood?.label || "Balanced"}</div>
                            <p className="text-indigo-100 font-medium text-sm opacity-80">Dominant Mood</p>
                        </div>
                        <div className="h-16 w-32 opacity-80 mix-blend-overlay">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendsData}>
                                    {/* Volatility Envelope (EVI) - Gated by Clinical Mode */}
                                    {settings.clinicalModeEnabled && (
                                        <Area type="monotone" dataKey="intensityRange" stroke="none" fill="#fff" fillOpacity={0.2} isAnimationActive={shouldAnimate} />
                                    )}
                                    {/* The mean line */}
                                    <Area type="monotone" dataKey="intensity" stroke="#fff" strokeWidth={3} fill="none" isAnimationActive={shouldAnimate} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </BentoCard>

                {/* ROW: Smart Patterns (Lift Analysis) - Mix of Public and Advanced */}
                {visiblePatterns.length > 0 && (
                     <div className="space-y-4 animate-fade-in">
                        <h4 className="px-2 text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Zap size={14} className="text-amber-500" />
                            Causal Network
                        </h4>
                        <div className="grid gap-3">
                            {visiblePatterns.map((pattern, idx) => {
                                const isPredictive = pattern.type === 'predictive';
                                return (
                                <div key={idx} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-3">
                                    {/* Advanced Badge for Temporal Patterns */}
                                    {isPredictive && (
                                        <div className="flex items-center gap-1.5 self-start bg-violet-50 text-violet-600 px-2 py-0.5 rounded-md mb-1">
                                            <Hourglass size={10} />
                                            <span className="text-[9px] font-bold uppercase tracking-wider">Temporal Insight (12h Lag)</span>
                                        </div>
                                    )}

                                    {/* Network Flow Visualization */}
                                    <div className="flex items-center justify-between relative">
                                        {/* Left: Trigger */}
                                        <div className="flex flex-col items-center gap-1 z-10">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shadow-sm border border-slate-200 relative">
                                                <Zap size={18} fill="currentColor" className={isPredictive ? "text-violet-400" : "text-slate-400"} />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight max-w-[60px] truncate">{pattern.trigger}</span>
                                        </div>

                                        {/* Middle: Connection Arrow */}
                                        <div className="flex-1 flex flex-col items-center px-2 relative -top-2">
                                            <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">
                                                {isPredictive ? 'Precedes' : 'Co-occurs'}
                                            </div>
                                            
                                            {/* Arrow Line */}
                                            <div className="w-full h-0.5 relative flex items-center">
                                                 <div className={`w-full h-full ${isPredictive ? 'bg-violet-200 dashed-line' : 'bg-slate-100'}`}></div>
                                                 {isPredictive && <div className="absolute left-1/2 -translate-x-1/2 bg-white px-1 text-[9px] font-bold text-violet-400 flex items-center gap-0.5"><Clock size={10}/> 12h</div>}
                                                 <div className={`absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 rotate-45 ${isPredictive ? 'border-violet-300' : 'border-slate-200'}`}></div>
                                            </div>

                                            <div className={`mt-1 px-2 py-0.5 rounded-md text-xs font-black shadow-sm border ${isPredictive ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                {pattern.lift}x Lift
                                            </div>
                                        </div>

                                        {/* Right: Emotion */}
                                        <div className="flex flex-col items-center gap-1 z-10">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm border-2 border-white ring-1 ring-slate-100 ${pattern.sentiment === 'negative' ? 'bg-rose-400' : 'bg-emerald-400'}`}>
                                                <span className="text-xs font-black">{pattern.emotion.substring(0, 2)}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight max-w-[60px] truncate">{pattern.emotion}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Therapeutic Advice Box */}
                                    <div className={`mt-1 p-3 rounded-xl text-xs font-medium leading-relaxed flex gap-2 ${pattern.sentiment === 'negative' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                        <Lightbulb size={16} className="shrink-0 mt-0.5" />
                                        <span>
                                            <span className="font-black uppercase tracking-wide opacity-80 mr-1">Insight:</span>
                                            {pattern.advice}
                                        </span>
                                    </div>
                                </div>
                            )})}
                        </div>
                     </div>
                )}

                {/* CLINICAL METRICS ROW (Gated by Clinical Mode) */}
                {settings.clinicalModeEnabled && (
                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                         <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                             <div className="flex items-start justify-between">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Velocity</p>
                                <Activity size={16} className="text-indigo-500" />
                             </div>
                             <div>
                                 <p className="text-2xl font-black text-slate-800">{clinicalMetrics.velocity}</p>
                                 <p className="text-[10px] text-slate-400">Affective Change / Day</p>
                             </div>
                         </div>
                         <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                             <div className="flex items-start justify-between">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Compliance</p>
                                <Stethoscope size={16} className={clinicalMetrics.dataIntegrity === 'High' ? 'text-emerald-500' : 'text-amber-500'} />
                             </div>
                             <div>
                                 <p className="text-2xl font-black text-slate-800">{clinicalMetrics.compliance}%</p>
                                 <p className="text-[10px] text-slate-400">Data Integrity: {clinicalMetrics.dataIntegrity}</p>
                             </div>
                         </div>
                    </div>
                )}

                {/* VAD SCATTER PLOT (Gated by Clinical Mode) */}
                {settings.clinicalModeEnabled && (
                    <BentoCard 
                        title="Core Affect Space" 
                        subtitle="Valence vs Arousal (Dimensional)"
                        icon={<Brain size={20} />} 
                        accentColor="bg-violet-50 text-violet-600"
                        className="animate-fade-in"
                    >
                        <div className="h-56 w-full -ml-4 mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <ReferenceLine x={0} stroke="#cbd5e1" strokeDasharray="3 3" />
                                    <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
                                    <XAxis type="number" dataKey="valence" name="Valence" domain={[-1, 1]} hide />
                                    <YAxis type="number" dataKey="arousal" name="Arousal" domain={[-1, 1]} hide />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                                    <Scatter name="Check-ins" data={vadData} fill="#8b5cf6" fillOpacity={0.6} />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Axis Labels Overlay */}
                        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 pb-12 pt-16">
                            <div className="flex justify-center text-[9px] font-bold uppercase text-slate-400">High Energy</div>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold uppercase text-slate-400 -rotate-90">Unpleasant</span>
                                <span className="text-[9px] font-bold uppercase text-slate-400 rotate-90">Pleasant</span>
                            </div>
                            <div className="flex justify-center text-[9px] font-bold uppercase text-slate-400">Low Energy</div>
                        </div>
                    </BentoCard>
                )}

                {/* ROW 2: Stability & Granularity */}
                <div className={`grid grid-cols-1 ${settings.clinicalModeEnabled ? 'md:grid-cols-2' : ''} gap-4`}>
                    
                    {/* Emotional Granularity */}
                    <BentoCard 
                        title="Granularity" 
                        subtitle="Emotional IQ"
                        icon={<Fingerprint size={20} />} 
                        accentColor="bg-sky-50 text-sky-600"
                    >
                        <div className="flex flex-col items-center justify-center py-2">
                            <div className="relative mb-4">
                                <svg className="w-24 h-24 transform -rotate-90">
                                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * granularity.score) / 100} className="text-sky-500 transition-all duration-1000 ease-out" />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-slate-800">{granularity.score}</span>
                            </div>
                            <div className="text-center">
                                <div className="text-sm font-bold text-sky-600 mb-1">{granularity.level}</div>
                            </div>
                        </div>
                    </BentoCard>

                    {/* Mood Stability (EVI) - Gated by Clinical Mode */}
                    {settings.clinicalModeEnabled && (
                        <BentoCard 
                            title="Stability" 
                            subtitle="EVI (Variance)"
                            icon={<Activity size={20} />} 
                            accentColor="bg-emerald-50 text-emerald-600"
                        >
                             <div className="flex flex-col items-center justify-center h-full pb-4">
                                 <div className="text-3xl font-black text-slate-800 mb-1">{stability.score}</div>
                                 <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">{stability.label}</div>
                                 
                                 {/* Visual Gauge Line */}
                                 <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative">
                                     <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300"></div>
                                     <div 
                                        className="absolute top-0 bottom-0 w-2 h-2 rounded-full bg-emerald-500 shadow-sm transition-all duration-1000"
                                        style={{ left: `${stability.score}%`, transform: 'translateX(-50%)' }}
                                     ></div>
                                 </div>
                                 <div className="flex justify-between w-full text-[9px] text-slate-400 font-bold mt-1 uppercase">
                                     <span>Volatile</span>
                                     <span>Stable</span>
                                 </div>
                             </div>
                        </BentoCard>
                    )}
                </div>

                {/* ROW 4: Fingerprint Radar */}
                <BentoCard 
                    title="Fingerprint" 
                    subtitle="Mood Dimensions"
                    icon={<Fingerprint size={20} />} 
                    accentColor="bg-pink-50 text-pink-500"
                >
                        <div className="h-64 w-full -ml-4 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid opacity={0.1} />
                                <PolarAngleAxis dataKey="emotion" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: '800' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                                {radarScales.map((scale, i) => (
                                    <Radar key={scale.id} name={scale.label} dataKey={scale.label} stroke={['#6366f1', '#ec4899', '#14b8a6'][i % 3]} fill={['#6366f1', '#ec4899', '#14b8a6'][i % 3]} fillOpacity={0.1} isAnimationActive={shouldAnimate} />
                                ))}
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', marginTop: '10px' }}/>
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </BentoCard>

                {/* ROW 5: Heatmap (Grid) */}
                <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                    <h3 className="text-lg font-black text-slate-800 mb-4">Temporal Map</h3>
                    <div className="grid grid-cols-5 gap-2">
                         <div className="col-span-1"></div>
                         {heatmapData.labels.map(l => <div key={l} className="text-[10px] text-slate-400 text-center uppercase font-bold tracking-wider">{l}</div>)}
                         {heatmapData.days.map((day, dIdx) => (
                             <React.Fragment key={day}>
                                 <div className="text-[10px] font-bold text-slate-400 flex items-center justify-end pr-2">{day}</div>
                                 {heatmapData.grid[dIdx]?.map((count: number, tIdx: number) => {
                                     // Dynamic coloring based on intensity
                                     const opacity = count === 0 ? 0.05 : 0.2 + (count / (heatmapData.max || 1)) * 0.8;
                                     return (
                                         <div 
                                            key={`${dIdx}-${tIdx}`} 
                                            className="aspect-square rounded-lg transition-all hover:scale-110" 
                                            style={{ backgroundColor: `rgba(79, 70, 229, ${opacity})` }} 
                                            title={`${count} check-ins`}
                                         />
                                     )
                                 })}
                             </React.Fragment>
                         ))}
                     </div>
                </div>

                <div className="text-center py-8">
                     <p className="text-xs text-slate-400 font-medium">Insights improve with every check-in.</p>
                </div>

            </div>
        </div>
    );
};

export default InsightsScreen;
