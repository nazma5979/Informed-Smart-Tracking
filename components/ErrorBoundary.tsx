
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Trash2, Save } from 'lucide-react';
import { db } from '../services/db';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleEmergencyBackup = async () => {
    try {
        const json = await db.exportData();
        const blob = new Blob([json], {type: "application/json"});
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `mood-patterns-emergency-backup-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert("Backup saved to Downloads.");
    } catch (e) {
        alert("Emergency backup failed. The database might be corrupted.");
    }
  };

  private handleHardReset = async () => {
    if (window.confirm("This will permanently clear all local data. Have you tried saving a backup first?")) {
        try {
            await db.clearData();
            window.location.reload();
        } catch (e) {
            alert("Could not clear data. Please clear browser cache manually.");
        }
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full space-y-6">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertTriangle size={36} />
            </div>
            
            <div className="space-y-2">
                <h1 className="text-2xl font-black text-slate-900">Don't Panic</h1>
                <p className="text-slate-500 text-sm leading-relaxed">
                    We encountered an unexpected issue. Your data is likely safe, but the app needs to restart.
                </p>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-xl text-left border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Technical Details</p>
                <code className="text-xs text-slate-600 block overflow-auto max-h-24 font-mono break-all">
                    {this.state.error?.message || "Unknown Error"}
                </code>
            </div>

            <div className="space-y-3 pt-2">
                <button 
                    onClick={this.handleReload}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 active:scale-95"
                >
                    <RefreshCcw size={18} />
                    Try Again
                </button>
                
                <button 
                    onClick={this.handleEmergencyBackup}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 py-3 rounded-xl font-bold hover:bg-emerald-100 transition-colors border border-emerald-100 active:scale-95"
                >
                    <Save size={18} />
                    Emergency Backup
                </button>
                
                <button 
                    onClick={this.handleHardReset}
                    className="w-full flex items-center justify-center gap-2 text-rose-500 py-3 rounded-xl font-bold hover:bg-rose-50 transition-colors text-xs mt-4"
                >
                    <Trash2 size={14} />
                    Clear Data & Reset
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
