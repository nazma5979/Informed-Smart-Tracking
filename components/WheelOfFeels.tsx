
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { getChildren } from '../constants';
import { FeelingNode } from '../types';
import { ArrowLeft, Check, RotateCw, MousePointerClick, CircleDot, ChevronRight, ChevronLeft } from 'lucide-react';
import { Haptics } from '../utils/haptics';

interface WheelOfFeelsProps {
  selectedIds: string[];
  primaryId: string | null;
  onToggle: (nodeId: string) => void;
  history: FeelingNode[];
  onHistoryChange: (newHistory: FeelingNode[]) => void;
  width?: number;
  height?: number;
  className?: string;
}

// Math helpers for SVG arcs
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const describeArc = (x: number, y: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, outerRadius, endAngle);
  const end = polarToCartesian(x, y, outerRadius, startAngle);
  const innerStart = polarToCartesian(x, y, innerRadius, endAngle);
  const innerEnd = polarToCartesian(x, y, innerRadius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  const d = [
    "M", start.x, start.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 0, end.x, end.y,
    "L", innerEnd.x, innerEnd.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
    "Z"
  ].join(" ");

  return d;
};

// Robust normalization for negative angles
const normalizeAngle = (angle: number) => {
    let a = angle % 360;
    if (a < 0) a += 360;
    return a;
};

const WheelOfFeels: React.FC<WheelOfFeelsProps> = ({ selectedIds, primaryId, onToggle, history, onHistoryChange, width = 320, height = 320, className = '' }) => {
  const [rotationOffset, setRotationOffset] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  
  // Interaction State
  const [interactingSliceId, setInteractingSliceId] = useState<string | null>(null);

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const rectCache = useRef<DOMRect | null>(null); // Optimization: Cache rect during drag
  
  // Gesture Refs
  const gestureStart = useRef<{ x: number, y: number } | null>(null);
  const gestureMode = useRef<'IDLE' | 'ROTATE' | 'SWIPE'>('IDLE');
  const dragStartAngle = useRef(0);
  const lastRotation = useRef(0);
  const lastHapticAngle = useRef(0);
  const hasMoved = useRef(false);

  const currentParent = history.length > 0 ? history[history.length - 1] : null;
  
  const visibleEmotions = useMemo(() => {
    return getChildren(currentParent ? currentParent.id : null);
  }, [currentParent]);

  // Handle resize to invalidate rect cache
  useEffect(() => {
      const handleResize = () => { rectCache.current = null; };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Navigation Helpers ---

  const handleDrillDown = (node: FeelingNode) => {
      if (getChildren(node.id).length > 0) {
          Haptics.medium(); // Tactile thud for entering a new level
          onHistoryChange([...history, node]);
          setRotationOffset(0); 
          lastRotation.current = 0;
          setSwipeX(0);
          return true;
      }
      return false;
  };

  const handleBack = () => {
    if (history.length === 0) return;
    Haptics.medium();
    onHistoryChange(history.slice(0, -1));
    setRotationOffset(0);
    lastRotation.current = 0;
    setSwipeX(0);
  };

  // --- Gesture Logic (Unified) ---

  const getPointerAngle = (e: React.PointerEvent | PointerEvent) => {
      if (!svgRef.current) return 0;
      if (!rectCache.current) rectCache.current = svgRef.current.getBoundingClientRect();
      const rect = rectCache.current!;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const x = e.clientX - centerX;
      const y = e.clientY - centerY;
      return Math.atan2(y, x) * (180 / Math.PI);
  };

  const handlePointerDown = (e: React.PointerEvent, sliceId: string | null) => {
      // Prevent default touch actions to avoid browser scroll interference
      if (svgRef.current) rectCache.current = svgRef.current.getBoundingClientRect();
      
      gestureStart.current = { x: e.clientX, y: e.clientY };
      gestureMode.current = 'IDLE';
      hasMoved.current = false;
      
      dragStartAngle.current = getPointerAngle(e);
      lastRotation.current = rotationOffset;
      
      setInteractingSliceId(sliceId);
      (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!gestureStart.current) return;

      const dx = e.clientX - gestureStart.current.x;
      const dy = e.clientY - gestureStart.current.y;
      
      // 1. Determine Mode if IDLE
      if (gestureMode.current === 'IDLE') {
          const moveDist = Math.sqrt(dx * dx + dy * dy);
          if (moveDist > 10) {
              // Swipe detection: Horizontal dominant
              if (Math.abs(dx) > Math.abs(dy) * 1.5) {
                  gestureMode.current = 'SWIPE';
              } else {
                  gestureMode.current = 'ROTATE';
              }
          }
      }

      // 2. Execute Mode
      if (gestureMode.current === 'SWIPE') {
          setSwipeX(dx);
          // Haptic tick on threshold cross
          if (Math.abs(dx) > 80 && !hasMoved.current) {
              Haptics.light();
              hasMoved.current = true; // using hasMoved as a trigger flag here
          }
      } else if (gestureMode.current === 'ROTATE') {
          const currentAngle = getPointerAngle(e);
          const rotDelta = currentAngle - dragStartAngle.current;
          const newRot = lastRotation.current + rotDelta;
          
          setRotationOffset(newRot);
          hasMoved.current = true;

          if (Math.abs(newRot - lastHapticAngle.current) > 15) {
              Haptics.tick();
              lastHapticAngle.current = newRot;
          }
      }
  };

  const handlePointerUp = (e: React.PointerEvent, slice: FeelingNode | null) => {
      (e.target as Element).releasePointerCapture(e.pointerId);
      
      if (gestureMode.current === 'SWIPE') {
          // Threshold to trigger action
          if (swipeX > 100) {
              // Right Swipe -> Back
              handleBack();
          } else if (swipeX < -100) {
              // Left Swipe -> Forward
              // Only go forward if there is exactly one selected child, or if the interacting slice has children
              const selectedChildren = visibleEmotions.filter(em => selectedIds.includes(em.id));
              
              let target: FeelingNode | undefined;
              // Priority 1: The slice user started swiping on
              if (slice && getChildren(slice.id).length > 0) {
                  target = slice;
              }
              // Priority 2: The single selected slice
              else if (selectedChildren.length === 1 && getChildren(selectedChildren[0].id).length > 0) {
                  target = selectedChildren[0];
              }

              if (target) {
                  handleDrillDown(target);
              } else {
                  // Bounce back
                  setSwipeX(0);
              }
          } else {
              // Reset
              setSwipeX(0);
          }
      } 
      else if (gestureMode.current === 'ROTATE') {
          // Just end rotation
      }
      else {
          // Click / Tap (No significant movement)
          if (slice) {
              const hasChildren = getChildren(slice.id).length > 0;
              if (hasChildren) {
                  handleDrillDown(slice);
              } else {
                  Haptics.light();
                  onToggle(slice.id);
              }
          } else {
               // Clicked background -> Back
               handleBack();
          }
      }

      // Cleanup
      gestureStart.current = null;
      if (gestureMode.current !== 'SWIPE') setSwipeX(0); // Ensure reset
      gestureMode.current = 'IDLE';
      setInteractingSliceId(null);
      rectCache.current = null;
  };

  // --- Keyboard Accessibility ---
  const handleKeyDown = (e: React.KeyboardEvent, emotion?: FeelingNode) => {
      if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (emotion) {
              if (getChildren(emotion.id).length > 0) {
                  handleDrillDown(emotion);
              } else {
                  Haptics.light();
                  onToggle(emotion.id);
              }
          } else if (currentParent) {
              Haptics.light();
              onToggle(currentParent.id);
          }
      }
      if (e.key === 'Escape' && history.length > 0) {
          handleBack();
      }
  };

  const handleCenterClick = (e: React.PointerEvent) => {
      e.stopPropagation();
      if (currentParent) {
          Haptics.light();
          onToggle(currentParent.id);
      }
  };

  // Wheel Dimensions
  const size = Math.min(width, height);
  const center = size / 2;
  const outerRadius = size / 2 - 10; 
  const innerRadius = size * 0.25; 
  const totalSlices = visibleEmotions.length;
  const anglePerSlice = 360 / totalSlices;

  if (visibleEmotions.length === 0) {
    return <div className="text-center text-secondary p-10">No emotions found in this category.</div>;
  }

  return (
    <div 
        className={`relative flex flex-col items-center justify-center select-none ${className}`} 
        style={{ touchAction: 'none' }} // Critical for custom gestures
    >
      {history.length > 0 && (
        <button 
          onClick={handleBack}
          className="absolute top-0 left-0 p-2.5 rounded-full bg-card/90 backdrop-blur-sm shadow-sm border border-theme hover:bg-accent-light hover:text-accent transition-colors z-30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-accent)]"
          aria-label="Zoom Out"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      
      {/* Swipe Feedback Icons */}
      {Math.abs(swipeX) > 30 && (
          <div className={`absolute top-1/2 -translate-y-1/2 z-0 transition-opacity duration-300 ${Math.abs(swipeX) > 80 ? 'opacity-100' : 'opacity-40'}`}
               style={{ 
                   left: swipeX > 0 ? '1rem' : 'auto', 
                   right: swipeX < 0 ? '1rem' : 'auto',
               }}
          >
              <div className="bg-black/10 p-3 rounded-full backdrop-blur-md">
                  {swipeX > 0 ? <ArrowLeft size={32} className="text-primary" /> : <ChevronRight size={32} className="text-primary" />}
              </div>
          </div>
      )}

      <div 
          className="relative transition-transform duration-75 ease-out will-change-transform" 
          style={{ width: size, height: size, transform: `translateX(${swipeX}px)` }}
      >
        <svg 
            ref={svgRef}
            width={size} 
            height={size} 
            viewBox={`0 0 ${size} ${size}`} 
            className={`transform drop-shadow-sm touch-none ${interactingSliceId ? 'cursor-grabbing' : 'cursor-grab'}`}
            onPointerDown={(e) => handlePointerDown(e, null)}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUp(e, null)}
            style={{ touchAction: 'none' }}
        >
          <defs>
             <radialGradient id="sliceGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="30%" stopColor="white" stopOpacity="0.1" />
                <stop offset="100%" stopColor="black" stopOpacity="0.05" />
             </radialGradient>
          </defs>
          <g key={currentParent ? currentParent.id : 'root'} className="animate-wheel-enter" style={{ willChange: 'transform, opacity', transformOrigin: 'center' }}>
            {visibleEmotions.map((emotion, index) => {
              const startAngle = (index * anglePerSlice) + rotationOffset;
              const endAngle = startAngle + anglePerSlice;
              const path = describeArc(center, center, innerRadius + 5, outerRadius, startAngle, endAngle);
              
              const rawMidAngle = startAngle + (anglePerSlice / 2);
              const midAngle = normalizeAngle(rawMidAngle);
              const textRadius = innerRadius + (outerRadius - innerRadius) / 2;
              const textPos = polarToCartesian(center, center, textRadius, rawMidAngle);
              
              let textRotation = midAngle - 90;
              if (midAngle > 180) textRotation += 180;

              const isSelected = selectedIds.includes(emotion.id);
              const isInteracting = interactingSliceId === emotion.id;
              const hasChildren = getChildren(emotion.id).length > 0;

              let fill = 'var(--text-on-slice)';
              if (isSelected) fill = 'var(--text-primary)';
              else if (emotion.textColor) fill = emotion.textColor;

              return (
                <g 
                    key={emotion.id} 
                    className="origin-center focus:outline-none"
                    style={{ 
                        transform: isInteracting ? 'scale(0.96)' : 'scale(1)',
                        transition: 'transform 100ms ease-out'
                    }}
                    onPointerDown={(e) => handlePointerDown(e, emotion.id)} // Pass ID to differentiate
                    onPointerMove={handlePointerMove}
                    onPointerUp={(e) => handlePointerUp(e, emotion)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${emotion.label}, ${isSelected ? 'selected' : 'unselected'}`}
                    onKeyDown={(e) => handleKeyDown(e, emotion)}
                >
                  <path 
                    d={path} 
                    fill={emotion.color || '#ccc'} 
                    stroke="white" 
                    strokeWidth={isSelected ? "3" : "1.5"}
                    className={`transition-colors duration-200 ${isSelected ? 'brightness-90' : ''} outline-none focus-visible:stroke-[var(--color-accent)] focus-visible:stroke-4 focus-visible:z-10`}
                    style={{ stroke: isSelected ? 'var(--text-primary)' : 'var(--bg-card)' }} 
                  />
                  <path d={path} fill="url(#sliceGradient)" className="pointer-events-none" style={{ mixBlendMode: 'overlay' }} />
                  
                  <text
                    x={textPos.x}
                    y={textPos.y}
                    fill={fill}
                    fontSize={hasChildren ? "13" : "12"}
                    fontWeight={hasChildren ? "800" : "600"}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${textRotation}, ${textPos.x}, ${textPos.y})`}
                    className="pointer-events-none select-none uppercase tracking-tight"
                    style={{ fontFamily: 'system-ui' }} 
                  >
                    {emotion.label}
                  </text>
                  
                  {isSelected && !hasChildren && (
                     <circle cx={textPos.x} cy={textPos.y + 14} r="3" fill="var(--text-primary)" transform={`rotate(${textRotation}, ${textPos.x}, ${textPos.y})`} />
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Center Hub */}
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all shadow-sm border-4 z-20 overflow-hidden cursor-pointer focus:outline-none focus:ring-4 focus:ring-[var(--color-accent)] ${
              currentParent && selectedIds.includes(currentParent.id) 
              ? 'border-[var(--color-accent)] bg-white' 
              : 'bg-white border-slate-100'
          }`}
          style={{ width: innerRadius * 2, height: innerRadius * 2 }}
          onPointerDown={handleCenterClick}
          role="button"
          tabIndex={0}
        >
          <div className="relative text-center p-1 flex flex-col items-center justify-center h-full w-full pointer-events-none">
             {currentParent ? (
               <>
                <div className="text-[10px] text-secondary font-bold mb-0.5 uppercase tracking-wider">
                    {selectedIds.includes(currentParent.id) ? 'Selected' : 'Current'}
                </div>
                <div 
                    className="text-sm font-black leading-tight break-words px-2 line-clamp-2" 
                    style={{ color: currentParent.color || 'var(--text-primary)' }}
                >
                    {currentParent.label}
                </div>
                {selectedIds.includes(currentParent.id) && (
                    <Check size={14} className="text-emerald-500 mt-1" strokeWidth={3} />
                )}
               </>
             ) : (
               <div className="text-slate-400">
                 <div className="text-[9px] uppercase tracking-wider font-bold opacity-70">Mood</div>
                 <div className="text-sm font-bold text-slate-600">Patterns</div>
               </div>
             )}
          </div>
        </div>
      </div>
      
      {/* Hints */}
      <div className="mt-6 text-center h-12 px-4 w-full max-w-xs">
         <div className="flex flex-col items-center opacity-80 transition-opacity duration-300">
             {currentParent ? (
                  getChildren(currentParent.id).length > 0 ? (
                    <div className="flex items-center gap-2 text-xs font-medium text-secondary bg-card/50 px-3 py-1 rounded-full border border-theme">
                        <div className="flex gap-1">
                            <ChevronLeft size={14} />
                            <ChevronRight size={14} />
                        </div>
                        <span>Swipe to nav • Tap slice to expand</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-medium text-secondary bg-card/50 px-3 py-1 rounded-full border border-theme">
                        <MousePointerClick size={14} />
                        <span>Tap to select</span>
                    </div>
                  )
             ) : (
                <div className="flex items-center gap-2 text-xs font-medium text-secondary bg-card/50 px-3 py-1 rounded-full border border-theme">
                    <RotateCw size={14} />
                    <span>Drag to rotate • Tap to expand</span>
                </div>
             )}
         </div>
      </div>
    </div>
  );
};

export default React.memo(WheelOfFeels);
