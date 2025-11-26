
import { CheckIn, ContextTag, AppSettings, Scale } from '../types';
import { DEFAULT_TAGS, DEFAULT_SCALES, getEmotionPath, ROOT_VAD_MAP, VADVector } from '../constants';

// --- HELPER TYPES ---
export interface Pattern {
    type: 'concurrent' | 'predictive'; // Predictive = Temporal Lag (Granger-lite)
    trigger: string; // e.g., "Work"
    emotion: string; // e.g., "Stressed"
    lift: number; // > 1.0 means positive correlation. 2.0 = 2x more likely.
    confidence: number; // based on sample size
    message: string;
    advice: string; // Therapeutic guidance
    sentiment: 'positive' | 'negative' | 'neutral';
    timeLag?: string; // e.g. "4h later"
}

export interface GranularityScore {
    score: number; // 0-100
    level: 'Low' | 'Moderate' | 'High' | 'Very High';
    message: string;
}

export interface ScaleCorrelation {
    scaleX: string;
    scaleY: string;
    correlation: number; // -1 to 1 (Pearson)
    message: string;
    data: { x: number, y: number, z: number }[]; // z = count (bubble size)
}

export interface MoodStability {
    score: number; // 0-100 (100 = very stable)
    label: string;
    volatility: number; // Standard Deviation
}

// New Clinical Metrics
export interface ClinicalMetrics {
    velocity: number; // Rate of emotional change (distance / time)
    compliance: number; // % of active days with logs
    dataIntegrity: 'High' | 'Moderate' | 'Low';
}

export interface VADDataPoint {
    id: string;
    timestamp: number;
    valence: number; // -1 to 1
    arousal: number; // -1 to 1
    dominance: number; // -1 to 1
    label: string;
}

// --- BASIC CHARTS ---

export const calculateWeekdayData = (checkIns: CheckIn[]) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayCounts = new Array(7).fill(0);
    checkIns.forEach(c => dayCounts[new Date(c.timestamp).getDay()]++);
    return days.map((day, i) => ({ name: day, count: dayCounts[i] }));
};

export const calculateTrendsData = (checkIns: CheckIn[]) => {
    // Sort by time
    const sorted = [...checkIns].sort((a, b) => a.timestamp - b.timestamp);
    
    // Group by day to avoid messy charts if multiple check-ins per day
    const dailyMap: Record<string, { intensityValues: number[], count: number, stressSum: number, energySum: number }> = {};
    
    sorted.forEach(c => {
        const dateKey = new Date(c.timestamp).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
        if (!dailyMap[dateKey]) dailyMap[dateKey] = { intensityValues: [], count: 0, stressSum: 0, energySum: 0 };
        
        const intensity = c.intensity || 2;
        dailyMap[dateKey].intensityValues.push(intensity);
        dailyMap[dateKey].stressSum += (c.scaleValues['stress'] || 0);
        dailyMap[dateKey].energySum += (c.scaleValues['energy'] || 0);
        dailyMap[dateKey].count++;
    });

    return Object.entries(dailyMap).map(([date, data]) => {
        const avgIntensity = data.intensityValues.reduce((a, b) => a + b, 0) / data.count;
        const minIntensity = Math.min(...data.intensityValues);
        const maxIntensity = Math.max(...data.intensityValues);
        
        // EVI Envelope: If only 1 entry, assume small variance around it for visualization
        // If multiple entries, use actual min/max to show volatility range
        const range = data.count > 1 
            ? [minIntensity, maxIntensity] 
            : [Math.max(1, avgIntensity - 0.1), Math.min(3, avgIntensity + 0.1)];

        return {
            date,
            intensity: parseFloat(avgIntensity.toFixed(1)),
            intensityRange: range, // For Volatility Band (Shaded Envelope)
            stress: parseFloat((data.stressSum / data.count).toFixed(1)),
            energy: parseFloat((data.energySum / data.count).toFixed(1))
        };
    });
};

// --- ADVANCED CLINICAL ANALYTICS (Level 3) ---

/**
 * Calculates VAD vectors for check-ins.
 * Maps categorical emotions to the Valence-Arousal-Dominance dimensional space.
 */
export const calculateVADData = (checkIns: CheckIn[]): VADDataPoint[] => {
    return checkIns.map(c => {
        const primary = c.emotions.find(e => e.isPrimary);
        let vector: VADVector = { valence: 0, arousal: 0, dominance: 0 };
        let label = 'Unknown';

        if (primary) {
            const path = getEmotionPath(primary.nodeId);
            const root = path[0]?.id;
            label = path[path.length - 1].label;
            if (root && ROOT_VAD_MAP[root]) {
                vector = ROOT_VAD_MAP[root];
            }
        }
        
        // Modulate Arousal by Intensity (1-3)
        // If intensity is high (3), push arousal away from 0. If low (1), pull towards 0.
        const intensityMod = (c.intensity || 2) / 2; // 0.5, 1.0, 1.5
        
        return {
            id: c.id,
            timestamp: c.timestamp,
            label,
            valence: vector.valence,
            arousal: parseFloat((vector.arousal * intensityMod).toFixed(2)),
            dominance: vector.dominance
        };
    }).sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Calculates Clinical Metrics including Affective Velocity and Compliance.
 */
export const calculateClinicalMetrics = (checkIns: CheckIn[], daysActive: number): ClinicalMetrics => {
    if (checkIns.length < 2) return { velocity: 0, compliance: 0, dataIntegrity: 'Low' };

    const vadData = calculateVADData(checkIns);
    
    // 1. Affective Velocity: Average Euclidean distance traveled in VAD space per day
    let totalDistance = 0;
    for (let i = 1; i < vadData.length; i++) {
        const curr = vadData[i];
        const prev = vadData[i-1];
        
        // Euclidean distance in 3D space
        const d = Math.sqrt(
            Math.pow(curr.valence - prev.valence, 2) + 
            Math.pow(curr.arousal - prev.arousal, 2) + 
            Math.pow(curr.dominance - prev.dominance, 2)
        );
        totalDistance += d;
    }
    
    // Normalize by days active to get "Speed per Day"
    const velocity = totalDistance / Math.max(1, daysActive);

    // 2. Compliance: Active Days / Total Days span
    const sorted = [...checkIns].sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted[0].timestamp;
    const last = Date.now();
    const totalDaysSpan = Math.max(1, Math.ceil((last - first) / (1000 * 60 * 60 * 24)));
    
    // Count unique days with logs
    const uniqueDays = new Set(sorted.map(c => new Date(c.timestamp).toDateString())).size;
    
    const compliance = Math.min(100, Math.round((uniqueDays / totalDaysSpan) * 100));
    
    let dataIntegrity: 'High' | 'Moderate' | 'Low' = 'Low';
    if (compliance > 70) dataIntegrity = 'High';
    else if (compliance > 40) dataIntegrity = 'Moderate';

    return {
        velocity: parseFloat(velocity.toFixed(2)),
        compliance,
        dataIntegrity
    };
};

/**
 * Calculates Mood Stability based on EVI (Standard Deviation of Valence Vector).
 * Refined to use VAD variance rather than just intensity.
 */
export const calculateMoodStability = (checkIns: CheckIn[]): MoodStability => {
    if (checkIns.length < 5) return { score: 50, label: 'Calculating...', volatility: 0 };

    const vadData = calculateVADData(checkIns);

    // 1. Calculate Mean Valence
    const sumValence = vadData.reduce((acc, c) => acc + c.valence, 0);
    const meanValence = sumValence / vadData.length;

    // 2. Calculate Variance (EVI)
    const variance = vadData.reduce((acc, c) => acc + Math.pow(c.valence - meanValence, 2), 0) / vadData.length;

    // 3. Standard Deviation
    const stdDev = Math.sqrt(variance);

    // 4. Normalize (Max possible SD for range -1 to 1 is 1.0)
    // Map 0.0 -> 100 (Stable), 0.5+ -> Low Stability
    const score = Math.max(0, Math.min(100, (1 - (stdDev * 1.5)) * 100));

    let label = 'Balanced';
    if (score > 80) label = 'Very Stable';
    else if (score > 60) label = 'Steady';
    else if (score < 30) label = 'High Volatility'; 
    else label = 'Variable';

    return {
        score: Math.round(score),
        label,
        volatility: parseFloat(stdDev.toFixed(2))
    };
};

/**
 * Calculates Pearson Correlation between two scales (e.g., Stress vs Energy).
 */
export const calculateScaleCorrelation = (checkIns: CheckIn[], scaleA: string, scaleB: string): ScaleCorrelation => {
    const dataPoints: { x: number, y: number }[] = [];
    
    // Bubble chart data map: "x-y" -> count
    const bubbleMap: Record<string, number> = {};

    checkIns.forEach(c => {
        const valA = c.scaleValues[scaleA];
        const valB = c.scaleValues[scaleB];
        if (valA !== undefined && valB !== undefined) {
            dataPoints.push({ x: valA, y: valB });
            const key = `${valA}-${valB}`;
            bubbleMap[key] = (bubbleMap[key] || 0) + 1;
        }
    });

    const plotData = Object.entries(bubbleMap).map(([key, count]) => {
        const [x, y] = key.split('-').map(Number);
        return { x, y, z: count * 10 }; // z is size
    });

    if (dataPoints.length < 5) {
        return { scaleX: scaleA, scaleY: scaleB, correlation: 0, message: "Not enough data", data: [] };
    }

    // Pearson Calculation
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((a, b) => a + b.x, 0);
    const sumY = dataPoints.reduce((a, b) => a + b.y, 0);
    const sumXY = dataPoints.reduce((a, b) => a + (b.x * b.y), 0);
    const sumX2 = dataPoints.reduce((a, b) => a + (b.x * b.x), 0);
    const sumY2 = dataPoints.reduce((a, b) => a + (b.y * b.y), 0);

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    const r = denominator === 0 ? 0 : numerator / denominator;

    let message = "No correlation";
    if (r > 0.5) message = `${scaleA} increases with ${scaleB}`;
    else if (r < -0.5) message = `${scaleA} drains your ${scaleB}`;

    return {
        scaleX: scaleA,
        scaleY: scaleB,
        correlation: parseFloat(r.toFixed(2)),
        message,
        data: plotData
    };
};

/**
 * Calculates Statistical Lift to find non-obvious patterns.
 * UPGRADE: Now supports "Temporal Lift" (Predictive) to approximate Granger Causality.
 * Analysis includes:
 * 1. Concurrent Lift: P(Emotion | Tag) / P(Emotion)
 * 2. Temporal Lift: P(Emotion_t | Tag_t-1) / P(Emotion) [Lag window: 12 hours]
 */
export const calculateSmartPatterns = (checkIns: CheckIn[], customTags: ContextTag[]): Pattern[] => {
    if (checkIns.length < 5) return [];

    const sortedCheckIns = [...checkIns].sort((a, b) => a.timestamp - b.timestamp);
    const totalCount = sortedCheckIns.length;
    const tagCounts: Record<string, number> = {}; // Count of tags
    const emotionCounts: Record<string, number> = {}; // Count of emotions (roots)
    
    // Concurrent Pairs
    const jointCounts: Record<string, Record<string, number>> = {}; 
    
    // Temporal Pairs (Lagged) - Tag(T-1) -> Emotion(T)
    const temporalJointCounts: Record<string, Record<string, number>> = {};
    const temporalTagCounts: Record<string, number> = {};

    const LAG_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 Hours for predictive window

    // 1. Tally Counts
    sortedCheckIns.forEach((c, idx) => {
        const primary = c.emotions.find(e => e.isPrimary);
        if (!primary) return;
        const path = getEmotionPath(primary.nodeId);
        const root = path[0]?.label; 
        const rootId = path[0]?.id;
        if (!root) return;
        
        emotionCounts[root] = (emotionCounts[root] || 0) + 1;

        // Concurrent Analysis
        c.tags.forEach(tId => {
            tagCounts[tId] = (tagCounts[tId] || 0) + 1;
            if (!jointCounts[tId]) jointCounts[tId] = {};
            jointCounts[tId][root] = (jointCounts[tId][root] || 0) + 1;
            jointCounts[tId][`__id_${root}`] = rootId as any; 
        });

        // Temporal Analysis (Predictive)
        // Look back at previous check-ins within lag window
        for (let i = idx - 1; i >= 0; i--) {
            const prev = sortedCheckIns[i];
            if (c.timestamp - prev.timestamp > LAG_WINDOW_MS) break; // Out of window
            
            prev.tags.forEach(tId => {
                temporalTagCounts[tId] = (temporalTagCounts[tId] || 0) + 1;
                if (!temporalJointCounts[tId]) temporalJointCounts[tId] = {};
                temporalJointCounts[tId][root] = (temporalJointCounts[tId][root] || 0) + 1;
                temporalJointCounts[tId][`__id_${root}`] = rootId as any;
            });
        }
    });

    const patterns: Pattern[] = [];
    const allTags = [...DEFAULT_TAGS, ...customTags];
    const NEGATIVE_ROOTS = ['sad', 'angry', 'fearful', 'bad', 'disgusted'];

    // Helper to generate pattern
    const processCounts = (
        joints: Record<string, Record<string, number>>, 
        counts: Record<string, number>, 
        type: 'concurrent' | 'predictive'
    ) => {
        Object.keys(joints).forEach(tagId => {
            const tagCount = counts[tagId];
            if (tagCount < 3) return;

            Object.keys(joints[tagId]).forEach(emotion => {
                if (emotion.startsWith('__id_')) return;
                
                const jointCount = joints[tagId][emotion];
                const emotionCount = emotionCounts[emotion];
                
                // Lift Calculation
                const probEmotion = emotionCount / totalCount;
                const probEmotionGivenTag = jointCount / tagCount;
                const lift = probEmotionGivenTag / probEmotion;

                // Threshold: Lift > 1.3 (30% increase)
                if (lift > 1.3 && jointCount >= 2) {
                    const tagLabel = allTags.find(t => t.id === tagId)?.label || "Unknown";
                    const rootId: string = joints[tagId][`__id_${emotion}`] as any;
                    const isNegative = NEGATIVE_ROOTS.includes(rootId);
                    const sentiment = isNegative ? 'negative' : 'positive';
                    
                    // Epistemic Modesty: Phrase based on confidence
                    const confidenceVal = (jointCount / tagCount); // 0 to 1
                    
                    let advice = "";
                    let message = "";
                    
                    if (type === 'predictive') {
                        // Highly Modest Phrasing
                        // Transparency: Explicitly mention the 12h window
                        if (confidenceVal > 0.6) {
                            message = `It seems '${tagLabel}' is often followed by ${emotion} later in the day.`;
                        } else {
                             message = `We noticed a potential link between '${tagLabel}' and feeling ${emotion} within 12 hours.`;
                        }

                        if (isNegative) advice = `Transparency: This correlation is based on a 12-hour predictive window. Reflect if this matches your experience.`;
                        else advice = `Observation: This pattern suggests '${tagLabel}' might set a positive tone for your day.`;
                        
                    } else {
                        // Concurrent
                        message = `When tagged with '${tagLabel}', reports of ${emotion} are ${lift.toFixed(1)}x more likely compared to your average.`;
                        
                        if (isNegative) advice = `Reflection: Consider if this context consistently influences your mood in this way.`;
                        else advice = `Insight: This context appears strongly associated with positive well-being for you.`;
                    }

                    patterns.push({
                        type,
                        trigger: tagLabel,
                        emotion: emotion,
                        lift: parseFloat(lift.toFixed(1)),
                        confidence: Math.min(100, (jointCount / tagCount) * 100),
                        message,
                        advice,
                        sentiment,
                        timeLag: type === 'predictive' ? '< 12h' : undefined
                    });
                }
            });
        });
    };

    processCounts(jointCounts, tagCounts, 'concurrent');
    processCounts(temporalJointCounts, temporalTagCounts, 'predictive');

    // Deduplicate: If we have both predictive and concurrent for same pair, keep Predictive (it's stronger)
    const uniquePatterns: Pattern[] = [];
    const seen = new Set<string>();
    
    // Sort predictive first, then high lift
    patterns.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'predictive' ? -1 : 1;
        return b.lift - a.lift;
    });

    patterns.forEach(p => {
        const key = `${p.trigger}-${p.emotion}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniquePatterns.push(p);
        }
    });
    
    // Increase limit to 10 to ensure we have enough to show after filtering in UI
    return uniquePatterns.slice(0, 10);
};

/**
 * Calculates Emotional Granularity.
 * High granularity = using specific leaf nodes (e.g. "Furious") vs generic roots (e.g. "Angry").
 * This is a key metric for emotional intelligence/well-being.
 */
export const calculateEmotionalGranularity = (checkIns: CheckIn[]): GranularityScore => {
    if (checkIns.length === 0) return { score: 0, level: 'Low', message: 'No data yet.' };

    let weightedSum = 0;
    
    checkIns.forEach(c => {
        const primary = c.emotions.find(e => e.isPrimary);
        if (!primary) return;
        
        // Ring Index: 0 (Centre/Root), 1 (Middle), 2 (Outer/Leaf)
        // We map this to points: Root=1, Mid=2, Leaf=3
        const points = primary.ringIndex + 1; 
        weightedSum += points;
    });

    const averageDepth = weightedSum / checkIns.length; 
    // Max depth is 3. Normalized score 0-100.
    // 1.0 -> 0, 3.0 -> 100.
    const normalizedScore = Math.max(0, Math.min(100, ((averageDepth - 1) / 2) * 100));
    
    let level: GranularityScore['level'] = 'Low';
    let message = "Try to drill down deeper into the wheel to identify specific feelings.";
    
    if (normalizedScore > 80) {
        level = 'Very High';
        message = "Excellent! You are identifying nuanced emotions with high precision.";
    } else if (normalizedScore > 50) {
        level = 'High';
        message = "Great job. You often look beyond the surface level emotions.";
    } else if (normalizedScore > 20) {
        level = 'Moderate';
        message = "Good start. Try to tap the outer rings of the wheel more often.";
    }

    return {
        score: Math.round(normalizedScore),
        level,
        message
    };
};

export const calculateRadarData = (checkIns: CheckIn[], settings: AppSettings) => {
    const allScales = [...DEFAULT_SCALES, ...settings.customScales];
    const activeScales = allScales.filter(s => settings.enabledScales.includes(s.id));
    
    const emotionScaleSums: Record<string, Record<string, number>> = {};
    const emotionCounts: Record<string, number> = {};

    checkIns.forEach(c => {
        const primary = c.emotions.find(e => e.isPrimary);
        if (!primary) return;
        
        const root = getEmotionPath(primary.nodeId)[0]?.label;
        if (!root) return;

        if (!emotionScaleSums[root]) { 
            emotionScaleSums[root] = {}; 
            activeScales.forEach(s => emotionScaleSums[root][s.id] = 0); 
            emotionCounts[root] = 0; 
        }
        
        emotionCounts[root]++;
        activeScales.forEach(s => { 
            const val = c.scaleValues[s.id] ?? s.defaultValue; 
            emotionScaleSums[root][s.id] += val; 
        });
    });

    return {
        radarData: Object.entries(emotionScaleSums).map(([emotion, sums]) => {
            const count = emotionCounts[emotion];
            const point: any = { emotion, fullMark: 5 };
            activeScales.forEach(s => point[s.label] = (sums[s.id] / count).toFixed(1));
            return point;
        }).slice(0, 5),
        activeScales
    };
};

export const calculateHeatmapData = (checkIns: CheckIn[]) => {
    const timeBlocks = ['Night', 'Mrng', 'Aftn', 'Eve'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const heatmapGrid = Array.from({ length: 7 }, () => Array(4).fill(0));
    
    let maxHeat = 1;
    checkIns.forEach(c => {
        const d = new Date(c.timestamp);
        const dayIdx = d.getDay();
        const hour = d.getHours();
        const blockIdx = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
        
        heatmapGrid[dayIdx][blockIdx]++;
        if (heatmapGrid[dayIdx][blockIdx] > maxHeat) maxHeat = heatmapGrid[dayIdx][blockIdx];
    });

    return { grid: heatmapGrid, max: maxHeat, labels: timeBlocks, days };
};
