import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home, Download, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { exportClientOfflineSnapshot } from '../db';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  exportingBackup: boolean;
  backupExported: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    exportingBackup: false,
    backupExported: false,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
    this.setState({ errorInfo });

    // Report error to server resilience endpoint
    try {
      fetch('/api/system/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ReactErrorBoundary',
          message: error.message || 'React render crash',
          stack: (error.stack || '') + '\n' + (errorInfo.componentStack || ''),
          endpoint: window.location.pathname
        })
      }).catch(() => {});
    } catch {}
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  private handleSafeModeReload = () => {
    try {
      // Clear transient modal/nav state without removing database items
      sessionStorage.clear();
      localStorage.removeItem('biashara_active_tab');
      localStorage.removeItem('biashara_modal_open');
    } catch {}
    window.location.href = '/';
  };

  private handleEmergencyExport = async () => {
    this.setState({ exportingBackup: true });
    try {
      // 1. Gather IndexedDB stores
      const clientSnapshot = await exportClientOfflineSnapshot().catch(() => ({ stores: {} }));
      
      // 2. Gather LocalStorage keys
      const localStorageDump: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          localStorageDump[key] = localStorage.getItem(key) || '';
        }
      }

      const emergencyBundle = {
        app: 'BiasharaSasa_Emergency_Crash_Recovery',
        timestamp: new Date().toISOString(),
        error: {
          message: this.state.error?.message,
          stack: this.state.error?.stack
        },
        clientStores: clientSnapshot.stores || {},
        localStorageData: localStorageDump
      };

      const blob = new Blob([JSON.stringify(emergencyBundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `biasharasasa_emergency_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.setState({ backupExported: true });
    } catch (e) {
      console.error('Failed emergency export:', e);
    } finally {
      this.setState({ exportingBackup: false });
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900/95 flex items-center justify-center p-4">
          <div 
            className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-center text-slate-100 transition-all duration-300"
          >
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            
            <h1 className="text-xl sm:text-2xl font-black text-white mb-2">Application Resilience Protection</h1>
            <p className="text-slate-400 text-xs sm:text-sm mb-6 max-w-sm mx-auto leading-relaxed">
              BiasharaSasa intercepted an interface fault. Your database, orders, and offline queue remain protected.
            </p>

            {/* Emergency Backup Card */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 mb-6 text-left">
              <div className="flex items-center gap-3 mb-2">
                <ShieldCheck className="text-emerald-400 shrink-0" size={20} />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Zero Data Loss Protocol</h4>
                  <p className="text-[11px] text-slate-400">Save an emergency recovery backup of your active orders before refreshing.</p>
                </div>
              </div>
              <button
                onClick={this.handleEmergencyExport}
                disabled={this.state.exportingBackup}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md disabled:opacity-50"
              >
                <Download size={14} />
                {this.state.exportingBackup ? 'Securing Data...' : this.state.backupExported ? 'Backup Downloaded ✅' : 'Download Emergency Data Backup'}
              </button>
            </div>

            {/* Technical Detail Collapsible */}
            {this.state.error && (
              <div className="mb-6">
                <button
                  onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                  className="text-xs text-slate-400 hover:text-slate-300 flex items-center justify-center gap-1 mx-auto mb-2"
                >
                  <span>{this.state.showDetails ? 'Hide Error Details' : 'Show Error Details'}</span>
                  {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {this.state.showDetails && (
                  <div className="p-3 bg-black/40 border border-slate-800 rounded-xl text-left overflow-auto max-h-36">
                    <p className="text-red-400 font-mono text-[10px] mb-1 font-bold">Error Message:</p>
                    <code className="text-slate-300 font-mono text-[10px] whitespace-pre-wrap block">
                      {this.state.error.toString()}
                    </code>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all text-sm shadow-lg shadow-blue-900/30"
              >
                <RefreshCcw size={16} />
                Reload Application
              </button>

              <button
                onClick={this.handleSafeModeReload}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 px-6 rounded-xl transition text-xs border border-slate-700"
              >
                <ShieldCheck size={14} />
                Launch in Safe Mode
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white font-semibold py-2 px-6 rounded-xl transition-all text-xs"
              >
                <Home size={14} />
                Return to Dashboard Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

