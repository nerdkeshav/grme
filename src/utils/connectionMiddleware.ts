import { checkDatabaseHealth } from './supabaseClient';
import { 
  ConnectionState,
  getCurrentConnectionState 
} from './connectionManager';
import { supabase } from './supabaseClient';

// Define the types that match Supabase's internal types
type Fetch = (url: RequestInfo | URL, options?: RequestInit) => Promise<Response>;
type FetchOptions = RequestInit;

// Keep track of current network state
let networkState = {
  isOnline: typeof window !== 'undefined' ? window.navigator.onLine : true,
  lastSuccessfulRequest: Date.now(),
  consecutiveFailures: 0,
  maxConsecutiveFailures: 5,
  backoffDelay: 1000, // Starting backoff delay in milliseconds
};

// Connection status listeners
const networkConnectionListeners: Array<(status: boolean) => void> = [];

// Setup Web Worker for Supabase realtime connections if browser supports it
let realtimeWorker: Worker | null = null;

// Initialize the realtime worker if supported
if (typeof window !== 'undefined' && window.Worker) {
  try {
    // Create a worker from a blob URL to avoid needing a separate file
    const workerCode = `
      // Simple heartbeat mechanism to keep connection alive
      let heartbeatInterval;
      
      self.onmessage = function(e) {
        if (e.data.type === 'start') {
          console.log('[RealtimeWorker] Starting heartbeat');
          // Clear any existing interval
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          
          // Start a new heartbeat interval
          heartbeatInterval = setInterval(() => {
            self.postMessage({ type: 'heartbeat', timestamp: Date.now() });
          }, 20000); // Send heartbeat every 20 seconds
        } else if (e.data.type === 'stop') {
          console.log('[RealtimeWorker] Stopping heartbeat');
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      };
      
      // Send initial ready message
      self.postMessage({ type: 'ready' });
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    realtimeWorker = new Worker(URL.createObjectURL(blob));
    
    realtimeWorker.onmessage = (e) => {
      if (e.data.type === 'ready') {
        console.log('Realtime worker initialized successfully');
        // Start the heartbeat
        realtimeWorker?.postMessage({ type: 'start' });
      } else if (e.data.type === 'heartbeat') {
        // On heartbeat, ensure Supabase realtime connection is active
        if (supabase?.realtime) {
          const state = supabase.realtime.connectionState();
          if (state === 'closed') {
            console.log('[RealtimeWorker] Detected closed connection, reconnecting');
            supabase.realtime.connect();
          }
        }
      }
    };
    
    console.log('Realtime worker setup complete');
  } catch (err) {
    console.error('Failed to initialize realtime worker:', err);
  }
}

// Add a connection status event listener
export const addNetworkConnectionListener = (callback: (status: boolean) => void) => {
  networkConnectionListeners.push(callback);
  // Immediately notify of current state
  callback(networkState.isOnline);
  return () => {
    const index = networkConnectionListeners.indexOf(callback);
    if (index >= 0) {
      networkConnectionListeners.splice(index, 1);
    }
  };
};

// Notify all listeners of connection status change
const notifyConnectionChange = (status: boolean) => {
  networkState.isOnline = status;
  networkConnectionListeners.forEach(listener => {
    try {
      listener(status);
    } catch (err) {
      console.error('Error in connection listener:', err);
    }
  });
};

// Set up online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Browser reports network is back online');
    notifyConnectionChange(true);
  });
  
  window.addEventListener('offline', () => {
    console.log('Browser reports network is offline');
    notifyConnectionChange(false);
  });
}

// Function to perform exponential backoff
const calculateBackoff = (attempt: number): number => {
  // Start with networkState.backoffDelay (default 1000ms)
  // Double it each time, with some randomness to avoid all clients retrying at once
  // Cap at 30 seconds
  const maxBackoff = 30 * 1000;
  const backoff = Math.min(
    networkState.backoffDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4),
    maxBackoff
  );
  return backoff;
};

// Middleware function that enhances the fetch implementation
export const connectionMiddleware = (originalFetch: Fetch): Fetch => {
  return async (url: URL | RequestInfo, options?: FetchOptions): Promise<Response> => {
    // Clone the options object to avoid mutating the original
    const fetchOptions = { ...options };
    
    // Quick check if network is offline according to browser
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      console.warn('Browser reports offline, will attempt request anyway');
    }
    
    // Add cache busting for problematic URLs if we've had recent failures
    if (networkState.consecutiveFailures > 0) {
      // Add or update cache control headers
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      };
      
      // Add cache busting query param for GET requests
      if (!fetchOptions.method || fetchOptions.method === 'GET') {
        const urlObj = new URL(url.toString());
        urlObj.searchParams.append('_cb', Date.now().toString());
        url = urlObj.toString();
      }
    }
    
    // Function to handle retries with exponential backoff
    const attemptFetchWithRetry = async (retryCount = 0): Promise<Response> => {
      try {
        // Attempt the fetch
        const response = await originalFetch(url, fetchOptions);
        
        // Check if the response indicates a server error (5xx)
        if (response.status >= 500 && response.status < 600) {
          if (retryCount < 3) {
            // For server errors, wait and retry
            const backoff = calculateBackoff(retryCount);
            console.warn(`Server error ${response.status}, retrying in ${Math.round(backoff)}ms...`);
            
            return new Promise(resolve => {
              setTimeout(() => {
                resolve(attemptFetchWithRetry(retryCount + 1));
              }, backoff);
            });
          } else {
            console.error(`Maximum retries reached for server error ${response.status}`);
            networkState.consecutiveFailures++;
            
            // If we've had too many consecutive failures, trigger a connection check
            if (networkState.consecutiveFailures >= networkState.maxConsecutiveFailures) {
              console.warn('Too many consecutive failures, checking database health...');
              checkDatabaseHealth().then(result => {
                notifyConnectionChange(result.connected);
              });
            }
            
            return response;
          }
        }
        
        // Check for 403/401 errors which might indicate auth issues
        if (response.status === 403 || response.status === 401) {
          // Log the issue but don't retry auth failures
          const authEndpoint = url.toString().includes('/auth/');
          if (authEndpoint) {
            console.warn(`Authentication endpoint returned ${response.status}, likely invalid credentials`);
          } else {
            console.warn(`Request returned ${response.status}, possible authentication issue`);
          }
          
          // Don't count auth issues as connection failures
          return response;
        }
        
        // For successful responses or non-server errors
        // Reset consecutive failures and record successful request
        networkState.consecutiveFailures = 0;
        networkState.lastSuccessfulRequest = Date.now();
        
        // If we had previously reported offline but got a successful response,
        // notify that we're back online
        if (!networkState.isOnline) {
          notifyConnectionChange(true);
        }
        
        return response;
      } catch (error: any) {
        // Network errors or timeouts
        const isNetworkError = error.name === 'TypeError' && 
                              (error.message.includes('network') || 
                               error.message.includes('fetch'));
        
        const isTimeoutError = error.name === 'AbortError' || 
                              error.message.includes('timeout') ||
                              error.message.includes('aborted');
        
        if ((isNetworkError || isTimeoutError) && retryCount < 3) {
          // Calculate backoff time based on retry count
          const backoff = calculateBackoff(retryCount);
          console.warn(`Network error: ${error.message}, retrying in ${Math.round(backoff)}ms...`);
          
          return new Promise(resolve => {
            setTimeout(() => {
              resolve(attemptFetchWithRetry(retryCount + 1));
            }, backoff);
          });
        }
        
        // If we've exhausted retries or it's not a retriable error
        networkState.consecutiveFailures++;
        
        // If we've had too many consecutive failures, check connection and notify
        if (networkState.consecutiveFailures >= networkState.maxConsecutiveFailures && networkState.isOnline) {
          notifyConnectionChange(false);
          
          // Start a background health check to detect when we're back online
          setTimeout(() => {
            checkDatabaseHealth().then(result => {
              if (result.connected) {
                notifyConnectionChange(true);
              }
            });
          }, 5000);
        }
        
        throw error;
      }
    };
    
    return attemptFetchWithRetry();
  };
};

// Track problematic URLs to avoid hammering them
const problemURLs: Record<string, { count: number; timestamp: number }> = {};

// Add jitter to retry timings to prevent thundering herd problem
const getBackoffWithJitter = (attempt: number): number => {
  const INITIAL_BACKOFF_MS = 300;
  const MAX_BACKOFF_MS = 5000;
  
  const exponentialBackoff = Math.min(
    INITIAL_BACKOFF_MS * Math.pow(1.5, attempt),
    MAX_BACKOFF_MS
  );
  // Add random jitter between 0% and 25% of the current backoff value
  const jitter = Math.random() * 0.25 * exponentialBackoff;
  return exponentialBackoff + jitter;
};

// Function to check and repair connections
export const checkAndRepairConnection = async (): Promise<boolean> => {
  // Prevent multiple simultaneous recovery attempts
  if (isRecoveryInProgress) {
    return getCurrentConnectionState() === ConnectionState.CONNECTED;
  }
  
  isRecoveryInProgress = true;
  
  try {
    // First, check if we're connected
    const currentState = await localCheckConnection();
    const isConnected = currentState === ConnectionState.CONNECTED || currentState === ConnectionState.LIMITED_CONNECTIVITY;
    
    // If we're connected, we're good
    if (isConnected) {
      consecutiveFailures = 0;
      lastSuccessfulConnection = Date.now();
      isRecoveryInProgress = false;
      return true;
    }
    
    // Not connected, increment failure counter
    consecutiveFailures++;
    console.log(`Connection check failed. Consecutive failures: ${consecutiveFailures}`);
    
    // If we have multiple consecutive failures, try to repair the connection
    if (consecutiveFailures >= 2) {
      console.log('Multiple consecutive failures detected, attempting to repair connection...');
      
      try {
        // Try to refresh the session
        const { data, error } = await supabase.auth.refreshSession();
        
        if (data && !error) {
          console.log('Session refreshed successfully');
          const newState = await localCheckConnection();
          const isNowConnected = newState === ConnectionState.CONNECTED || newState === ConnectionState.LIMITED_CONNECTIVITY;
          
          if (isNowConnected) {
            consecutiveFailures = 0;
            lastSuccessfulConnection = Date.now();
            isRecoveryInProgress = false;
    return true;
          }
        }
        
        // If refresh failed and we've been disconnected for a while, try more aggressive measures
        const timeSinceLastSuccess = Date.now() - lastSuccessfulConnection;
        if (timeSinceLastSuccess > 60000) { // 1 minute
          console.log('Connection issues persisting for over a minute, trying more aggressive repair...');
          
          // Reset connection state and clean storage
          localResetConnectionState();
          
          // Try to clear any problematic state
          try {
            // Clear any stored connection error states
            localStorage.removeItem('supabase.auth.token');
            localStorage.removeItem('connection_error_count');
            localStorage.removeItem('consecutive_connection_failures');
            localStorage.removeItem('app_connection_state');
            
            // Clear any Supabase-related items
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.includes('supabase') || key.includes('sb-'))) {
                localStorage.removeItem(key);
              }
            }
          } catch (e) {
            // Ignore errors
          }
          
          // Final check after aggressive repair
          const finalState = await localCheckConnection();
          const isFixedNow = finalState === ConnectionState.CONNECTED || finalState === ConnectionState.LIMITED_CONNECTIVITY;
          
          if (isFixedNow) {
            consecutiveFailures = 0;
            lastSuccessfulConnection = Date.now();
          }
          
          isRecoveryInProgress = false;
          return isFixedNow;
        }
      } catch (error) {
        console.error('Error repairing connection:', error);
      }
    }
    
    isRecoveryInProgress = false;
    return false;
  } catch (error) {
    console.error('Error in checkAndRepairConnection:', error);
    isRecoveryInProgress = false;
    return false;
  }
};

// Export for testing
export const getNetworkState = () => ({ ...networkState });

// Define retry count by error type
const MAX_RETRIES = {
  SERVER_ERROR: 3, // 5xx errors
  CLIENT_ERROR: 1, // 4xx errors
  NETWORK_ERROR: 5, // Network/fetch errors
  TIMEOUT_ERROR: 3, // Timeout errors
};

// Define initial backoff in milliseconds and max backoff
const INITIAL_BACKOFF_MS = 300;
const MAX_BACKOFF_MS = 5000;
const TIMEOUT_MS = 30000; // 30 second timeout

// Enhanced fetch function with retries, timeouts, and recovery
export const enhancedFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString();
  let attempt = 0;
  let lastError: Error | null = null;
  
  // Create a unique key for this URL (without query params to avoid cache poisoning)
  const urlKey = url.split('?')[0];
  
  // Check if this URL has been problematic recently
  if (problemURLs[urlKey]) {
    const { count, timestamp } = problemURLs[urlKey];
    const timeSince = Date.now() - timestamp;
    
    // If we've had many failures recently for this endpoint, 
    // implement a circuit breaker pattern
    if (count > 10 && timeSince < 60000) { // Over 10 failures in last minute
      console.warn(`Circuit breaker active for ${urlKey} - too many recent failures`);
      // Add some randomness to avoid all clients hitting at once when circuit resets
      const randomDelay = Math.floor(Math.random() * 3000);
      await new Promise(r => setTimeout(r, randomDelay));
    }
  }

  // Add cache busting for GET requests to prevent stale responses
  if ((!init?.method || init?.method === 'GET') && typeof input === 'string') {
    try {
      const urlObj = new URL(input);
      // Only add cache busting for Supabase API requests
      if (urlObj.hostname.includes('supabase')) {
        urlObj.searchParams.append('_cb', Date.now().toString());
        input = urlObj.toString();
      }
    } catch (e) {
      // Not a valid URL, keep as is
    }
  }

  // Function to handle retries with backoff
  const fetchWithRetry = async (): Promise<Response> => {
    try {
      // Create a timeout promise to abort long-running requests
      const controller = new AbortController();
      const signal = controller.signal;
      
      // If init doesn't have a signal, add our signal to it
      const fetchInit = init ? { ...init, signal } : { signal };
      
      // Set a timeout to abort the request if it takes too long
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, TIMEOUT_MS);
      
      // Add specific headers to help with connection issues
      if (!fetchInit.headers) {
        fetchInit.headers = {};
      }
      
      // Add a cache-busting parameter for problematic endpoints
      let fetchUrl = url;
      if (problemURLs[urlKey] && problemURLs[urlKey].count > 3) {
        const separator = fetchUrl.includes('?') ? '&' : '?';
        fetchUrl = `${fetchUrl}${separator}_cb=${Date.now()}`;
      }
      
      try {
        // Perform the fetch
        const response = await fetch(fetchUrl, fetchInit);
        
        // Clear the timeout since the request completed
        clearTimeout(timeoutId);
        
        // Reset problem counter on success
        if (problemURLs[urlKey]) {
          problemURLs[urlKey].count = Math.max(0, problemURLs[urlKey].count - 1);
        }
        
        // Handle various HTTP status codes
        if (response.status >= 500) {
          // Server error, retry
          if (attempt < MAX_RETRIES.SERVER_ERROR) {
            attempt++;
            const backoff = getBackoffWithJitter(attempt);
            console.warn(`Server error (${response.status}), retrying in ${backoff}ms, attempt ${attempt}`);
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry();
          }
          
          // Track problem endpoint
          trackProblemURL(urlKey);
        } else if (response.status >= 400) {
          // Client error, generally don't retry except for specific cases
          if (response.status === 429 && attempt < MAX_RETRIES.CLIENT_ERROR) {
            // Rate limited, retry with longer backoff
            attempt++;
            const backoff = getBackoffWithJitter(attempt) * 2; // Double backoff for rate limits
            console.warn(`Rate limited (429), retrying in ${backoff}ms, attempt ${attempt}`);
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry();
          }
          
          // Don't track 4xx errors as problems unless they're 429
          if (response.status === 429) {
            trackProblemURL(urlKey);
          }
        }
        
        return response;
      } catch (error: any) {
        // Clear the timeout
        clearTimeout(timeoutId);
        
        // Handle abort/timeout specifically
        if (error.name === 'AbortError') {
          console.error(`Request timeout after ${TIMEOUT_MS}ms`, fetchUrl);
          lastError = new Error(`Request timed out after ${TIMEOUT_MS}ms`);
          
          if (attempt < MAX_RETRIES.TIMEOUT_ERROR) {
            attempt++;
            const backoff = getBackoffWithJitter(attempt);
            console.warn(`Request timed out, retrying in ${backoff}ms, attempt ${attempt}`);
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry();
          }
          
          trackProblemURL(urlKey);
          throw lastError;
        }
        
        // For network errors (when fetch itself fails), retry with backoff
        if (error instanceof TypeError || error.message?.includes('network')) {
          lastError = error;
          
          if (attempt < MAX_RETRIES.NETWORK_ERROR) {
            attempt++;
            const backoff = getBackoffWithJitter(attempt);
            console.warn(`Network error, retrying in ${backoff}ms, attempt ${attempt}`);
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry();
          }
          
          trackProblemURL(urlKey);
          throw error;
        }
        
        // For other errors
        trackProblemURL(urlKey);
        throw error;
      }
    } catch (error: any) {
      // This catches any errors not caught in the inner try/catch
      lastError = error;
      throw error;
    }
  };
  
  // Track problematic URLs to implement basic circuit breaking
  const trackProblemURL = (url: string) => {
    if (!problemURLs[url]) {
      problemURLs[url] = { count: 0, timestamp: Date.now() };
    }
    
    problemURLs[url].count += 1;
    problemURLs[url].timestamp = Date.now();
    
    // Log if this endpoint is becoming particularly problematic
    if (problemURLs[url].count === 5 || problemURLs[url].count === 10) {
      console.warn(`Endpoint ${url} is experiencing issues (${problemURLs[url].count} failures)`);
    }
  };
  
  // Periodically clean up old problem URL entries (run every 5 minutes)
  const cleanupInterval = 5 * 60 * 1000; // 5 minutes
  if (typeof window !== 'undefined' && !window.cleanupIntervalId) {
    window.cleanupIntervalId = setInterval(() => {
      const now = Date.now();
      Object.keys(problemURLs).forEach(key => {
        if (now - problemURLs[key].timestamp > cleanupInterval) {
          delete problemURLs[key];
        }
      });
    }, cleanupInterval);
  }
  
  // Start the retry process
  return fetchWithRetry();
};

// Improved function to handle tab visibility changes
export const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    console.log('Tab became visible, checking connection state');
    
    // Check connection without forcing a refresh
    checkAndRepairConnection();
    
    // Notify auth context about visibility change without forcing refresh
    try {
      // Reset consecutive failures counter
      networkState.consecutiveFailures = 0;
      
      // Dispatch a custom event that the auth context can listen for
      const event = new CustomEvent('app:visibility-change', { 
        detail: { visible: true, timestamp: Date.now() } 
      });
      document.dispatchEvent(event);
    } catch (err) {
      console.error('Error handling visibility change:', err);
    }
  }
};

// Set up visibility change listener
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Automatically reset connection state after a page refresh
export const resetConnectionAfterRefresh = () => {
  // Immediately check connection on refresh
  checkAndRepairConnection();
  
  // Clear any problematic connection state
  try {
    const keysToReset = [
      'app_connection_state',
      'consecutive_connection_failures',
      'consecutive_refresh_count',
      'connection_error_count'
    ];
    
    keysToReset.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore errors
      }
    });
    
    console.log('Connection state reset after page refresh');
  } catch (e) {
    console.error('Error resetting connection state:', e);
  }
  
  // Set up periodic connection checks
  const checkInterval = setInterval(() => {
    checkAndRepairConnection();
  }, 30000); // Check every 30 seconds
  
  // Store the interval ID in the window object so it can be cleared if needed
  if (typeof window !== 'undefined') {
    window.cleanupIntervalId = checkInterval;
  }
  
  return () => {
    clearInterval(checkInterval);
    if (typeof window !== 'undefined' && window.cleanupIntervalId) {
      delete window.cleanupIntervalId;
    }
  };
};

// Add a type declaration for our custom property on globalThis
declare global {
  interface Window {
    cleanupIntervalId?: NodeJS.Timeout;
  }
}

// Track connection state
let currentConnectionState = ConnectionState.CHECKING;
let appConnectionListeners: ((state: ConnectionState) => void)[] = [];
let connectionCheckInProgress = false;
let consecutiveFailures = 0;
let lastSuccessfulConnection = Date.now();
let isRecoveryInProgress = false;

// Cache-busting function to prevent stale responses
const cacheBustingFetch = async (url: string, options: RequestInit = {}) => {
  // Add cache-busting query parameter for GET requests
  if (!options.method || options.method === 'GET') {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}_=${Date.now()}`;
  }
  
  // Add cache control headers
  const headers = {
    ...options.headers,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
  
  return fetch(url, { ...options, headers });
};

// Check connection to Supabase
export const localCheckConnection = async (): Promise<ConnectionState> => {
  try {
    // Prevent multiple simultaneous checks
    if (connectionCheckInProgress) {
      return currentConnectionState;
    }
    
    connectionCheckInProgress = true;
    
    // Try to get the current session
    const { data, error } = await supabase.auth.getSession();
    
    // If we got data without an error, we're connected
    if (data && !error) {
      updateConnectionState(ConnectionState.CONNECTED);
      consecutiveFailures = 0;
      lastSuccessfulConnection = Date.now();
      connectionCheckInProgress = false;
      return ConnectionState.CONNECTED;
    }
    
    // If we got an error, try a basic health check
    const healthCheck = await checkBasicConnectivity();
    
    if (healthCheck) {
      // We have limited connectivity - can reach API but auth might be having issues
      updateConnectionState(ConnectionState.LIMITED_CONNECTIVITY);
      connectionCheckInProgress = false;
      return ConnectionState.LIMITED_CONNECTIVITY;
    }
    
    // If both checks fail, we're disconnected
    consecutiveFailures++;
    updateConnectionState(ConnectionState.DISCONNECTED);
    connectionCheckInProgress = false;
    return ConnectionState.DISCONNECTED;
  } catch (error) {
    console.error('Error checking connection:', error);
    consecutiveFailures++;
    updateConnectionState(ConnectionState.DISCONNECTED);
    connectionCheckInProgress = false;
    return ConnectionState.DISCONNECTED;
  }
};

// Check basic connectivity to Supabase API
const checkBasicConnectivity = async (): Promise<boolean> => {
  try {
    // Try to reach the Supabase health endpoint
    const response = await cacheBustingFetch(`${process.env.REACT_APP_SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY || '',
      },
    });
    
    return response.status < 500; // Any non-server error response means the API is reachable
  } catch (error) {
    console.error('Error checking basic connectivity:', error);
    return false;
  }
};

// Update connection state and notify listeners
const updateConnectionState = (newState: ConnectionState) => {
  if (newState !== currentConnectionState) {
    console.log(`Connection state changed: ${currentConnectionState} -> ${newState}`);
    currentConnectionState = newState;
    
    // Notify all listeners
    appConnectionListeners.forEach(listener => {
      try {
        listener(newState);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }
};

// Add a connection state listener
export const localAddConnectionStateListener = (listener: (state: ConnectionState) => void) => {
  appConnectionListeners.push(listener);
  
  // Immediately notify the new listener of the current state
  listener(currentConnectionState);
  
  // Return a function to remove the listener
  return () => {
    appConnectionListeners = appConnectionListeners.filter(l => l !== listener);
  };
};

// Add a connection listener that only cares about connected/disconnected
export const localAddConnectionListener = (listener: (isConnected: boolean) => void) => {
  const stateListener = (state: ConnectionState) => {
    const isConnected = state === ConnectionState.CONNECTED || state === ConnectionState.LIMITED_CONNECTIVITY;
    listener(isConnected);
  };
  
  return localAddConnectionStateListener(stateListener);
};

// Reset connection state
export const localResetConnectionState = async () => {
  console.log('Resetting connection state...');
  updateConnectionState(ConnectionState.CHECKING);
  
  // Clear any stored connection error states
  try {
    localStorage.removeItem('connection_error_count');
    localStorage.removeItem('consecutive_connection_failures');
    localStorage.removeItem('app_connection_state');
  } catch (e) {
    // Ignore errors
  }
  
  // Force a fresh connection check
  consecutiveFailures = 0;
  return await localCheckConnection();
};

// Enhanced tab visibility handler
export const setupEnhancedVisibilityHandler = () => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('Tab became visible, checking connection status only');
      
      // Just check connection status without forcing refresh or reconnection
      localCheckConnection().then(state => {
        console.log(`Connection state after tab became visible: ${state}`);
        
        // Only if we're completely disconnected, try to reconnect realtime
        if (state === ConnectionState.DISCONNECTED) {
          console.log('Connection appears disconnected, attempting to reconnect realtime only');
          
          // Ensure realtime worker is running
          if (realtimeWorker) {
            realtimeWorker.postMessage({ type: 'start' });
          }
          
          // Try to reconnect realtime without refreshing session
          reconnectSupabaseRealtime().catch(err => {
            console.error('Error reconnecting realtime:', err);
          });
        }
      });
    }
  });
};

// Set up periodic connection checks
let connectionCheckInterval: NodeJS.Timeout | null = null;

// Start periodic connection checks
export const startConnectionMonitoring = (intervalMs = 30000) => {
  // Stop any existing interval
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
  }
  
  // Initial check
  localCheckConnection();
  
  // Set up interval for periodic checks
  connectionCheckInterval = setInterval(async () => {
    await localCheckConnection();
    
    // If we have too many consecutive failures, try to repair
    if (consecutiveFailures >= 3) {
      checkAndRepairConnection();
    }
  }, intervalMs);
  
  // Set up visibility change listener
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('Tab became visible, checking connection...');
      localCheckConnection();
    }
  });
  
  // Set up online/offline listeners
  window.addEventListener('online', () => {
    console.log('Browser reports online status, checking connection...');
    localCheckConnection();
  });
  
  window.addEventListener('offline', () => {
    console.log('Browser reports offline status');
    updateConnectionState(ConnectionState.DISCONNECTED);
  });
  
  return () => {
    if (connectionCheckInterval) {
      clearInterval(connectionCheckInterval);
      connectionCheckInterval = null;
    }
  };
};

// Initialize connection monitoring
startConnectionMonitoring();

// Export current connection state getter
export const getLocalConnectionState = () => currentConnectionState;

/**
 * Function to reconnect Supabase realtime connection when needed
 * This is particularly useful when a tab becomes visible again after being hidden
 */
export const reconnectSupabaseRealtime = async (): Promise<boolean> => {
  try {
    console.log('Attempting to reconnect Supabase realtime...');
    
    // Check if supabase is available
    if (!supabase || !supabase.realtime) {
      console.error('Supabase client or realtime not available');
      return false;
    }
    
    // Get current connection state
    const currentState = supabase.realtime.connectionState();
    console.log(`Current realtime connection state: ${currentState}`);
    
    // If already connected, no need to reconnect
    if (currentState === 'open') {
      console.log('Realtime connection is already open');
      
      // Ensure the worker is running
      if (realtimeWorker) {
        realtimeWorker.postMessage({ type: 'start' });
      }
      
      return true;
    }
    
    // If closed or closing, reconnect
    if (currentState === 'closed' || currentState === 'closing') {
      console.log('Reconnecting closed realtime connection...');
      
      // Disconnect first to clean up any existing connections
      try {
        supabase.realtime.disconnect();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (disconnectErr) {
        console.warn('Error during realtime disconnect:', disconnectErr);
        // Continue with reconnect attempt even if disconnect fails
      }
      
      // Now reconnect
      supabase.realtime.connect();
      
      // Start the worker if available
      if (realtimeWorker) {
        realtimeWorker.postMessage({ type: 'start' });
      }
      
      // Wait a bit to check if connection succeeded
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newState = supabase.realtime.connectionState();
      console.log(`New realtime connection state after reconnect: ${newState}`);
      
      return newState === 'open' || newState === 'connecting';
    }
    
    // If connecting, wait for it to complete
    if (currentState === 'connecting') {
      console.log('Realtime connection is already in connecting state, waiting...');
      
      // Wait a bit to see if it connects
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newState = supabase.realtime.connectionState();
      console.log(`Realtime connection state after waiting: ${newState}`);
      
      // Ensure the worker is running
      if (realtimeWorker) {
        realtimeWorker.postMessage({ type: 'start' });
      }
      
      return newState === 'open';
    }
    
    return false;
  } catch (err) {
    console.error('Error reconnecting Supabase realtime:', err);
    return false;
  }
};

// Enhanced visibility change handler
export const setupVisibilityChangeHandler = () => {
  if (typeof document === 'undefined') return;
  
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('Tab became visible, ensuring realtime connection is active');
      
      // Restart the worker if it's available
      if (realtimeWorker) {
        realtimeWorker.postMessage({ type: 'start' });
        console.log('Restarted realtime worker after tab became visible');
      }
      
      // Check connection status
      checkAndRepairConnection().then(connected => {
        if (connected) {
          console.log('Connection is good after tab visibility change');
          
          // Ensure realtime is connected
          reconnectSupabaseRealtime().then(success => {
            if (success) {
              console.log('Successfully ensured realtime connection after tab became visible');
            } else {
              console.warn('Failed to ensure realtime connection after tab became visible');
            }
          });
        } else {
          console.warn('Connection issues detected after tab became visible');
        }
      });
      
      // Dispatch visibility change event for other components
      const event = new CustomEvent('app:visibility-change', { 
        detail: { visible: true, timestamp: Date.now() } 
      });
      document.dispatchEvent(event);
    } else if (document.visibilityState === 'hidden') {
      console.log('Tab became hidden');
      
      // Keep the worker running to maintain the connection
      // This is the key difference - we don't stop the worker or disconnect
    }
  };
  
  // Clean up any existing event listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  // Add the event listener
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    
    // Stop the worker when the handler is removed
    if (realtimeWorker) {
      realtimeWorker.postMessage({ type: 'stop' });
    }
  };
};

// No need to initialize here as it's already initialized elsewhere in the file
// setupVisibilityChangeHandler(); 

// Track loaded pages to avoid refreshing content
let loadedPages: Record<string, boolean> = {};
const PAGE_CACHE_KEY = 'grme_loaded_pages';

// Initialize loaded pages from storage
if (typeof window !== 'undefined') {
  try {
    const storedPages = localStorage.getItem(PAGE_CACHE_KEY);
    if (storedPages) {
      loadedPages = JSON.parse(storedPages);
    }
  } catch (e) {
    console.error('Error loading page cache:', e);
    loadedPages = {};
  }
}

// Function to mark a page as loaded
export const markPageAsLoaded = (path: string) => {
  loadedPages[path] = true;
  try {
    localStorage.setItem(PAGE_CACHE_KEY, JSON.stringify(loadedPages));
  } catch (e) {
    console.error('Error saving page cache:', e);
  }
};

// Function to check if a page is loaded
export const isPageLoaded = (path: string) => {
  return !!loadedPages[path];
};

// Function to handle browser memory management
export const setupMemoryManagement = () => {
  // Listen for beforeunload to clean up resources
  window.addEventListener('beforeunload', () => {
    // Clean up heavy resources before page unload
    // This ensures we don't keep unnecessary data in memory
    try {
      // Store loaded pages state
      localStorage.setItem(PAGE_CACHE_KEY, JSON.stringify(loadedPages));
    } catch (e) {
      console.error('Error saving page state before unload:', e);
    }
  });
  
  // When page becomes visible again, restore resources
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('Page became visible again, restoring page cache');
      try {
        const storedPages = localStorage.getItem(PAGE_CACHE_KEY);
        if (storedPages) {
          loadedPages = JSON.parse(storedPages);
        }
      } catch (e) {
        console.error('Error restoring page cache:', e);
      }
    }
  });
};

// Set up memory management immediately
if (typeof window !== 'undefined') {
  setupMemoryManagement();
}

/**
 * Force a reconnection to the Supabase realtime service
 * This is more aggressive than the regular reconnect and should be used
 * when tabs are switched or the connection is lost
 */
export const forceReconnectSupabase = async () => {
  const { supabase } = await import('./supabaseClient');
  
  console.log('Forcing Supabase realtime reconnection');
  
  try {
    // First disconnect any existing connection
    try {
      supabase.realtime.disconnect();
      console.log('Disconnected existing realtime connection');
    } catch (err) {
      console.warn('Error disconnecting realtime:', err);
    }
    
    // Small delay to allow for proper disconnect
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Now reconnect
    try {
      supabase.realtime.connect();
      console.log('Reconnected to realtime');
    } catch (err) {
      console.error('Error reconnecting to realtime:', err);
    }
    
    // Also verify session is valid
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log('Verified session is still valid');
        return true;
      } else {
        console.warn('No session found after reconnection attempt');
        // Try to refresh session
        const refreshResult = await supabase.auth.refreshSession();
        if (refreshResult.data.session) {
          console.log('Successfully refreshed session');
          return true;
        }
      }
    } catch (sessionErr) {
      console.error('Error verifying session:', sessionErr);
    }
    
    return false;
  } catch (err) {
    console.error('Error in force reconnect:', err);
    return false;
  }
};

// Add an event listener for our custom visibility change event
if (typeof document !== 'undefined') {
  document.addEventListener('app:visibility-change', async (event) => {
    const customEvent = event as CustomEvent;
    
    if (customEvent.detail?.visible === true) {
      console.log('Visibility change event detected, forcing reconnection');
      await forceReconnectSupabase();
    }
  });
}

/**
 * Less aggressive function to prevent refresh triggers
 * This should be called when a tab becomes visible again
 */
export const blockAllRefreshTriggers = () => {
  if (typeof window === 'undefined') return;
  
  console.log('Activating gentle refresh prevention');
  
  try {
    // Only call window.stop() to halt any in-progress page loads
    if (window.stop) {
      window.stop();
    }
    
    // Just log that we're handling visibility change
    console.log('Tab visibility changed, ensuring connection is maintained');
    
    return true;
  } catch (error) {
    console.error('Error in refresh prevention:', error);
    return false;
  }
};

// We're no longer adding the aggressive event listener
// This was causing issues with normal tab switching 