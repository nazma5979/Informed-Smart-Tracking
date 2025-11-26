
import React from 'react';
import { Info } from 'lucide-react';

interface InsightCardProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    isEmpty?: boolean;
    emptyMessage?: string;
}

const InsightCard: React.FC<InsightCardProps> = ({ 
    title, 
    icon, 
    children, 
    isEmpty, 
    emptyMessage = "Not enough data yet" 
}) => (
    <div className="bg-card p-5 rounded-3xl border border-theme shadow-sm mb-4 transition-all hover:shadow-md">
        <h3 className="text-sm font-black text-primary mb-6 flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shadow-sm">
                {icon}
            </div>
            {title}
        </h3>
        {isEmpty ? (
            <div className="h-48 flex flex-col items-center justify-center text-center opacity-50 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Info size={24} className="mb-2 text-secondary"/>
                <p className="text-xs font-medium text-secondary">{emptyMessage}</p>
            </div>
        ) : (
            <div className="animate-fade-in">{children}</div>
        )}
    </div>
);

export default InsightCard;
