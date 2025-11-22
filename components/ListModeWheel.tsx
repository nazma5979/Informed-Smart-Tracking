
import React from 'react';
import { FEELING_NODES, getChildren } from '../constants';
import { Check, Circle, Dot, ChevronRight } from 'lucide-react';

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
  onSetPrimary: (id: string) => void
}> = ({ nodeId, depth, selectedIds, primaryId, onToggle, onSetPrimary }) => {
  const node = FEELING_NODES[nodeId];
  const children = getChildren(nodeId);
  const isSelected = selectedIds.includes(nodeId);
  const isPrimary = primaryId === nodeId;
  const hasChildren = children.length > 0;

  // Determine color from node or inherit from parent logic if needed (though nodes have colors)
  // Root nodes have explicit colors. Children usually share or drift.
  // We'll use the node.color if available, or fallback.
  const nodeColor = node.color || 'var(--text-secondary)';
  
  // Calculate indentation visual
  const indentClass = depth === 0 ? '' : depth === 1 ? 'ml-4' : 'ml-8';

  return (
    <div className="w-full">
      <button 
        onClick={() => onToggle(nodeId)}
        className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all duration-200 group text-left relative overflow-hidden ${indentClass}`}
        style={{ 
            backgroundColor: isSelected ? 'var(--bg-card)' : 'transparent',
            // We use a colored border on the left to indicate emotion category
            borderLeft: `4px solid ${isSelected ? nodeColor : 'transparent'}`,
            opacity: (depth > 0 && !isSelected) ? 0.9 : 1
        }}
        aria-pressed={isSelected}
        aria-expanded={hasChildren}
      >
        {/* Background highlight for selected state using color-mix for subtlety */}
        {isSelected && (
            <div 
                className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ backgroundColor: nodeColor }}
            ></div>
        )}

        {/* Selection Indicator */}
        <div 
            className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all shrink-0 ${isSelected ? 'scale-110' : 'scale-100'}`}
            style={{
                backgroundColor: isSelected ? nodeColor : 'transparent',
                borderColor: isSelected ? nodeColor : 'var(--text-secondary)',
                opacity: isSelected ? 1 : 0.3
            }}
        >
           {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
        </div>
        
        {/* Label */}
        <div className="flex-1 flex items-center gap-2">
           <span 
            className={`font-medium transition-colors ${depth === 0 ? 'text-base' : 'text-sm'}`}
            style={{ 
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isSelected ? 700 : 400
            }}
           >
            {node.label}
           </span>
           {/* Dot to show it has children if not expanded/obvious */}
           {hasChildren && !isSelected && (
               <ChevronRight size={14} className="text-slate-300" />
           )}
        </div>

        {/* Primary Toggle */}
        {isSelected && (
           <div 
             onClick={(e) => { e.stopPropagation(); onSetPrimary(nodeId); }}
             role="button"
             tabIndex={0}
             onKeyDown={(e) => {
                 if(e.key === 'Enter' || e.key === ' ') {
                     e.stopPropagation();
                     onSetPrimary(nodeId);
                 }
             }}
             className={`p-1.5 rounded-full flex items-center gap-1 transition-colors z-10 hover:bg-black/5`}
             title="Set as primary emotion"
             aria-label={`Set ${node.label} as primary emotion`}
           >
              {isPrimary ? (
                  <Dot size={18} strokeWidth={4} style={{ color: nodeColor }} />
              ) : (
                  <Circle size={18} className="text-slate-300 hover:text-slate-500" />
              )}
           </div>
        )}
      </button>

      {/* Recursive Children */}
      {children.length > 0 && (
        <div className="mb-1">
           {children.map(child => (
             <ListItem 
                key={child.id} 
                nodeId={child.id} 
                depth={depth + 1} 
                selectedIds={selectedIds}
                primaryId={primaryId}
                onToggle={onToggle}
                onSetPrimary={onSetPrimary}
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
    <div className="w-full pb-20 animate-fade-in">
      {rootNodes.map(node => (
        <ListItem 
          key={node.id}
          nodeId={node.id}
          depth={0}
          selectedIds={selectedIds}
          primaryId={primaryId}
          onToggle={onToggle}
          onSetPrimary={onSetPrimary}
        />
      ))}
    </div>
  );
};

export default ListModeWheel;
