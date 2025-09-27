import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NavBar: React.FC = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      console.log('NavBar: Sign out button clicked');
      await signOut();
      console.log('NavBar: Sign out completed');
      
      // Add a short delay before redirecting to ensure everything is cleaned up
      setTimeout(() => {
        // Use hard redirect to ensure a clean reload
        window.location.href = '/login';
      }, 100);
    } catch (error) {
      console.error('Error signing out:', error);
      // If there's an error, still try to redirect to login
      window.location.href = '/login';
    }
  };

  return (
    <nav className="bg-surface py-4 shadow-lg">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-primary">
          GRME
        </Link>
        
        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-sm text-text/70">
              Welcome, {user.email?.split('@')[0]}
            </span>
            <button 
              onClick={handleSignOut}
              className="text-sm px-3 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar; 