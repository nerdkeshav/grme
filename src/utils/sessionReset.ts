import { supabase } from './supabaseClient';
import { cleanAndRotateAuthStorage, forceCleanAllTokens } from './supabaseClient';

/**
 * Reset session data to fix common connection issues
 * This can be called when a user is having connection problems
 * 
 * @param keepAuth If true, keeps auth session data (default: true)
 * @returns Promise<boolean> True if successful
 */
export async function resetUserSession(keepAuth = true): Promise<boolean> {
  try {
    // Use the more aggressive approach for complete reset
    if (!keepAuth) {
      console.log('Performing complete session reset');
      await forceCleanAllTokens();
      return true;
    }
    
    // Try more careful approach that preserves authentication
    console.log('Performing targeted session reset (preserving auth)');
    
    // Clear problematic connection state first
    const connectionKeys = Object.keys(localStorage).filter(key => 
      key.includes('connection') || 
      key.includes('health') ||
      key.includes('status') ||
      key.includes('state')
    );
    
    connectionKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Then use the auth rotation approach to clean up auth tokens
    const result = cleanAndRotateAuthStorage();
    
    return result;
  } catch (error) {
    console.error('Error resetting user session:', error);
    return false;
  }
}

/**
 * Nuclear option: Completely reset the user's session, logging them out
 * Use this as a last resort for persistent connection issues
 */
export async function fullSessionReset(): Promise<void> {
  try {
    console.log('NUCLEAR OPTION: Performing complete data reset');
    
    // Try to sign out first to help clear auth tokens
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error during sign out (continuing with reset):', e);
    }
    
    // Clear all cookies that might be related to the app
    try {
      document.cookie.split(';').forEach(function(c) {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });
      console.log('Cleared cookies');
    } catch (e) {
      console.error('Error clearing cookies:', e);
    }
    
    // Clear all indexedDB databases
    try {
      const clearDatabases = async () => {
        const dbs = await window.indexedDB.databases();
        dbs.forEach(db => {
          if (db.name) {
            try {
              window.indexedDB.deleteDatabase(db.name);
            } catch (err) {
              console.error(`Failed to delete indexedDB ${db.name}:`, err);
            }
          }
        });
      };
      
      try {
        await clearDatabases();
        console.log('Cleared indexedDB databases');
      } catch (idbError) {
        console.error('Error listing/clearing indexedDB databases:', idbError);
      }
    } catch (e) {
      console.error('Error accessing indexedDB API:', e);
    }
    
    // Clear sessionStorage
    try {
      sessionStorage.clear();
      console.log('Cleared sessionStorage');
    } catch (e) {
      console.error('Error clearing sessionStorage:', e);
    }
    
    // Clear all localStorage - do this last
    try {
      localStorage.clear();
      console.log('Cleared localStorage');
    } catch (e) {
      console.error('Error clearing localStorage:', e);
    }
    
    // Add a timestamp flag to URL to break any cache
    const clearCacheUrl = window.location.pathname + `?fresh=true&t=${Date.now()}`;
    console.log('Reloading with fresh URL to clear any cached state');
    
    // Force reload the page to start completely fresh
    window.location.href = clearCacheUrl;
  } catch (e) {
    console.error('Error in full session reset:', e);
    
    // Try to reload anyway with cache busting
    window.location.href = window.location.pathname + `?force_reset=true&t=${Date.now()}`;
  }
}

export default {
  resetUserSession,
  fullSessionReset
}; 