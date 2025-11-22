
import React, { useLayoutEffect, useRef } from 'react';
import { ScreenName } from '../types';
import { LayoutDashboard, PlusCircle, BarChart2, Settings, X, ArrowLeft } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentScreen: ScreenName;
  onNavigate: (screen: ScreenName) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentScreen, onNavigate }) => {
  const mainRef = useRef<HTMLElement>(null);
  const isImmersive = currentScreen === 'CHECK_IN';

  // Scroll Restoration Logic
  useLayoutEffect(() => {
    if (isImmersive) return; // Skip for immersive screens as they handle their own scroll

    const el = mainRef.current;
    if (!el) return;

    // 1. Restore scroll position from sessionStorage
    const key = `scroll_pos_${currentScreen}`;
    const savedPosition = sessionStorage.getItem(key);
    
    if (savedPosition) {
        el.scrollTop = parseInt(savedPosition, 10);
    } else {
        el.scrollTop = 0;
    }

    // 2. Save scroll position on scroll event
    const handleScroll = () => {
       sessionStorage.setItem(key, el.scrollTop.toString());
    };

    el.addEventListener('scroll', handleScroll);

    return () => {
       el.removeEventListener('scroll', handleScroll);
    };
  }, [currentScreen, isImmersive]);
  
  const getTitle = () => {
    switch(currentScreen) {
      case 'SETTINGS': return 'Settings';
      case 'INSIGHTS': return 'Insights';
      case 'CHECK_IN': return 'Check In';
      default: return 'Mood Patterns';
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto shadow-2xl border-x border-[var(--border-color)] transition-colors duration-300" style={{ backgroundColor: 'var(--bg-app)' }}>
      
      {!isImmersive && (
        <header 
            className="flex-none border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center z-20 sticky top-0 bg-card/80 backdrop-blur-md transition-colors duration-300"
        >
            <div className="flex items-center gap-2">
            {currentScreen === 'HOME' ? (
                <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm"
                    style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
                >
                MP
                </div>
            ) : (
                <button onClick={() => onNavigate('HOME')} className="p-1 -ml-2 text-secondary hover:text-primary">
                    <ArrowLeft size={20} />
                </button>
            )}
            <h1 className="text-lg font-bold tracking-tight transition-all" style={{ color: 'var(--text-primary)' }}>
                {getTitle()}
            </h1>
            </div>

            {currentScreen === 'SETTINGS' ? (
            <button 
                onClick={() => window.history.back()} 
                className="p-2 rounded-full transition-colors hover:bg-black/5 text-secondary"
                aria-label="Close Settings"
            >
                <X size={20} />
            </button>
            ) : (
            <button 
                onClick={() => onNavigate('SETTINGS')}
                className={`p-2 rounded-full transition-colors hover:bg-black/5`}
                style={{ 
                    color: 'var(--text-secondary)',
                    backgroundColor: 'transparent'
                }}
                aria-label="Settings"
            >
                <Settings size={20} />
            </button>
            )}
        </header>
      )}

      <main 
        ref={mainRef}
        className={`flex-1 relative ${isImmersive ? 'h-full overflow-hidden' : 'overflow-y-auto overflow-x-hidden scroll-smooth pb-safe'}`}
      >
        <div className={`w-full mx-auto ${isImmersive ? 'h-full' : 'max-w-md min-h-full relative'}`}>
            {children}
        </div>
      </main>

      {(currentScreen === 'HOME' || currentScreen === 'INSIGHTS') && (
        <nav className="flex-none border-t border-[var(--border-color)] bg-card/90 backdrop-blur-md px-8 py-2 flex justify-between items-center z-20 pb-safe safe-area-bottom">
            <button 
              onClick={() => onNavigate('HOME')}
              className={`p-2 flex flex-col items-center gap-0.5 transition-colors ${currentScreen === 'HOME' ? 'text-accent' : 'text-secondary hover:text-primary'}`}
            >
                <LayoutDashboard size={22} strokeWidth={currentScreen === 'HOME' ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Journal</span>
            </button>
            
            <button 
               onClick={() => onNavigate('CHECK_IN')}
               className="mb-6 bg-accent text-accent-fg rounded-full p-3 shadow-xl border-4 border-[var(--bg-app)] hover:scale-105 active:scale-95 transition-all"
               aria-label="New Check-in"
            >
                <PlusCircle size={28} strokeWidth={2.5} />
            </button>

            <button 
              onClick={() => onNavigate('INSIGHTS')}
              className={`p-2 flex flex-col items-center gap-0.5 transition-colors ${currentScreen === 'INSIGHTS' ? 'text-accent' : 'text-secondary hover:text-primary'}`}
            >
                <BarChart2 size={22} strokeWidth={currentScreen === 'INSIGHTS' ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Insights</span>
            </button>
        </nav>
      )}
    </div>
  );
};

export default Layout;
