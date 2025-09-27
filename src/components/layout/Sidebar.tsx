import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
  onPremiumClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose, isMobile = false, onPremiumClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();
  const isAuthenticated = !!user;

  const handleSignOut = async () => {
    console.log('Sidebar: Sign out button clicked');
    try {
      await signOut();
      console.log('Sidebar: Sign out completed');
      
      // Add a short delay before redirecting
      setTimeout(() => {
        // Use hard redirect instead of navigate to ensure a clean reload
        window.location.href = '/login';
      }, 100);
    } catch (error) {
      console.error('Error signing out:', error);
      // If there's an error, still try to redirect to login
      window.location.href = '/login';
    }
  };

  const navItems = [
    {
      path: '/face-rating',
      label: 'Facial Analysis',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
      mobileVisible: true
    },

    {
      path: '/progress',
      label: 'Progress',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      mobileVisible: true
    },
    {
      path: '/search',
      label: 'Search',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
      mobileVisible: true
    },
    {
      path: '/habits',
      label: 'Habits',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      mobileVisible: false
    },
    {
      path: '/tips',
      label: 'Tips',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
        </svg>
      ),
      mobileVisible: false
    },
    {
      path: '/saved-tips',
      label: 'Saved Tips',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
        </svg>
      ),
      mobileVisible: false
    },
    {
      path: '/leaderboard',
      label: 'Leaderboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
        </svg>
      ),
      mobileVisible: true
    },
    {
      path: '/subscription',
      label: 'Subscription',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
        </svg>
      ),
      mobileVisible: false
    },
    {
      path: '/profile',
      label: 'Profile',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      ),
      mobileVisible: true
    },
  ];

  // Admin link that's only shown for admin users
  const adminNavItem = {
    path: '/admin',
    label: 'Admin Panel',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    mobileVisible: true
  };

  // Add this constant for the bug report link
  const reportBugsUrl = "https://docs.google.com/forms/d/e/1FAIpQLScFfljIsGBhMcyyfmyqrc-L2QioMJjGFAPhJZCNWYBhd8PlCw/viewform?usp=dialog"; // Replace with actual URL later

  // For mobile: fixed overlay when sidebar is open
  const mobileOverlayClass = isMobile && isOpen ? 
    "fixed inset-0 bg-black/50 z-40" : "hidden";

  // Sidebar positioning based on device type and state
  const sidebarClass = isMobile
    ? `fixed top-0 left-0 z-50 h-screen w-64 transform transition-transform duration-300 ease-in-out bg-background border-r border-r-accent/10 ${
        isOpen ? 'translate-x-0 shadow-lg' : '-translate-x-full'
      }`
    : 'h-screen w-64 bg-background border-r border-r-accent/10 fixed left-0 top-0';

  // Mobile navigation bar at the bottom
  const mobileNavBar = isMobile ? (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-accent/10 z-40 overflow-hidden shadow-lg">
      <nav className="flex justify-around items-center h-16">
        {navItems.filter(item => item.mobileVisible).map((item) => (
          <Link
            key={item.path}
            to={isAuthenticated ? item.path : '/login'}
            className={`flex flex-col items-center justify-center py-2 px-4 text-white transition-all duration-200 ${
              location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path))
                ? 'text-accent transform scale-110'
                : 'hover:text-accent/80'
            }`}
          >
            {item.icon}
            <span className="text-xs mt-1">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  ) : null;

  // Toggle slider for mobile
  const mobileSlider = (
    <button 
      onClick={onClose}
      className="p-2 rounded-full bg-background border border-accent/10 hover:bg-hover transition-all duration-300 transform hover:scale-105 shadow-lg"
      aria-label="Open menu"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    </button>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && (
        <div 
          className={mobileOverlayClass} 
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile navigation bar */}
      {mobileNavBar}

      {/* Mobile menu button - fixed in top left when sidebar is closed */}
      {isMobile && !isOpen && (
        <div className="fixed top-4 left-4 z-50">
          {mobileSlider}
        </div>
      )}

      {/* Sidebar */}
      <div className={`${sidebarClass} flex flex-col`}>
        <div className="p-6 flex justify-between items-center">
          <Link to="/face-rating" className="text-xl font-bold text-white" style={{ fontSize: 'calc(1.25rem * 1.02)' }}>
            GRME
          </Link>
          
          {/* Close button - mobile only */}
          {isMobile && (
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-hover text-white"
              aria-label="Close menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {loading ? (
          // Show loading state
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse flex space-x-2">
              <div className="h-2 w-2 bg-muted rounded-full"></div>
              <div className="h-2 w-2 bg-muted rounded-full"></div>
              <div className="h-2 w-2 bg-muted rounded-full"></div>
            </div>
          </div>
        ) : (
          <>
            <nav className="flex-1 px-4 mt-6 overflow-y-auto">
              <ul className="space-y-3">
                {navItems.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={isAuthenticated ? item.path : '/login'}
                      className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-white ${!isMobile ? 'text-sm' : 'text-xs'} ${
                        location.pathname === item.path || 
                        (item.path !== '/' && location.pathname.startsWith(item.path))
                          ? 'font-medium bg-hover'
                          : 'hover:bg-hover'
                      }`}
                      style={{ fontSize: !isMobile ? 'calc(0.875rem * 1.02)' : 'calc(0.75rem * 1.02)' }}
                    >
                      <div style={{ transform: 'scale(1.02)' }}>
                        {item.icon}
                      </div>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
                
                {/* Admin Panel Link - Only for admin users */}
                {profile?.is_admin && (
                  <li>
                    <Link
                      to="/admin"
                      className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-white ${!isMobile ? 'text-sm' : 'text-xs'} ${
                        location.pathname === '/admin' ? 'font-medium bg-hover' : 'hover:bg-hover'
                      }`}
                      style={{ fontSize: !isMobile ? 'calc(0.875rem * 1.02)' : 'calc(0.75rem * 1.02)' }}
                    >
                      <div style={{ transform: 'scale(1.02)' }}>
                        {adminNavItem.icon}
                      </div>
                      <span>{adminNavItem.label}</span>
                    </Link>
                  </li>
                )}
                
                {/* Report Bugs Button */}
                <li>
                  <a
                    href={reportBugsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-white hover:bg-hover text-sm"
                    style={{ fontSize: 'calc(0.875rem * 1.02)' }}
                  >
                    <div style={{ transform: 'scale(1.02)' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152 6.06M12 12.75c-2.883 0-5.647.508-8.208 1.44.125 2.104.52 4.136 1.153 6.06M12 12.75a2.25 2.25 0 002.248-2.354M12 12.75a2.25 2.25 0 01-2.248-2.354M12 8.25c.995 0 1.971-.08 2.922-.236.403-.066.74-.358.795-.762a3.778 3.778 0 00-.399-2.25M12 8.25c-.995 0-1.97-.08-2.922-.236-.402-.066-.74-.358-.795-.762a3.734 3.734 0 01.4-2.253M12 8.25a2.25 2.25 0 00-2.248 2.146M12 8.25a2.25 2.25 0 012.248 2.146M8.683 5a6.032 6.032 0 01-1.155-1.002c.07-.63.27-1.222.574-1.747m.581 2.749A3.75 3.75 0 0115.318 5m0 0c.427-.283.815-.62 1.155-.999a4.471 4.471 0 00-.575-1.752M4.921 6a24.048 24.048 0 00-.392 3.314c1.668.546 3.416.914 5.223 1.082M19.08 6c.205 1.08.337 2.187.392 3.314a23.882 23.882 0 01-5.223 1.082" />
                      </svg>
                    </div>
                    <span>Report Bugs</span>
                  </a>
                </li>
              </ul>
            </nav>
            
            {isAuthenticated && (
              <div className="mt-auto py-4 px-4">
                <button 
                  onClick={handleSignOut}
                  className="flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-red-400 hover:bg-hover w-full text-sm"
                  style={{ fontSize: 'calc(0.875rem * 1.02)' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Sidebar; 