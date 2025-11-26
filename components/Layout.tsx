
import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { ScreenName } from '../types';
import { LayoutDashboard, PlusCircle, BarChart2, Menu, X, ArrowLeft, Settings, Home, Smile, Plus } from 'lucide-react';
import SlideOutMenu from './SlideOutMenu';
import { Haptics } from '../utils/haptics';

interface LayoutProps {
  children: React.ReactNode;
  currentScreen: ScreenName;
  onNavigate: (screen: ScreenName) => void;
  onBack: () => void;
  onSeedData: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentScreen, onNavigate, onBack, onSeedData }) => {
  const mainRef = useRef<HTMLElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isImmersive = currentScreen === 'CHECK_IN';

  // Gesture State for Edge Swipe
  const touchStartRef = useRef<number | null>(null);
  const touchYRef = useRef<number | null>(null);

  // Scroll Restoration Logic
  useLayoutEffect(() => {
    // We don't restore scroll for immersive views or when switching main contexts abruptly
    if (isImmersive) return;

    const el = mainRef.current;
    if (!el) return;

    const key = `scroll_pos_${currentScreen}`;
    const savedPosition = sessionStorage.getItem(key);
    
    if (savedPosition) {
        el.scrollTop = parseInt(savedPosition, 10);
    } else {
        el.scrollTop = 0;
    }

    const handleScroll = () => {
       sessionStorage.setItem(key, el.scrollTop.toString());
    };

    el.addEventListener('scroll', handleScroll);

    return () => {
       el.removeEventListener('scroll', handleScroll);
    };
  }, [currentScreen, isImmersive]);
  
  // Edge Swipe Logic (One-handed navigation for Mobile)
  useEffect(() => {
    // Only enable edge swipe on sub-screens and on mobile (implied by touch events)
    if (currentScreen === 'HOME') return;

    const handleTouchStart = (e: TouchEvent) => {
        // Start within 30px of left edge
        if (e.touches[0].clientX < 30) {
            touchStartRef.current = e.touches[0].clientX;
            touchYRef.current = e.touches[0].clientY;
        } else {
            touchStartRef.current = null;
        }
    };

    const handleTouchEnd = (e: TouchEvent) => {
        if (touchStartRef.current === null) return;
        
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const diffX = touchEndX - touchStartRef.current;
        const diffY = Math.abs(touchEndY - (touchYRef.current || 0));

        // Horizontal swipe must be dominant and significant (> 80px)
        if (diffX > 80 && diffY < 50) {
            // Trigger Back Navigation
            Haptics.medium();
            onBack();
        }
        
        touchStartRef.current = null;
    };

    // Attach to document to catch edge swipes globally
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentScreen, onBack]);

  const getTitle = () => {
    switch(currentScreen) {
      case 'SETTINGS': return 'Settings';
      case 'INSIGHTS': return 'Insights';
      case 'CHECK_IN': return 'Check In';
      default: return 'Mood Patterns';
    }
  }

  // Helper for Nav Rail Items
  const NavRailItem = ({ screen, icon: Icon, label }: { screen: ScreenName, icon: any, label: string }) => {
      const active = currentScreen === screen;
      return (
        <button 
            onClick={() => onNavigate(screen)}
            className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
        >
            <Icon size={24} strokeWidth={active ? 2.5 : 2} />
            <span className="text-[10px] font-bold">{label}</span>
        </button>
      );
  };

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 text-slate-900 overflow-hidden relative transition-colors duration-300" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      
      {/* MOBILE MENU DRAWER */}
      <SlideOutMenu 
          isOpen={isMenuOpen} 
          onClose={() => setIsMenuOpen(false)} 
          currentScreen={currentScreen} 
          onNavigate={onNavigate}
          onSeedData={onSeedData}
      />

      {/* --- DESKTOP: NAVIGATION RAIL (Visible on md+) --- */}
      <aside className="hidden md:flex flex-col w-24 bg-card border-r border-[var(--border-color)] z-30 items-center py-6 gap-6 shrink-0">
          {/* Brand */}
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl mb-4">
             <Smile size={28} />
          </div>

          <NavRailItem screen="HOME" icon={Home} label="Journal" />
          <NavRailItem screen="INSIGHTS" icon={BarChart2} label="Insights" />
          
          <div className="flex-1"></div>

          <button 
               onClick={() => onNavigate('CHECK_IN')}
               className="bg-accent text-accent-fg rounded-2xl p-4 shadow-xl hover:scale-105 transition-all mb-4"
               title="New Check-in"
            >
                <Plus size={28} strokeWidth={3} />
          </button>

          <NavRailItem screen="SETTINGS" icon={Settings} label="Settings" />
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
          
          {/* MOBILE HEADER (Hidden on Desktop if not sub-screen) */}
          {!isImmersive && (
            <header 
                className="md:hidden flex-none border-b border-[var(--border-color)] px-4 py-3 flex justify-between items-center z-20 sticky top-0 bg-card/80 backdrop-blur-md transition-colors duration-300 pt-safe safe-area-top"
            >
                <div className="flex items-center gap-2">
                {currentScreen === 'HOME' ? (
                    <button 
                        type="button"
                        onClick={() => setIsMenuOpen(true)}
                        className="p-3 -ml-3 rounded-full hover:bg-black/5 text-primary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center active-press"
                        aria-label="Menu"
                    >
                        <Menu size={24} />
                    </button>
                ) : (
                    <button 
                        type="button"
                        onClick={onBack} 
                        className="p-3 -ml-3 text-secondary hover:text-primary min-w-[44px] min-h-[44px] flex items-center justify-center active-press"
                        aria-label="Back"
                    >
                        <ArrowLeft size={24} />
                    </button>
                )}
                <h1 className="text-lg font-bold tracking-tight transition-all" style={{ color: 'var(--text-primary)' }}>
                    {getTitle()}
                </h1>
                </div>

                {currentScreen === 'SETTINGS' ? (
                <button 
                    type="button"
                    onClick={onBack} 
                    className="p-3 -mr-3 rounded-full transition-colors hover:bg-black/5 text-secondary min-w-[44px] min-h-[44px] flex items-center justify-center active-press"
                    aria-label="Close Settings"
                >
                    <X size={24} />
                </button>
                ) : (
                <div className="w-9 h-9"></div>
                )}
            </header>
          )}

          {/* CONTENT SCROLLER */}
          <main 
            ref={mainRef}
            className={`flex-1 relative ${isImmersive ? 'h-full overflow-hidden' : 'overflow-y-auto overflow-x-hidden scroll-smooth pb-safe'}`}
          >
            {/* 
                ADAPTIVE CONTAINER:
                - Mobile: Full width/height (flex-1)
                - Desktop: Centered, Max-Width constrained (max-w-2xl), nice shadow/border 
                - Immersive: Takes full space on mobile, behaves like modal on desktop
            */}
            <div className={`mx-auto transition-all duration-300 ${
                isImmersive 
                ? 'h-full w-full md:max-w-md md:h-[90vh] md:my-[5vh] md:rounded-[2rem] md:shadow-2xl md:overflow-hidden md:border md:border-slate-200' 
                : 'w-full min-h-full max-w-2xl bg-app md:border-x md:border-[var(--border-color)]'
            }`}>
                {children}
            </div>
          </main>

          {/* MOBILE BOTTOM NAVIGATION (Hidden on Desktop) */}
          {(currentScreen === 'HOME' || currentScreen === 'INSIGHTS') && (
            <nav className="md:hidden flex-none border-t border-[var(--border-color)] bg-card/90 backdrop-blur-md px-8 py-2 flex justify-between items-center z-20 pb-safe safe-area-bottom">
                <button 
                type="button"
                onClick={() => onNavigate('HOME')}
                className={`p-2 flex flex-col items-center gap-0.5 transition-colors min-w-[48px] active-press ${currentScreen === 'HOME' ? 'text-accent' : 'text-secondary hover:text-primary'}`}
                >
                    <LayoutDashboard size={22} strokeWidth={currentScreen === 'HOME' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold">Journal</span>
                </button>
                
                <button 
                type="button"
                onClick={() => onNavigate('CHECK_IN')}
                className="mb-6 bg-accent text-accent-fg rounded-full p-3 shadow-xl border-4 border-[var(--bg-app)] hover:scale-105 transition-all min-w-[60px] min-h-[60px] flex items-center justify-center active-press"
                aria-label="New Check-in"
                >
                    <PlusCircle size={30} strokeWidth={2.5} />
                </button>

                <button 
                type="button"
                onClick={() => onNavigate('INSIGHTS')}
                className={`p-2 flex flex-col items-center gap-0.5 transition-colors min-w-[48px] active-press ${currentScreen === 'INSIGHTS' ? 'text-accent' : 'text-secondary hover:text-primary'}`}
                >
                    <BarChart2 size={22} strokeWidth={currentScreen === 'INSIGHTS' ? 2.5 : 2} />
                    <span className="text-[10px] font-bold">Insights</span>
                </button>
            </nav>
          )}
      </div>
    </div>
  );
};

export default Layout;
