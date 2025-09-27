import { checkDatabaseHealth } from './supabaseClient';

// Define connection states
export enum ConnectionState {
  CONNECTED = 'CONNECTED',
  LIMITED_CONNECTIVITY = 'LIMITED_CONNECTIVITY',
  DISCONNECTED = 'DISCONNECTED',
  CHECKING = 'CHECKING'
}

// Store connection info persistently
interface ConnectionInfo {
  state: ConnectionState;
  lastCheck: number;
  lastSuccessful: number;
  consecutiveFailures: number;
  attemptCount: number;
}

// Default connection info
const DEFAULT_CONNECTION_INFO: ConnectionInfo = {
  state: ConnectionState.CHECKING,
  lastCheck: 0,
  lastSuccessful: 0,
  consecutiveFailures: 0,
  attemptCount: 0
};

// Local storage key
const CONNECTION_STORAGE_KEY = 'app_connection_state';

// In-memory connection state
let currentConnectionInfo: ConnectionInfo = DEFAULT_CONNECTION_INFO;

// Listeners for connection changes
const connectionListeners: Array<(state: ConnectionState) => void> = [];

// Initialize on load
initConnectionManager();

/**
 * Initialize the connection manager and load saved state
 */
function initConnectionManager() {
  try {
    // Load saved connection info from localStorage
    const savedInfo = localStorage.getItem(CONNECTION_STORAGE_KEY);
    if (savedInfo) {
      currentConnectionInfo = JSON.parse(savedInfo);
      
      // If it's been more than 2 minutes since the last check, reset to checking
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
      if (currentConnectionInfo.lastCheck < twoMinutesAgo) {
        currentConnectionInfo.state = ConnectionState.CHECKING;
      }
    }
    
    // Set up online/offline event listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Browser reports online, checking connectivity...');
        checkConnection(true);
      });
      
      window.addEventListener('offline', () => {
        console.log('Browser reports offline');
        updateConnectionState(ConnectionState.DISCONNECTED);
      });
      
      // Check connection on visibility change (when tab becomes visible again)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('Tab became visible, checking connection...');
          // Small delay to let network stabilize
          setTimeout(() => checkConnection(false), 1000);
        }
      });
      
      // Set up periodic connection checks (every 30 seconds)
      setInterval(() => {
        checkConnection(false);
      }, 30000);
      
      // Run initial check
      setTimeout(() => {
        checkConnection(true);
      }, 1000);
    }
    
    // Detect and fix session-specific issues
    detectAndFixSessionIssues();
  } catch (error) {
    console.error('Error initializing connection manager:', error);
  }
}

/**
 * Check the database connection
 */
export async function checkConnection(showBanner = false): Promise<ConnectionState> {
  try {
    // Update state to checking
    if (showBanner) {
      updateConnectionState(ConnectionState.CHECKING);
    }
    
    // Track attempt
    currentConnectionInfo.attemptCount++;
    currentConnectionInfo.lastCheck = Date.now();
    saveConnectionInfo();
    
    // Check database health
    const result = await checkDatabaseHealth();
    
    // Update state based on result
    if (result.connected) {
      // Fully connected
      if (result.responseTime < 2000) {
        updateConnectionState(ConnectionState.CONNECTED);
        currentConnectionInfo.consecutiveFailures = 0;
        currentConnectionInfo.lastSuccessful = Date.now();
      } else {
        // Connected but slow
        updateConnectionState(ConnectionState.LIMITED_CONNECTIVITY);
        currentConnectionInfo.lastSuccessful = Date.now();
      }
    } else {
      // Not connected
      currentConnectionInfo.consecutiveFailures++;
      if (currentConnectionInfo.consecutiveFailures > 3) {
        updateConnectionState(ConnectionState.DISCONNECTED);
      } else {
        updateConnectionState(ConnectionState.LIMITED_CONNECTIVITY);
      }
    }
    
    saveConnectionInfo();
    return currentConnectionInfo.state;
  } catch (error) {
    console.error('Error checking connection:', error);
    updateConnectionState(ConnectionState.LIMITED_CONNECTIVITY);
    saveConnectionInfo();
    return currentConnectionInfo.state;
  }
}

/**
 * Update the connection state and notify listeners
 */
function updateConnectionState(state: ConnectionState) {
  // Only update and notify if state has changed
  if (currentConnectionInfo.state !== state) {
    currentConnectionInfo.state = state;
    saveConnectionInfo();
    
    // Notify all listeners
    connectionListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }
}

/**
 * Save connection info to localStorage
 */
function saveConnectionInfo() {
  try {
    localStorage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(currentConnectionInfo));
  } catch (error) {
    console.error('Error saving connection info:', error);
  }
}

/**
 * Add a listener for connection state changes
 */
export function addConnectionStateListener(callback: (state: ConnectionState) => void) {
  connectionListeners.push(callback);
  // Immediately notify of current state
  setTimeout(() => callback(currentConnectionInfo.state), 0);
  
  // Return function to remove listener
  return () => {
    const index = connectionListeners.indexOf(callback);
    if (index >= 0) {
      connectionListeners.splice(index, 1);
    }
  };
}

/**
 * Get the current connection state
 */
export function getCurrentConnectionState(): ConnectionState {
  return currentConnectionInfo.state;
}

/**
 * Reset connection state (for troubleshooting)
 */
export function resetConnectionState() {
  currentConnectionInfo = { ...DEFAULT_CONNECTION_INFO };
  saveConnectionInfo();
  setTimeout(() => checkConnection(true), 500);
}

/**
 * Clear connection state from localStorage
 */
export function clearConnectionState() {
  try {
    localStorage.removeItem(CONNECTION_STORAGE_KEY);
    currentConnectionInfo = { ...DEFAULT_CONNECTION_INFO };
  } catch (error) {
    console.error('Error clearing connection state:', error);
  }
}

/**
 * Get detailed connection info (for debugging)
 */
export function getConnectionInfo(): ConnectionInfo {
  return { ...currentConnectionInfo };
}

/**
 * Detect and fix session-specific connection issues
 * This solves the problem where new incognito sessions work but refreshing breaks things
 */
export function detectAndFixSessionIssues(): void {
  try {
    // Check if this is a fresh session
    const isFreshSession = !localStorage.getItem(CONNECTION_STORAGE_KEY);
    
    // If the app loads after a refresh and already has connection issues, this could be
    // a session-specific problem. Clear the storage to "simulate" a fresh session.
    if (!isFreshSession && currentConnectionInfo.state !== ConnectionState.CONNECTED) {
      const timeElapsed = Date.now() - (currentConnectionInfo.lastSuccessful || 0);
      
      // If we've never had a successful connection or it's been a while,
      // and we have cached auth data, this is likely a session issue
      if ((currentConnectionInfo.lastSuccessful === 0 || timeElapsed > 60000) && 
          localStorage.getItem('supabase.auth.token')) {
        console.log('Detected potential session-specific connection issue. Clearing connection state.');
        
        // Clear only the connection state to start fresh, but keep auth data
        clearConnectionState();
        
        // Auto-reset connection issues counter
        setTimeout(() => {
          if (currentConnectionInfo.consecutiveFailures > 0) {
            currentConnectionInfo.consecutiveFailures = 0;
            saveConnectionInfo();
          }
        }, 5000);
      }
    }
    
    // For new sessions, set this as the first visit
    if (isFreshSession) {
      currentConnectionInfo.lastCheck = Date.now();
      saveConnectionInfo();
    }
  } catch (error) {
    console.error('Error in detectAndFixSessionIssues:', error);
  }
}

// Export for convenience
export default {
  checkConnection,
  addConnectionStateListener,
  getCurrentConnectionState,
  resetConnectionState,
  clearConnectionState,
  getConnectionInfo,
  ConnectionState
}; 