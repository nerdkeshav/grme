import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './assets/animated-loader.css'; // Import the CSS for animated loaders
import App from './App';
import reportWebVitals from './reportWebVitals';
import { supabase, checkDatabaseHealth, cleanAndRotateAuthStorage } from './utils/supabaseClient';
import { localAddConnectionListener, checkAndRepairConnection, reconnectSupabaseRealtime, forceReconnectSupabase } from './utils/connectionMiddleware';
import './utils/preventRefresh'; // Import refresh prevention system

// Add debugging for Supabase connection
console.log("Testing Supabase connection...");

// Check if Supabase is accessible
console.log("Testing Supabase connection details:", {
  url: process.env.REACT_APP_SUPABASE_URL || "Using fallback URL",
  keyProvided: !!process.env.REACT_APP_SUPABASE_ANON_KEY || "Using fallback key"
});

// Enhanced connection monitoring with aggressive recovery
let isConnectionError = false;
let silentRetryCount = 0;
const MAX_SILENT_RETRIES = 10; // Increased from 5
const SILENT_RETRY_DELAY = 5000; // Reduced from 10000 to retry more frequently

// Add connection listener with improved recovery logic
const removeConnectionListener = localAddConnectionListener((isConnected: boolean) => {
  if (!isConnected && !isConnectionError) {
    isConnectionError = true;
    console.warn('Connection error detected, starting background retry process');
    
    // Start silent retry process in the background
    silentRetryCount = 0;
    scheduleSilentRetry();
  } else if (isConnected && isConnectionError) {
    isConnectionError = false;
    silentRetryCount = 0;
    console.log('Connection restored automatically');
    
    // Don't force reload the page, just log that connection is restored
    console.log('Connection restored - no page reload needed');
  }
});

// Schedule a silent retry with exponential backoff
function scheduleSilentRetry() {
  if (silentRetryCount >= MAX_SILENT_RETRIES) {
    console.log(`Maximum silent retries (${MAX_SILENT_RETRIES}) reached, stopping auto-retry`);
    return;
  }
  
  silentRetryCount++;
  setTimeout(async () => {
    console.log(`Silent retry attempt ${silentRetryCount}/${MAX_SILENT_RETRIES}`);
    
    // First try to clean auth storage
    if (silentRetryCount > 3) {
      console.log("Attempting to clean auth storage to fix connection issues");
      cleanAndRotateAuthStorage();
    }
    
    // Then check connection
    const isConnected = await checkAndRepairConnection();
    
    if (!isConnected && silentRetryCount < MAX_SILENT_RETRIES) {
      // Schedule another retry with exponential backoff
      scheduleSilentRetry();
    } else if (isConnected) {
      console.log("Connection restored - continuing without page reload");
      // Don't reload the page, just update the state
      isConnectionError = false;
    }
  }, SILENT_RETRY_DELAY * Math.pow(1.3, silentRetryCount - 1)); // Exponential backoff
}

// Check if Supabase is accessible with basic auth
supabase.auth.onAuthStateChange((event, session) => {
  console.log("Auth state change event:", event);
  console.log("Session available:", !!session);
  
  // If session is lost, attempt to recover
  if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
    checkAndRepairConnection();
  }
});

// Run a health check on startup
checkDatabaseHealth()
  .then(result => {
    console.log("Supabase health check result:", result);
    if (result.connected) {
      console.log("Supabase is accessible!");
    } else {
      console.error("Supabase is not accessible. Please check your connection and credentials.");
      console.log("Attempting a basic fetch to verify network connectivity...");
      
      // Test general network connectivity with CORS mode
      fetch("https://ghspfcpkmvasswohlwjc.supabase.co/rest/v1/profiles?select=id&limit=1", {
        method: 'GET',
        mode: 'cors',
        headers: {
          "Content-Type": "application/json",
          "apikey": process.env.REACT_APP_SUPABASE_ANON_KEY || "Anonymous key not found"
        }
      })
      .then(response => {
        console.log("Network test response status:", response.status);
        return response.text();
      })
      .then(text => {
        console.log("Network test response:", text.substring(0, 100) + (text.length > 100 ? "..." : ""));
      })
      .catch(err => {
        console.error("Network test failed:", err);
      });
    }
  })
  .catch(err => {
    console.error("Error during health check:", err);
  });

// Add a custom cache manager for React components
// This prevents components from remounting when the user returns to a page
const setupComponentCacheManager = () => {
  // Create a property to store the last active time
  let lastActiveTime = Date.now();
  
  // When a tab becomes visible, update the last active time
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Calculate the time the tab was inactive
      const inactiveTime = Date.now() - lastActiveTime;
      
      // Log inactivity period
      console.log(`Tab was inactive for ${Math.round(inactiveTime/1000)}s`);
      
      // If the tab was inactive for less than 30 minutes,
      // don't remount components (this is handled by React router)
      if (inactiveTime < 30 * 60 * 1000) {
        // Prevent default behavior that might cause refreshes
        document.body.dataset.preventRemount = 'true';
        
        // Dispatch a custom event that React can listen for
        const event = new Event('tab-revisited');
        document.dispatchEvent(event);
      } else {
        // For very long periods of inactivity, allow a fresh mount
        document.body.dataset.preventRemount = 'false';
      }
      
      // Update the last active time
      lastActiveTime = Date.now();
    } else if (document.visibilityState === 'hidden') {
      // Update the time when the tab becomes hidden
      lastActiveTime = Date.now();
    }
  });
};

// Run the setup if in a browser environment
if (typeof document !== 'undefined') {
  setupComponentCacheManager();
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Remove StrictMode to prevent double-rendering in development
// This can help prevent the refreshing when switching tabs
root.render(
  <App />
);

// Add cleanup for connection listeners when the page unloads
window.addEventListener('beforeunload', () => {
  removeConnectionListener();
});

// Add network event listeners for connection recovery
if (typeof window !== 'undefined') {
  // When online status changes to online
  window.addEventListener('online', () => {
    console.log('Network connection restored, cleaning auth storage...');
    
    // Clean auth storage
    cleanAndRotateAuthStorage();
    
    // Don't automatically reload the page, just repair the connection
    checkAndRepairConnection().then(connected => {
      if (connected) {
        console.log('Connection restored after network reconnection');
      } else {
        console.log('Connection still having issues after network reconnection');
      }
    });
  });
  
  // When page is loaded, check if we have auth issues
  window.addEventListener('load', () => {
    // Check if we've had multiple page loads in a short time
    // This could indicate the user is stuck in a refresh loop due to auth issues
    try {
      const pageLoads = localStorage.getItem('page_load_count') || '0';
      const lastLoadTime = localStorage.getItem('last_page_load') || '0';
      const currentTime = Date.now();
      const COUNT_THRESHOLD = 3;
      const TIME_THRESHOLD = 60000; // 1 minute
      
      // Parse the values
      const loadCount = parseInt(pageLoads, 10);
      const timeSinceLastLoad = currentTime - parseInt(lastLoadTime, 10);
      
      // Update the load count and time
      localStorage.setItem('last_page_load', currentTime.toString());
      
      if (timeSinceLastLoad < TIME_THRESHOLD) {
        // It's a quick reload, increment counter
        localStorage.setItem('page_load_count', (loadCount + 1).toString());
        
        // If we've reloaded several times quickly, this could be an auth issue
        if (loadCount + 1 >= COUNT_THRESHOLD) {
          console.warn('Multiple quick page loads detected, cleaning auth storage...');
          cleanAndRotateAuthStorage();
          localStorage.setItem('page_load_count', '0');
        }
      } else {
        // It's been a while since the last load, reset counter
        localStorage.setItem('page_load_count', '1');
      }
    } catch (error) {
      console.error('Error handling page load tracking:', error);
    }
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Add special styles to prevent white flash during tab switching
if (typeof document !== 'undefined') {
  // Create a style element
  const style = document.createElement('style');
  style.textContent = `
    /* Prevent white flash during tab switching */
    body {
      transition: none !important;
    }
    
    /* Ensure the body doesn't reset during tab switching */
    body.refresh-protection-enabled {
      background-color: #121212 !important;
      color: white !important;
      min-height: 100vh !important;
    }
    
    /* Prevent any animations during tab switching */
    body[data-handling-visibility="true"] *,
    body[data-focused="true"] * {
      animation-play-state: paused !important;
      transition: none !important;
    }
  `;
  
  // Add it to the head
  document.head.appendChild(style);
  
  // Also add a class to the body
  document.body.classList.add('refresh-protection-enabled');
} 