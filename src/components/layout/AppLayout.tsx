import React, { ReactNode, useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import useMediaQuery from '../../utils/useMediaQuery';

interface AppLayoutProps {
  children: ReactNode;
  onPremiumClick?: () => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, onPremiumClick }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Close sidebar on mobile when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && sidebarOpen) {
        // Close sidebar if the click is not within the sidebar
        const sidebar = document.getElementById('mobile-sidebar');
        if (sidebar && !sidebar.contains(event.target as Node)) {
          setSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile, sidebarOpen]);

  // Close sidebar when screen size changes from mobile to desktop
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const toggleSidebar = () => {
    setSidebarOpen(prevState => !prevState);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-text">
      {/* Mobile Header */}
      {isMobile && (
        <header className="bg-surface shadow-md fixed top-0 left-0 right-0 z-30 h-16 flex items-center px-5">
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-full hover:bg-hover transition-all duration-200 transform hover:scale-105"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
          <div className="ml-4 text-xl font-bold" style={{ fontSize: 'calc(1.25rem * 1.02)' }}>GRME</div>
        </header>
      )}
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={isMobile ? sidebarOpen : true}
        onClose={isMobile ? toggleSidebar : undefined}
        isMobile={isMobile}
        onPremiumClick={onPremiumClick}
      />
      
      {/* Main Content - adjusted padding for mobile */}
      <main className={`flex-1 transition-all duration-200 ${
        isMobile 
          ? 'pt-20 pb-20 px-5' // Increased top padding for mobile
          : 'ml-64 p-8'        // Increased padding for desktop
      }`}>
        {children}
      </main>
    </div>
  );
};

export default AppLayout; 