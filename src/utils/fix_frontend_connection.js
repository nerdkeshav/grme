/**
 * Supabase Connection Fix
 * 
 * This script fixes persistent connection issues with Supabase.
 * Add this to your src/utils/ folder and import in your main app file.
 */

import { cleanAndRotateAuthStorage } from './supabaseClient';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'supabase.auth.token',
  REFRESH_TOKEN: 'supabase.auth.refreshToken',
  AUTH_ERROR: 'supabase.auth.error',
  // Add any storage keys that match your Supabase instance
  // These often follow patterns like: sb-[projectref]-auth-token
};

/**
 * Detects and fixes common Supabase connection issues
 */
export function fixSupabaseConnection() {
  // 1. Clean up any error states that could be preventing login
  cleanupAuthErrors();
  
  // 2. Set up listeners for online/offline events
  setupNetworkListeners();
  
  // 3. Detect and fix the issue where refreshing causes connection problems
  detectAndFixRefreshIssues();
  
  // 4. Clean up stale sessions periodically
  setInterval(cleanupAuthErrors, 30 * 60 * 1000); // Every 30 minutes
  
  console.log('Supabase connection fix initialized');
}

/**
 * Clean up any auth errors in localStorage
 */
function cleanupAuthErrors() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    // Use the comprehensive cleaning function we've already defined
    cleanAndRotateAuthStorage();
  } catch (err) {
    console.error('Error cleaning up auth errors:', err);
  }
}

/**
 * Set up network listeners to handle online/offline events
 */
function setupNetworkListeners() {
  if (typeof window === 'undefined') return;
  
  // Handle online event - already implemented in index.tsx
  // Just adding a simple log here
  window.addEventListener('online', () => {
    console.log('Browser reports online status, refreshing connection');
  });
  
  // Handle offline event
  window.addEventListener('offline', () => {
    console.log('Browser reports offline status');
    // We don't need to do anything, just log
  });
}

/**
 * Detect and fix refresh issues
 */
function detectAndFixRefreshIssues() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  
  try {
    // Track page loads to detect refreshes
    const lastVisit = localStorage.getItem('app_last_visit');
    const now = Date.now();
    localStorage.setItem('app_last_visit', now.toString());
    
    // If this is a page refresh (within 5 seconds of last visit)
    if (lastVisit && (now - parseInt(lastVisit)) < 5000) {
      console.log('Page refresh detected, cleaning connection state');
      
      // Cleanup any connection problem indicators
      localStorage.removeItem('app_connection_state');
      cleanupAuthErrors();
    }
    
    // Track page unloads
    window.addEventListener('beforeunload', () => {
      localStorage.setItem('app_last_unload', Date.now().toString());
    });
  } catch (err) {
    console.error('Error in detectAndFixRefreshIssues:', err);
  }
}

/**
 * Call this when initializing your app
 */
export function initializeConnectionFixes() {
  if (typeof window !== 'undefined') {
    fixSupabaseConnection();
  }
} 