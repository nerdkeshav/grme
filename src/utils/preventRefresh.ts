import { useEffect } from 'react';

// Global state to track if the component is mounted
const mountedComponents: Record<string, boolean> = {};

// Flag to track if we're currently handling a visibility change
let isHandlingVisibilityChange = false;

// Flag to track if we've modified the reload behavior
let reloadBehaviorModified = false;

// Flag to track if we're currently in a tab switch
let isInTabSwitch = false;

// Store the original functions we'll override
let originalReload: Function;
let originalPushState: typeof window.history.pushState;
let originalReplaceState: typeof window.history.replaceState;

/**
 * Prevent tab switching from causing refreshes 
 * This is a very minimal approach that only logs but doesn't block navigation
 */
export const initPreventRefresh = () => {
  if (typeof window === 'undefined') return;
  if (reloadBehaviorModified) return; // Only initialize once
  
  reloadBehaviorModified = true;
  console.log('Initializing minimal refresh prevention system');
  
  // 1. Override the history API to track page state but never block navigation
  originalPushState = window.history.pushState;
  window.history.pushState = function(state: any, unused: string, url?: string | URL | null) {
    // Just log but never block
    if (isHandlingVisibilityChange || isInTabSwitch) {
      console.log('Detected pushState during visibility change or tab switch');
    }
    
    return originalPushState.apply(this, [state, unused, url]);
  };
  
  // 2. Override replaceState too but never block
  originalReplaceState = window.history.replaceState;
  window.history.replaceState = function(state: any, unused: string, url?: string | URL | null) {
    // Just log but never block
    if (isHandlingVisibilityChange || isInTabSwitch) {
      console.log('Detected replaceState during visibility change or tab switch');
    }
    return originalReplaceState.apply(this, [state, unused, url]);
  };
  
  // 3. Use the original reload function - NEVER block reloads
  originalReload = window.location.reload;
  
  // 4. When the page becomes visible again, just track state briefly
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('Tab became visible');
      
      // Set flags but with extremely short durations
      isHandlingVisibilityChange = true;
      isInTabSwitch = true;
      
      // Reset flags extremely quickly - we don't want to block ANY navigation
      setTimeout(() => {
        isHandlingVisibilityChange = false;
        isInTabSwitch = false;
      }, 50); // Extremely short timeout
      
    } else if (document.visibilityState === 'hidden') {
      // Tab is being hidden
      console.log('Tab became hidden');
      isInTabSwitch = true;
      
      // Reset flag immediately
      setTimeout(() => {
        isInTabSwitch = false;
      }, 50);
    }
  });
  
  console.log('Minimal refresh prevention system initialized');
};

/**
 * React hook to prevent component from refreshing on tab switch
 * @param componentId A unique identifier for the component
 */
export const usePreventRefresh = (componentId: string) => {
  useEffect(() => {
    // Make sure our prevention system is initialized
    initPreventRefresh();
    
    // Mark this component as mounted
    mountedComponents[componentId] = true;
    
    return () => {
      // Only delete if this is an intentional unmount, not a refresh
      if (document.visibilityState !== 'hidden' && 
          !isHandlingVisibilityChange &&
          !isInTabSwitch) {
        delete mountedComponents[componentId];
      }
    };
  }, [componentId]);
  
  // Always return isMounted as true
  return { isMounted: true };
};

// Initialize the system immediately
if (typeof window !== 'undefined') {
  initPreventRefresh();
}

// Make sure TypeScript recognizes the file as a proper module
export {}; 