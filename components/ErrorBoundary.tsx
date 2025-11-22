
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';
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

  private handleHardReset = async () => {
    if (window.confirm("This will clear all local data to fix the crash. Are you sure?")) {
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
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full space-y-6">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
                <p className="text-slate-500 text-sm mt-2">
                    The application encountered an unexpected error.
                </p>
            </div>
            
            <div className="p-3 bg-slate-100 rounded-lg text-left overflow-auto max-h-32 text-xs font-mono text-slate-600">
                {this.state.error?.toString()}
            </div>

            <div className="space-y-3">
                <button 
                    onClick={this.handleReload}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                    <RefreshCcw size={18} />
                    Reload Application
                </button>
                
                <button 
                    onClick={this.handleHardReset}
                    className="w-full flex items-center justify-center gap-2 text-rose-600 py-3 rounded-xl font-bold hover:bg-rose-50 transition-colors text-sm"
                >
                    <Trash2 size={16} />
                    Reset Data (Emergency)
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
