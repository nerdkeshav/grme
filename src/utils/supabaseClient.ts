import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';
import { enhancedFetch } from './connectionMiddleware';

// Get Supabase credentials from environment variables with fallback to hardcoded values
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ghspfcpkmvasswohlwjc.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdoc3BmY3BrbXZhc3N3b2hsd2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMDk5NTcsImV4cCI6MjA2MjY4NTk1N30.kNoCH4OnFVfTNz6N584GPQP_wNIz9Crs1OwzPyrFkao';

// Debug mode - set to true to see detailed client logs
const DEBUG_MODE = true;

// Image constants
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max file size
export const TARGET_FILE_SIZE = 800 * 1024; // 800KB target size for compression

// Track connection state
let connectionHealthy = true;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 10000; // 10 seconds (reduced from 30s for more frequent checks)
const DEEP_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Create Supabase client
const supabaseOptions: SupabaseClientOptions<"public"> = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit', // Use implicit flow for better OAuth support
    storage: {
      // Create a more resilient storage implementation
      getItem: (key) => {
        try {
          return localStorage.getItem(key);
        } catch (e) {
          console.error('LocalStorage access error:', e);
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
          
          // When setting auth token, record timestamp to help detect stale tokens
          if (key.includes('auth-token')) {
            localStorage.setItem(`${key}-timestamp`, Date.now().toString());
          }
        } catch (e) {
          console.error('LocalStorage write error:', e);
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
          // Also remove timestamp if it exists
          if (key.includes('auth-token')) {
            localStorage.removeItem(`${key}-timestamp`);
          }
        } catch (e) {
          console.error('LocalStorage remove error:', e);
        }
      }
    }
  },
  global: {
    // Use the enhanced fetch with connection monitoring, retries, and recovery
    fetch: enhancedFetch,
    headers: {
      'X-Client-Info': 'GRME-app',
      // Add some headers to help with connection issues
      'Cache-Control': 'no-cache'
    }
  },
  // Use Web Worker for realtime connections to prevent disconnection issues
  realtime: {
    worker: true, // Enable Web Worker for realtime connections
    heartbeatIntervalMs: 15000, // Shorter heartbeat interval (15 seconds)
    params: {
      eventsPerSecond: 2 // Minimal value to reduce WebSocket traffic
    }
  },
  // Increased timeouts to prevent connection issues
  db: {
    schema: 'public',
  }
};

if (DEBUG_MODE) {
  console.log("Initializing Supabase client with:", { 
    url: supabaseUrl,
    keyLength: supabaseAnonKey.length,
    keyStart: supabaseAnonKey.substring(0, 10),
    keyEnd: supabaseAnonKey.substring(supabaseAnonKey.length - 10)
  });
}

// Create the Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

// Function to clean auth error state
const cleanAuthErrorState = () => {
  try {
    // Find and clean up any auth error states in localStorage
    const authErrorKeys = Object.keys(localStorage).filter(key => 
      key.includes('supabase.auth.error') || 
      (key.includes('sb-') && key.includes('-auth-token'))
    );
    
    for (const key of authErrorKeys) {
      const tokenData = localStorage.getItem(key);
      if (tokenData) {
        try {
          const parsed = JSON.parse(tokenData);
          // If there's an error field, remove it
          if (parsed.error) {
            delete parsed.error;
            localStorage.setItem(key, JSON.stringify(parsed));
          }
        } catch (e) {
          console.error('Error parsing auth token:', e);
          // If we can't parse it, it's likely corrupted - remove it
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {
    console.error('Error cleaning auth error state:', e);
  }
};

/**
 * More aggressive cleanup that completely removes all tokens except the most recent
 * This is useful when the app gets into a bad state with multiple conflicting tokens
 */
export const forceCleanAllTokens = async () => {
  try {
    console.log('Starting deep cleansing of all auth tokens and connection state');
    
    // Remove all supabase-related data except the active token
    let currentSession;
    try {
      // Use getSession() in an async context
      const sessionResponse = await supabase.auth.getSession();
      currentSession = sessionResponse.data.session;
    } catch (e) {
      console.error('Could not get current session:', e);
    }
    
    // First collect all keys to remove
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.includes('supabase') || 
      key.includes('sb-') ||
      key.includes('connection') ||
      key.includes('app_') ||
      key.includes('auth') ||
      key.includes('refresh') ||
      key.includes('token')
    );
    
    console.log(`Found ${keysToRemove.length} keys to clean for recovery`);
    
    // Actually remove them
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.error(`Failed to remove key ${key}:`, err);
      }
    });
    
    // Reset connection trackers
    localStorage.setItem('consecutive_connection_failures', '0');
    localStorage.setItem('consecutive_refresh_count', '0');
    localStorage.setItem('last_connection_reset', Date.now().toString());
    
    console.log('Completed deep cleansing of auth storage');
    return true;
  } catch (e) {
    console.error('Error in forceCleanAllTokens:', e);
    return false;
  }
};

/**
 * Comprehensively cleans and rotates auth storage to prevent accumulation
 * of corrupt/stale data that causes connectivity problems
 */
export const cleanAndRotateAuthStorage = () => {
  try {
    // Track duplicate auth tokens - this is often the cause of issues
    const authTokens: Array<{
      key: string;
      expiryTimestamp: number;
      data: any;
    }> = [];
    const keysToRemove: string[] = [];
    const keysToKeep: string[] = [];
    let mostRecentKey: string | null = null;
    let mostRecentTimestamp = 0;
    
    // First pass: identify and collect information about auth storage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      const isAuthKey = 
        key.includes('supabase.auth.token') || 
        (key.includes('sb-') && key.includes('-auth-token'));
      
      if (isAuthKey) {
        try {
          const data = localStorage.getItem(key);
          if (!data) continue;
          
          const parsed = JSON.parse(data);
          
          // Check if this is a valid token with an expiry time
          if (parsed && parsed.expires_at) {
            const expiryTimestamp = parsed.expires_at;
            
            // Keep track of the most recent valid token
            if (expiryTimestamp > mostRecentTimestamp) {
              mostRecentTimestamp = expiryTimestamp;
              mostRecentKey = key;
            }
            
            // Store for duplication analysis
            authTokens.push({
              key,
              expiryTimestamp,
              data: parsed
            });
          } else {
            // No valid expiry, mark for removal
            keysToRemove.push(key);
          }
        } catch (e) {
          // Invalid JSON - corrupted storage
          console.error(`Corrupted storage for key ${key}, will remove`, e);
          keysToRemove.push(key);
        }
      }
      
      // Also identify and remove known problematic connection state keys
      if (key.includes('connection') || 
          key.includes('app_connection') || 
          key.includes('offline')) {
        keysToRemove.push(key);
      }
    }
    
    // If we have multiple auth tokens, keep only the most recent one
    if (authTokens.length > 1) {
      console.warn(`Found ${authTokens.length} auth tokens - cleaning up extras`);
      
      authTokens.forEach(token => {
        if (token.key !== mostRecentKey) {
          keysToRemove.push(token.key);
        } else {
          keysToKeep.push(token.key);
        }
      });
    } else if (authTokens.length === 1) {
      // Only one token, just make sure it has no errors
      keysToKeep.push(authTokens[0].key);
    }
    
    // Remove problematic or duplicate keys
    keysToRemove.forEach(key => {
      console.log(`Removing problematic storage key: ${key}`);
      localStorage.removeItem(key);
    });
    
    // Clean error states from keys we're keeping
    keysToKeep.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (!data) return;
        
        const parsed = JSON.parse(data);
        if (parsed.error) {
          console.log(`Cleaning error state from key: ${key}`);
          delete parsed.error;
          localStorage.setItem(key, JSON.stringify(parsed));
        }
      } catch (e) {
        console.error(`Error cleaning key ${key}:`, e);
      }
    });
    
    // Also remove any session_restored flags which can cause issues
    const sessionRestoredKey = Object.keys(localStorage).find(key => 
      key.includes('supabase.auth.session_restored') ||
      (key.includes('sb-') && key.includes('-session-restored'))
    );
    
    if (sessionRestoredKey) {
      console.log('Removing session_restored flag');
      localStorage.removeItem(sessionRestoredKey);
    }
    
    return keysToRemove.length > 0;
  } catch (e) {
    console.error('Error in cleanAndRotateAuthStorage:', e);
    return false;
  }
};

// Add the function to window for direct access from other components
if (typeof window !== 'undefined') {
  (window as any).cleanAndRotateAuthStorage = cleanAndRotateAuthStorage;
}

// Reset mechanism for handling fresh loads after page refreshes
const handlePageRefresh = () => {
  try {
    // Check if this is likely a page refresh rather than a fresh visit
    const lastVisit = localStorage.getItem('last_page_visit');
    const now = Date.now();
    const isRefresh = lastVisit && (now - parseInt(lastVisit)) < 2000; // Within 2 seconds is likely a refresh
    
    // Record this visit time
    localStorage.setItem('last_page_visit', now.toString());
    
    // Check URL for reset parameter - but don't automatically reset connection
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('reset')) {
        console.log('Reset parameter detected in URL, performing cleanup');
        cleanAndRotateAuthStorage();
        // Remove the reset parameter from the URL
        urlParams.delete('reset');
        const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
        window.history.replaceState({}, document.title, newUrl);
      }
    }
    
    // If this is a page refresh, just log it but don't reset connections
    if (isRefresh) {
      console.log('Page refresh detected, monitoring connection but not resetting');
    } else {
      // Not a refresh, reset the refresh counter
      localStorage.setItem('consecutive_refresh_count', '0');
    }
    
    // Check for tab visibility changes which can cause connection issues
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // Tab becomes visible again, check connection without refreshing the page
          console.log('Tab visibility changed to visible, checking connection');
          // Only check connection, but don't reset it or reload the page
          checkDatabaseHealth().then(({ connected }) => {
            console.log(`Tab visibility change: Database connection is ${connected ? 'healthy' : 'unhealthy'}`);
          });
        }
      });
    }
    
    // Still perform periodic cleanup but don't do it on every page load
    const lastCleaned = localStorage.getItem('last_storage_cleanup');
    const cleanupInterval = 30 * 60 * 1000; // 30 minutes - increased from 5 to reduce frequency
    
    if (!lastCleaned || (now - parseInt(lastCleaned)) > cleanupInterval) {
      console.log('Performing scheduled auth storage cleanup');
      const cleaned = cleanAndRotateAuthStorage();
      if (cleaned) {
        console.log('Auth storage cleaned successfully');
      }
      localStorage.setItem('last_storage_cleanup', now.toString());
    }
    
    // Do deep cleans much less frequently
    const lastDeepClean = localStorage.getItem('last_deep_clean');
    const deepCleanInterval = 24 * 60 * 60 * 1000; // Only once per day
    if (!lastDeepClean || (now - parseInt(lastDeepClean)) > deepCleanInterval) {
      console.log('Performing scheduled deep cleanup');
      forceCleanAllTokens();
      localStorage.setItem('last_deep_clean', now.toString());
    }
  } catch (e) {
    console.error('Error in handlePageRefresh:', e);
  }
};

// Automatic connection recovery
const autoRecoverConnection = async () => {
  const now = Date.now();
  
  // Only check at most once every 10 seconds (reduced from 30s)
  if (now - lastConnectionCheck < CONNECTION_CHECK_INTERVAL) {
    return connectionHealthy;
  }
  
  lastConnectionCheck = now;
  console.log('Running automatic connection check and recovery...');
  
  try {
    const { connected, responseTime } = await checkDatabaseHealth();
    console.log(`Health check result: Connected=${connected}, ResponseTime=${responseTime}ms`);
    
    // If connection was unhealthy but is now recovered, refresh auth state
    if (!connectionHealthy && connected) {
      console.log('Connection recovered, refreshing authentication...');
      
      // Clean any problematic state
      cleanAuthErrorState();
      
      // More thorough cleanup when recovering from an unhealthy state
      cleanAndRotateAuthStorage();
      
      // Refresh session if possible
      try {
        await supabase.auth.refreshSession();
        console.log('Auth session refreshed successfully');
      } catch (e) {
        console.error('Failed to refresh session after recovery:', e);
        
        // If we failed to refresh the session, try a more drastic approach
        // Get the current session before cleaning
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        
        // If we have a session but still can't refresh, do a deep clean and try to recover
        if (session) {
          console.warn('Session exists but refresh failed - attempting deep recovery');
          
          // Store key auth data temporarily
          const userId = session.user?.id;
          
          // Perform aggressive cleanup
          await forceCleanAllTokens();
          
          // Try to restore session from scratch
          try {
            if (userId) {
              console.log('Attempting to restore session for user:', userId);
              // This forces a complete rebuild of the auth state
              await supabase.auth.signOut();
              // The user will need to log in again, but this should fix deep corruption
            }
          } catch (innerErr) {
            console.error('Failed final recovery attempt:', innerErr);
          }
        }
      }
    } else if (!connected && connectionHealthy) {
      // We just went from healthy to unhealthy, try cleanup as a preventative measure
      console.log('Connection became unhealthy, performing preventative cleanup');
      cleanAndRotateAuthStorage();
      
      // Track consecutive failures
      const failCountKey = 'consecutive_connection_failures';
      const failCount = parseInt(localStorage.getItem(failCountKey) || '0') + 1;
      localStorage.setItem(failCountKey, failCount.toString());
      
      // If we've had multiple consecutive failures, try more aggressive cleanup
      if (failCount >= 2) { // Reduced from 3 to 2 for faster recovery
        console.warn(`${failCount} consecutive connection failures - performing deep cleanup`);
        await forceCleanAllTokens();
        localStorage.setItem(failCountKey, '0');
      }
    } else if (connected) {
      // Reset failure counter on successful connection
      localStorage.setItem('consecutive_connection_failures', '0');
    }
    
    connectionHealthy = connected;
    return connected;
  } catch (e) {
    console.error('Error in autoRecoverConnection:', e);
    connectionHealthy = false;
    return false;
  }
};

// Run immediately
if (typeof window !== 'undefined') {
  handlePageRefresh();
  
  // Add event listeners to detect connection issues
  window.addEventListener('online', async () => {
    console.log('Network connection restored, refreshing authentication state...');
    // Reinitialize auth when connection is restored
    try {
      await autoRecoverConnection();
    } catch (e) {
      console.error('Error refreshing auth after reconnect:', e);
    }
  });
  
  // Also reset properly when leaving the page
  window.addEventListener('beforeunload', () => {
    localStorage.setItem('last_page_unload', Date.now().toString());
  });
  
  // Set up periodic health checks
  setInterval(autoRecoverConnection, CONNECTION_CHECK_INTERVAL);
}

// Wrap all Supabase operations that might fail due to connection issues
const withConnectionRecovery = async <T>(
  operation: () => Promise<T>,
  retries = 2
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    // If we have connection or auth errors, try to recover
    if (
      error.message?.includes('network') ||
      error.message?.includes('authentication') ||
      error.message?.includes('timeout') ||
      error.status === 401 ||
      error.status === 403
    ) {
      // Immediately try to clean auth storage
      cleanAndRotateAuthStorage();
      
      if (retries > 0) {
        // Try to recover connection
        await autoRecoverConnection();
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Retry the operation
        return withConnectionRecovery(operation, retries - 1);
      }
    }
    
    // If we can't recover or it's not a connection issue, rethrow
    throw error;
  }
};

// Let's simplify by just using a dynamic proxy to avoid typing issues
export const supabaseWithRecovery = new Proxy(supabase, {
  get(target, prop) {
    // Special case for the 'from' function
    if (prop === 'from') {
      return (table: string) => {
        const queryBuilder = target.from(table);
        return new Proxy(queryBuilder, {
          get(target, method) {
            if (typeof target[method as keyof typeof target] === 'function') {
              return (...args: any[]) => {
                return withConnectionRecovery(() => {
                  const fn = target[method as keyof typeof target] as Function;
                  return fn.apply(target, args);
                });
              };
            }
            return target[method as keyof typeof target];
          }
        });
      };
    }
    
    // Handle auth methods
    if (prop === 'auth') {
      const auth = target.auth;
      return new Proxy(auth, {
        get(target, method) {
          if (typeof target[method as keyof typeof target] === 'function') {
            return (...args: any[]) => {
              return withConnectionRecovery(() => {
                const fn = target[method as keyof typeof target] as Function;
                return fn.apply(target, args);
              });
            };
          }
          return target[method as keyof typeof target];
        }
      });
    }
    
    // Return other properties unmodified
    return target[prop as keyof typeof target];
  }
});

// Health check function
export const checkDatabaseHealth = async (): Promise<{ connected: boolean; responseTime: number }> => {
  try {
    if (DEBUG_MODE) console.log("Starting health check...");
    const startTime = Date.now();
    
    // Add a timeout to the health check to avoid getting stuck
    const timeoutPromise = new Promise<{ connected: boolean; responseTime: number }>((resolve) => {
      setTimeout(() => {
        if (DEBUG_MODE) console.warn('Health check timeout reached');
        resolve({ connected: false, responseTime: Date.now() - startTime });
      }, 10000);
    });

    const checkPromise = new Promise<{ connected: boolean; responseTime: number }>(async (resolve) => {
      try {
        // First try a simple REST API call which is more reliable than auth
        if (DEBUG_MODE) console.log("Checking if REST API is accessible...");
        
        const { data: restData, error: restError } = await supabase
          .from('profiles')
          .select('id')
          .limit(1);
          
        if (restError) {
          if (DEBUG_MODE) console.warn('REST API check failed during health check:', restError);
          
          // Try an auth check as fallback
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.warn('Auth check failed, connection appears to be down:', error);
            resolve({ connected: false, responseTime: Date.now() - startTime });
            return;
          }
          
          // Auth still works but REST failed - might be REST API specific issues
          resolve({ connected: !!data, responseTime: Date.now() - startTime });
          return;
        } else {
          if (DEBUG_MODE) console.log("REST API accessible, profiles query succeeded");
          // If REST API works, we're good to go
          resolve({ connected: true, responseTime: Date.now() - startTime });
          return;
        }
      } catch (err) {
        console.error('Health check promise error:', err);
        resolve({ connected: false, responseTime: Date.now() - startTime });
      }
    });

    return Promise.race([checkPromise, timeoutPromise]);
  } catch (err) {
    console.error('Database health check error:', err);
    return { connected: false, responseTime: 0 };
  }
};

// Storage buckets
export const STORAGE_BUCKETS = {
  PROFILES: 'profiles',
  FACE_RATING_IMAGES: 'face-rating-images',
  PROGRESS_IMAGES: 'progress-images',
  TIPS_IMAGES: 'tips-images',
  DOCUMENTS: 'documents',
};

// Export only one instance
export { supabase }; 