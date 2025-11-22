import React from 'react';
import { Star } from 'lucide-react';
import { getEmotionPath } from '../constants';

interface Props {
    selectedNodeIds: string[];
    primaryNodeId: string | null;
    onSetPrimary: (id: string) => void;
    onNavigate: (nodeId: string) => void;
}

const WheelBreadcrumbChips: React.FC<Props> = ({ selectedNodeIds, primaryNodeId, onSetPrimary, onNavigate }) => {
  if (selectedNodeIds.length === 0) return <p className="text-center text-secondary text-sm italic mt-2">Tap the wheel to select...</p>;

  const groups: Record<string, string[]> = {};
  selectedNodeIds.forEach(id => {
      const path = getEmotionPath(id);
      const root = path[0]?.label || 'Other';
      if(!groups[root]) groups[root] = [];
      groups[root].push(id);
  });

  return (
    <div className="flex flex-wrap gap-2 justify-center mt-4 min-h-[3rem] px-2">
      {Object.entries(groups).map(([root, ids]) => (
          <div key={root} className="flex flex-wrap gap-2 justify-center">
              {ids.map(id => {
                const path = getEmotionPath(id);
                const isPrimary = id === primaryNodeId;
                const label = path[path.length-1].label;
                
                return (
                <div
                    key={id}
                    className={`flex items-center text-xs rounded-full border transition-all overflow-hidden shadow-sm pr-1 ${
                    isPrimary 
                    ? 'bg-accent text-accent-fg border-accent shadow-md' 
                    : 'bg-card text-primary border-theme hover:border-slate-400'
                    }`}
                >
                    <button 
                        onClick={() => onSetPrimary(id)}
                        className="pl-2 pr-1.5 py-1.5 hover:opacity-80 border-r border-black/10"
                        title="Set as primary"
                    >
                        {isPrimary ? <Star size={12} fill="currentColor" /> : <Star size={12} className="text-secondary" />}
                    </button>
                    
                    <button 
                        onClick={() => onNavigate(id)} 
                        className="px-3 py-1.5 font-medium hover:underline truncate max-w-[120px]"
                        title={`Go to ${label}`}
                    >
                        {path.length > 1 ? <span className="opacity-60 font-normal mr-1">{root} ›</span> : ''}
                        {label}
                    </button>
                </div>
                );
            })}
          </div>
      ))}
    </div>
  );
};

export default WheelBreadcrumbChips;