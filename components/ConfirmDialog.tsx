
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onCancel}
      ></div>

      {/* Modal */}
      <div className="relative bg-white rounded-3xl w-full max-w-xs p-6 shadow-2xl transform transition-all scale-100 animate-fade-in-up ring-1 ring-black/5">
        <div className="flex flex-col items-center text-center space-y-4">
          {isDestructive && (
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-2">
              <AlertTriangle size={24} />
            </div>
          )}
          
          <h3 className="text-xl font-black text-slate-900 leading-tight">
            {title}
          </h3>
          
          <p className="text-sm text-slate-500 leading-relaxed">
            {message}
          </p>

          <div className="flex gap-3 w-full mt-4">
            <button
              onClick={onCancel}
              className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-95"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${
                isDestructive 
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
