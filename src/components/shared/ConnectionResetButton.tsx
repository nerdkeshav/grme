import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { resetConnectionState, clearConnectionState } from '../../utils/connectionManager';
import { supabase } from '../../utils/supabaseClient';

interface ConnectionResetButtonProps {
  className?: string;
  buttonText?: string;
  variant?: 'primary' | 'secondary' | 'text';
  size?: 'small' | 'medium' | 'large';
}

/**
 * A button that resets the connection state and refreshes the auth session
 * to fix connection issues without requiring the user to clear browser data
 */
const ConnectionResetButton: React.FC<ConnectionResetButtonProps> = ({
  className = '',
  buttonText = 'Fix Connection',
  variant = 'secondary',
  size = 'medium',
}) => {
  const { refreshProfile } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    setResetSuccess(false);
    
    try {
      // 1. Clear connection state from localStorage
      clearConnectionState();
      
      // 2. Reset connection monitoring
      resetConnectionState();
      
      // 3. Reset Supabase session
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session:', error);
      }
      
      // 4. Refresh profile data
      if (refreshProfile) {
        await refreshProfile();
      }
      
      // 5. Clear any other Supabase-related issues in localStorage
      const authErrorKey = Object.keys(localStorage).find(key => 
        key.includes('supabase.auth.error') || 
        (key.includes('sb-') && key.includes('-auth-token'))
      );
      
      if (authErrorKey) {
        // Don't remove the token, just reset error state
        const token = localStorage.getItem(authErrorKey);
        if (token) {
          try {
            const tokenData = JSON.parse(token);
            // If there's an error field, reset it
            if (tokenData.error) {
              console.log('Resetting auth error state');
              delete tokenData.error;
              localStorage.setItem(authErrorKey, JSON.stringify(tokenData));
            }
          } catch (e) {
            console.error('Error parsing auth token:', e);
          }
        }
      }
      
      setResetSuccess(true);
      
      // After successful reset, display success message for 2 seconds
      setTimeout(() => {
        setResetSuccess(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error resetting connection:', error);
    } finally {
      setIsResetting(false);
    }
  };

  // Determine button classes based on variant and size
  const baseClasses = 'rounded-md font-medium focus:outline-none transition-colors duration-200';
  
  const variantClasses = {
    primary: 'bg-accent text-buttonText hover:bg-accent/90',
    secondary: 'bg-surface-light border border-accent/10 text-text hover:bg-hover',
    text: 'text-accent hover:bg-accent/10',
  };
  
  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-2 text-sm',
    large: 'px-4 py-2 text-base',
  };
  
  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
  
  return (
    <button
      onClick={handleReset}
      disabled={isResetting}
      className={buttonClasses}
    >
      {isResetting ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Resetting...
        </span>
      ) : resetSuccess ? (
        <span className="flex items-center">
          <svg className="-ml-1 mr-2 h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Fixed!
        </span>
      ) : (
        buttonText
      )}
    </button>
  );
};

export default ConnectionResetButton; 