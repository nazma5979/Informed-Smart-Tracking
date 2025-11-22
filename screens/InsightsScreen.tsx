
import React, { useMemo, useState } from 'react';
import { CheckIn, ContextTag, AppSettings } from '../types';
import { DEFAULT_TAGS, DEFAULT_SCALES, getEmotionPath } from '../constants';
import InsightsLocked from '../components/InsightsLocked';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, CalendarDays, Fingerprint, Wind, Loader2, Grid, Activity } from 'lucide-react';

interface Props {
    checkIns: CheckIn[];
    customTags: ContextTag[];
    settings: AppSettings;
    isLoading: boolean;
    totalCount: number;
    onUnlockCheckIn: () => void;
}

const InsightsScreen: React.FC<Props> = ({ checkIns, customTags, settings, isLoading, totalCount, onUnlockCheckIn }) => {
  // State for Context Impact Chart
  const [selectedImpactScale, setSelectedImpactScale] = useState<string>('stress');

  // --- CALCULATIONS ---
  const { weekdayData, trendsData, contextData, radarData, unlockProgress, activeScales, heatmapData, impactData } = useMemo(() => {
      const count = totalCount; 
      let daysActive = 0;
      
      if (checkIns.length > 0) {
          const first = checkIns[checkIns.length-1];
          const diffTime = Math.abs(Date.now() - first.timestamp);
          daysActive = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      }
      
      if (!settings.insightsUnlocked) {
          return { 
              weekdayData: [], 
              trendsData: [], 
              contextData: [], 
              radarData: [], 
              heatmapData: { grid: Array(7).fill(Array(4).fill(0)), max: 0, labels: [], days: [] }, 
              impactData: [],
              unlockProgress: { count, daysActive }, 
              activeScales: [] 
          };
      }

      // 1. Weekday Distribution
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayCounts = new Array(7).fill(0);
      checkIns.forEach(c => {
          const d = new Date(c.timestamp).getDay();
          dayCounts[d]++;
      });
      const weekdayData = days.map((day, i) => ({ name: day, count: dayCounts[i] }));

      // 2. Trends (Time Series)
      const sorted = [...checkIns].sort((a, b) => a.timestamp - b.timestamp);
      const trendsData = sorted.map(c => ({
          date: new Date(c.timestamp).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
          intensity: c.intensity || 0,
          stress: c.scaleValues['stress'] || 0,
          energy: c.scaleValues['energy'] || 0
      }));

      // 3. Context Correlation (Top tags per emotion)
      const emotionContexts: Record<string, Record<string, number>> = {};
      checkIns.forEach(c => {
          const primary = c.emotions.find(e => e.isPrimary);
          if (!primary) return;
          const path = getEmotionPath(primary.nodeId);
          const root = path[0]?.label;
          
          if (!emotionContexts[root]) emotionContexts[root] = {};
          c.tags.forEach(tId => {
              emotionContexts[root][tId] = (emotionContexts[root][tId] || 0) + 1;
          });
      });
      
      const contextData = Object.entries(emotionContexts).map(([emotion, tags]) => {
          const sortedTags = Object.entries(tags)
             .sort(([,a], [,b]) => b - a)
             .slice(0, 3)
             .map(([tId]) => {
                 const t = DEFAULT_TAGS.find(d => d.id === tId) || customTags.find(ct => ct.id === tId);
                 return t ? t.label : "Archived Tag";
             });
          return { emotion, topTags: sortedTags };
      }).filter(d => d.topTags.length > 0);

      // 4. Radar
      const allScales = [...DEFAULT_SCALES, ...settings.customScales];
      const activeScales = allScales.filter(s => settings.enabledScales.includes(s.id));
      
      const emotionScaleSums: Record<string, Record<string, number>> = {};
      const emotionCounts: Record<string, number> = {};

      checkIns.forEach(c => {
          const primary = c.emotions.find(e => e.isPrimary);
          if (!primary) return;
          const path = getEmotionPath(primary.nodeId);
          const root = path[0]?.label;
          
          if (!emotionScaleSums[root]) {
              emotionScaleSums[root] = {};
              activeScales.forEach(s => emotionScaleSums[root][s.id] = 0);
              emotionCounts[root] = 0;
          }
          
          emotionCounts[root]++;
          
          activeScales.forEach(s => {
              const val = c.scaleValues[s.id] !== undefined ? c.scaleValues[s.id] : s.defaultValue;
              emotionScaleSums[root][s.id] += val;
          });
      });

      const radarData = Object.entries(emotionScaleSums).map(([emotion, sums]) => {
          const count = emotionCounts[emotion];
          const point: any = { emotion, fullMark: 5 };
          activeScales.forEach(s => {
              point[s.label] = (sums[s.id] / count).toFixed(1);
          });
          return point;
      }).slice(0, 5); 

      // 5. Heatmap Data (Day x Time of Day)
      const timeBlocks = ['Night', 'Morning', 'Afternoon', 'Evening'];
      // Create deep copy of grid to avoid reference issues
      const heatmapGrid = JSON.parse(JSON.stringify(Array(7).fill(Array(4).fill(0))));
      let maxHeat = 1;

      checkIns.forEach(c => {
          const date = new Date(c.timestamp);
          const day = date.getDay(); // 0-6
          const hour = date.getHours();
          
          let block = 0; // Night
          if (hour >= 6 && hour < 12) block = 1; // Morning
          else if (hour >= 12 && hour < 18) block = 2; // Afternoon
          else if (hour >= 18) block = 3; // Evening

          heatmapGrid[day][block]++;
          if (heatmapGrid[day][block] > maxHeat) maxHeat = heatmapGrid[day][block];
      });

      const heatmapData = { grid: heatmapGrid, max: maxHeat, labels: timeBlocks, days };

      // 6. Impact Analysis (Tag vs Scale Avg)
      const tagStats: Record<string, { count: number, scaleSums: Record<string, number> }> = {};
      
      checkIns.forEach(c => {
          c.tags.forEach(tId => {
              if (!tagStats[tId]) {
                  tagStats[tId] = { count: 0, scaleSums: {} };
                  activeScales.forEach(s => tagStats[tId].scaleSums[s.id] = 0);
              }
              tagStats[tId].count++;
              activeScales.forEach(s => {
                 const val = c.scaleValues[s.id] !== undefined ? c.scaleValues[s.id] : s.defaultValue;
                 tagStats[tId].scaleSums[s.id] += val;
              });
          });
      });

      const impactData = Object.entries(tagStats)
          .map(([tId, stats]) => {
             const tag = DEFAULT_TAGS.find(d => d.id === tId) || customTags.find(ct => ct.id === tId);
             const point: any = { name: tag ? tag.label : "Archived", count: stats.count };
             activeScales.forEach(s => {
                 point[s.id] = parseFloat((stats.scaleSums[s.id] / stats.count).toFixed(1));
             });
             return point;
          })
          .filter(p => p.count >= 2) // Only show tags with at least 2 entries
          .sort((a, b) => b.count - a.count) // Sort by frequency
          .slice(0, 8); // Top 8

      return { weekdayData, trendsData, contextData, radarData, heatmapData, impactData, unlockProgress: { count, daysActive }, activeScales };
  }, [checkIns, customTags, settings.insightsUnlocked, totalCount, settings.customScales, settings.enabledScales]);

    if (!settings.insightsUnlocked) {
        return <InsightsLocked count={unlockProgress.count} days={unlockProgress.daysActive} onCheckIn={onUnlockCheckIn} unlockCountThreshold={10} unlockDaysThreshold={7} />;
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4 animate-fade-in">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="text-secondary text-sm font-medium">Analyzing patterns...</p>
            </div>
        );
    }

    // Colors for radar chart axes
    const RADAR_COLORS = ['#f87171', '#fbbf24', '#60a5fa', '#a3e635', '#a78bfa'];

    return (
        <div className="p-6 space-y-8 pb-24 animate-fade-in">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-primary">Your Patterns</h2>
                <div className="flex bg-card border border-theme rounded-lg p-0.5">
                    <button className="px-3 py-1 text-[10px] font-bold bg-accent text-accent-fg rounded-md shadow-sm">7D</button>
                    <button className="px-3 py-1 text-[10px] font-bold text-secondary hover:bg-slate-50">30D</button>
                    <button className="px-3 py-1 text-[10px] font-bold text-secondary hover:bg-slate-50">ALL</button>
                </div>
            </div>

            {/* 1. TRENDS */}
            <div className="bg-card p-4 rounded-2xl border border-theme shadow-sm">
                <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-accent"/> Mood Trends</h3>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendsData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="date" tick={{fontSize: 10}} interval="preserveStartEnd" />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                            <Line type="monotone" dataKey="intensity" stroke="var(--color-accent)" strokeWidth={3} dot={false} />
                            <Line type="monotone" dataKey="stress" stroke="#f87171" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="energy" stroke="#fbbf24" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-secondary"><div className="w-2 h-2 rounded-full bg-accent"></div> Intensity</div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-secondary"><div className="w-2 h-2 rounded-full bg-red-400"></div> Stress</div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-secondary"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Energy</div>
                </div>
            </div>

            {/* 6. CONTEXT IMPACT (New) */}
            {impactData.length > 0 && activeScales.length > 0 && (
                <div className="bg-card p-4 rounded-2xl border border-theme shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-primary flex items-center gap-2"><Activity size={16} className="text-accent"/> Context Impact</h3>
                        <select 
                            value={selectedImpactScale}
                            onChange={(e) => setSelectedImpactScale(e.target.value)}
                            className="text-xs p-1 rounded bg-app border border-theme text-secondary font-bold outline-none"
                        >
                             {activeScales.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </div>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={impactData} layout="vertical" margin={{ left: 20 }}>
                                <XAxis type="number" domain={[1, 5]} hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10, fontWeight: 600}} />
                                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '8px' }} />
                                <Bar dataKey={selectedImpactScale} fill="var(--color-accent)" radius={[0, 4, 4, 0]} barSize={12}>
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-center text-secondary mt-2">Average {activeScales.find(s=>s.id===selectedImpactScale)?.label} per context</p>
                </div>
            )}

            {/* 2. WEEKDAY */}
            <div className="bg-card p-4 rounded-2xl border border-theme shadow-sm">
                <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-2"><CalendarDays size={16} className="text-accent"/> Weekly Rhythm</h3>
                <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weekdayData}>
                            <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
                            <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 4, 4]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 5. HEATMAP */}
            <div className="bg-card p-4 rounded-2xl border border-theme shadow-sm">
                 <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-2"><Grid size={16} className="text-accent"/> Check-in Heatmap</h3>
                 <div className="grid grid-cols-5 gap-1">
                     <div className="col-span-1"></div>
                     {heatmapData.labels.map(l => <div key={l} className="text-[9px] text-secondary text-center uppercase font-bold">{l.slice(0,3)}</div>)}
                     
                     {heatmapData.days.map((day, dIdx) => (
                         <React.Fragment key={day}>
                             <div className="text-[10px] font-bold text-secondary flex items-center justify-end pr-2">{day}</div>
                             {heatmapData.grid[dIdx] && heatmapData.grid[dIdx].map((count, tIdx) => {
                                 const opacity = count === 0 ? 0.05 : 0.2 + (count / (heatmapData.max || 1)) * 0.8;
                                 return (
                                     <div 
                                        key={`${dIdx}-${tIdx}`} 
                                        className="aspect-square rounded-md transition-all hover:scale-110"
                                        style={{ 
                                            backgroundColor: 'var(--color-accent)',
                                            opacity: opacity
                                        }}
                                        title={`${count} check-ins`}
                                     ></div>
                                 )
                             })}
                         </React.Fragment>
                     ))}
                 </div>
            </div>

            {/* 3. RADAR */}
            {radarData.length > 0 && activeScales.length > 0 && (
                <div className="bg-card p-4 rounded-2xl border border-theme shadow-sm">
                    <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-2"><Fingerprint size={16} className="text-accent"/> Emotional Fingerprints</h3>
                    <div className="h-64 w-full relative -left-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid opacity={0.2} />
                                <PolarAngleAxis dataKey="emotion" tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 'bold' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                                {activeScales.map((scale, index) => (
                                    <Radar 
                                        key={scale.id}
                                        name={scale.label} 
                                        dataKey={scale.label} 
                                        stroke={RADAR_COLORS[index % RADAR_COLORS.length]} 
                                        fill={RADAR_COLORS[index % RADAR_COLORS.length]} 
                                        fillOpacity={0.1} 
                                    />
                                ))}
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}/>
                                <Tooltip />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* 4. CONTEXT */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2"><Wind size={16} className="text-accent"/> Context Patterns</h3>
                {contextData.map(d => (
                    <div key={d.emotion} className="flex items-center justify-between p-3 bg-card border border-theme rounded-xl">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-8 rounded-full bg-accent"></div>
                            <span className="font-bold text-primary text-sm">When {d.emotion}</span>
                        </div>
                        <div className="flex gap-1">
                            {d.topTags.map(t => (
                                <span key={t} className="px-2 py-1 bg-app rounded-md text-[10px] font-bold text-secondary border border-theme">{t}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InsightsScreen;
