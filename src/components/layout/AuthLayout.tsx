import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full bg-surface/80 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <img src="/logo512.png" alt="GRME Logo" className="h-8 w-8 rounded-lg" />
            <span>GRME</span>
          </Link>
          <Link 
            to="/" 
            className="rounded-full border border-accent/30 hover:bg-surface px-4 py-2 text-sm font-medium transition-all duration-300"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        {children}
      </main>

      <footer className="w-full border-t border-accent/20 bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 sm:flex-row justify-between items-center">
            <p className="text-xs text-muted">
              &copy; {new Date().getFullYear()} GRME. All rights reserved.
            </p>
            <div className="flex gap-4 text-xs text-muted">
              <Link to="/privacy-policy" className="hover:text-text transition-colors duration-300">Privacy Policy</Link>
              <Link to="/terms-of-service" className="hover:text-text transition-colors duration-300">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout; 