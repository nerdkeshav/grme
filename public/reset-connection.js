// Improved connection reset script
// This script fixes issues with Supabase connectivity by removing stale data

// This script clears Supabase connection data from localStorage
// This will force a complete reconnection on next app load
console.log('Resetting connection state...');

// Clear Supabase-related localStorage items
function clearSupabaseStorage() {
  // Track what we're doing
  console.log('Starting enhanced connection reset...');
  const keysToRemove = [];
  const authTokens = [];
  let mostRecentAuthKey = null;
  let mostRecentExpiry = 0;

  // Find all Supabase-related keys and analyze them
  console.log('Analyzing localStorage for problematic items...');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    
    // Check if it's an auth token
    const isAuthToken = 
      key.includes('supabase.auth.token') || 
      (key.includes('sb-') && key.includes('-auth-token'));
      
    if (isAuthToken) {
      try {
        const data = localStorage.getItem(key);
        if (!data) continue;
        
        const parsed = JSON.parse(data);
        
        // Check if it's a valid token with an expiry time
        if (parsed && parsed.expires_at) {
          const expiryTimestamp = parsed.expires_at;
          authTokens.push({
            key,
            expiryTimestamp,
            data: parsed
          });
          
          // Keep track of the most recent valid token
          if (expiryTimestamp > mostRecentExpiry) {
            mostRecentExpiry = expiryTimestamp;
            mostRecentAuthKey = key;
          }
        } else {
          // Invalid token structure, mark for removal
          keysToRemove.push(key);
        }
      } catch (e) {
        console.error(`Invalid JSON in key ${key}, will remove:`, e);
        keysToRemove.push(key);
      }
    } 
    // Mark all other Supabase related items for removal
    else if (
      key.includes('supabase') || 
      key.includes('sb-') ||
      key.includes('connection') ||
      key.includes('auth') ||
      key.includes('offline')
    ) {
      keysToRemove.push(key);
    }
  }
  
  // If we have multiple auth tokens, keep only the most recent one
  if (authTokens.length > 1) {
    console.warn(`Found ${authTokens.length} auth tokens - keeping only the most recent one`);
    
    authTokens.forEach(token => {
      if (token.key !== mostRecentAuthKey) {
        keysToRemove.push(token.key);
      } else {
        // For the token we're keeping, clean up any error fields
        try {
          const data = JSON.parse(localStorage.getItem(token.key) || '{}');
          if (data.error) {
            console.log('Cleaning error state from the retained token');
            delete data.error;
            localStorage.setItem(token.key, JSON.stringify(data));
          }
        } catch (e) {
          console.error('Error cleaning token data:', e);
        }
      }
    });
  }
  
  // Remove all the problematic keys
  console.log(`Removing ${keysToRemove.length} problematic items from localStorage`);
  keysToRemove.forEach(key => {
    console.log(`- Removing: ${key}`);
    localStorage.removeItem(key);
  });
  
  // Also clear session storage
  console.log('Clearing sessionStorage');
  sessionStorage.clear();
  
  // Also clear any connection tracking flags
  localStorage.removeItem('app_connection_state');
  localStorage.removeItem('last_page_visit');
  localStorage.removeItem('last_page_unload');
  localStorage.removeItem('last_connection_check');
  
  console.log('Storage cleaned - connection state reset');
  console.log('Reloading page in 2 seconds...');
  
  // Reload after a slight delay
  setTimeout(() => {
    window.location.reload();
  }, 2000);
}

// Execute the cleanup
clearSupabaseStorage();
