
import React from 'react';
import { FEELING_NODES, getChildren } from '../constants';
import { Check, Star, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import { Haptics } from '../utils/haptics';

interface ListModeWheelProps {
  selectedIds: string[];
  primaryId: string | null;
  onToggle: (id: string) => void;
  onSetPrimary: (id: string) => void;
}

const ListItem: React.FC<{ 
  nodeId: string, 
  depth: number,
  selectedIds: string[],
  primaryId: string | null,
  onToggle: (id: string) => void,
  onSetPrimary: (id: string) => void,
  isLastChild: boolean
}> = ({ nodeId, depth, selectedIds, primaryId, onToggle, onSetPrimary, isLastChild }) => {
  const node = FEELING_NODES[nodeId];
  const children = getChildren(nodeId);
  const isSelected = selectedIds.includes(nodeId);
  const isPrimary = primaryId === nodeId;
  const hasChildren = children.length > 0;

  // Use the node's defined color, or fallback to slate
  const nodeColor = node.color || '#64748b';
  
  // Dynamic Styles for Selected State
  const activeStyle = isSelected ? {
      backgroundColor: `color-mix(in srgb, ${nodeColor}, transparent 92%)`,
      borderColor: nodeColor,
  } : {
      backgroundColor: 'transparent',
      borderColor: 'transparent'
  };

  return (
    <div className="relative w-full">
      {/* Hierarchy Connection Lines for Non-Root Items */}
      {depth > 0 && (
        <>
            {/* Vertical Line from parent */}
            <div 
                className="absolute w-px bg-slate-200" 
                style={{ 
                    left: `${(depth - 1) * 24 + 12}px`, 
                    top: 0, 
                    bottom: isLastChild ? '50%' : 0 
                }}
            />
            {/* Horizontal Line to Item */}
            <div 
                className="absolute h-px bg-slate-200" 
                style={{ 
                    left: `${(depth - 1) * 24 + 12}px`, 
                    width: '12px', 
                    top: '50%' 
                }}
            />
        </>
      )}

      <div 
        className={`relative flex items-center justify-between p-3 my-1 rounded-xl border transition-all duration-200 ${isSelected ? 'shadow-sm' : 'hover:bg-slate-50'}`}
        style={{
            marginLeft: `${depth * 24}px`,
            ...activeStyle
        }}
        onClick={() => { Haptics.light(); onToggle(nodeId); }}
      >
        <div className="flex items-center gap-3 flex-1">
            {/* Selection Checkbox/Indicator */}
            <div 
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-current border-current' : 'border-slate-300'}`}
                style={{ color: isSelected ? nodeColor : undefined }}
            >
                {isSelected && <Check size={12} className="text-white" strokeWidth={4} />}
            </div>

            {/* Label */}
            <span 
                className={`text-sm font-medium transition-colors ${isSelected ? 'font-bold' : 'text-slate-600'}`}
                style={{ color: isSelected ? 'var(--text-primary)' : undefined }}
            >
                {node.label}
            </span>
        </div>

        {/* Actions Area */}
        <div className="flex items-center gap-2">
            {/* Primary Toggle (Only show if selected) */}
            {isSelected && (
                <button
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        Haptics.medium();
                        onSetPrimary(nodeId); 
                    }}
                    className={`p-2 rounded-full transition-all flex items-center gap-1.5 text-xs font-bold ${isPrimary ? 'bg-slate-900 text-white shadow-md' : 'bg-white/50 text-slate-500 hover:bg-white border border-transparent hover:border-slate-200'}`}
                >
                    <Star size={14} fill={isPrimary ? "currentColor" : "none"} />
                    {isPrimary && <span>Primary</span>}
                </button>
            )}

            {/* Chevron for children hint (Visual only, as list is always expanded in this view) */}
            {hasChildren && !isSelected && (
                <ChevronRight size={16} className="text-slate-300 opacity-50" />
            )}
        </div>
      </div>

      {/* Recursive Children */}
      {children.length > 0 && (isSelected || depth === 0) && (
        <div className="animate-fade-in">
           {children.map((child, index) => (
             <ListItem 
                key={child.id} 
                nodeId={child.id} 
                depth={depth + 1} 
                selectedIds={selectedIds}
                primaryId={primaryId}
                onToggle={onToggle}
                onSetPrimary={onSetPrimary}
                isLastChild={index === children.length - 1}
             />
           ))}
        </div>
      )}
    </div>
  );
};

const ListModeWheel: React.FC<ListModeWheelProps> = ({ selectedIds, primaryId, onToggle, onSetPrimary }) => {
  const rootNodes = getChildren(null);

  return (
    <div className="w-full pb-20 animate-fade-in space-y-1">
      {rootNodes.map((node, index) => (
        <ListItem 
          key={node.id}
          nodeId={node.id}
          depth={0}
          selectedIds={selectedIds}
          primaryId={primaryId}
          onToggle={onToggle}
          onSetPrimary={onSetPrimary}
          isLastChild={index === rootNodes.length - 1}
        />
      ))}
      
      {selectedIds.length === 0 && (
          <div className="text-center p-8 text-slate-400 text-sm italic">
              Select an emotion to explore details
          </div>
      )}
    </div>
  );
};

export default ListModeWheel;
