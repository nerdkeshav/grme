// Fix Supabase Connection and Styling Issues
// This script applies fixes for:
// 1. Supabase connection issues when refreshing the page or switching tabs
// 2. Text visibility issues
// 3. Login/signup page styling issues

console.log('Starting connection and styling fixes...');

// Apply fixes to the connection middleware
const fixConnectionMiddleware = () => {
  console.log('Applying connection middleware fixes...');
  
  // Improved visibility change handling
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('Tab became visible, refreshing connection...');
      
      // Dispatch a custom event to refresh auth state
      const event = new CustomEvent('app:visibility-change', { 
        detail: { visible: true, timestamp: Date.now() } 
      });
      document.dispatchEvent(event);
      
      // Force a session refresh
      try {
        const supabase = window.supabaseClient;
        if (supabase && supabase.auth) {
          console.log('Refreshing Supabase session...');
          
          // Clear any problematic connection state first
          localStorage.removeItem('app_connection_state');
          localStorage.removeItem('connection_error_count');
          
          // Try to refresh the session
          supabase.auth.refreshSession().then(({ data, error }) => {
            if (error) {
              console.error('Session refresh failed:', error);
              // If refresh fails, force a page reload to get a fresh connection
              window.location.reload();
            } else if (data && data.session) {
              console.log('Session refreshed successfully');
              // Add force reload to ensure everything is fresh
              window.location.reload();
            } else {
              console.log('No active session found, reloading page');
              window.location.reload();
            }
          });
        } else {
          console.log('Supabase client not found, reloading page');
          window.location.reload();
        }
      } catch (e) {
        console.error('Error refreshing session:', e);
        // If any error occurs, force a page reload
        window.location.reload();
      }
    }
  });
  
  // Reset connection state after page refresh
  try {
    // Clear any problematic connection state
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
    
    // Also set up periodic connection checks
    setInterval(() => {
      try {
        const supabase = window.supabaseClient;
        if (supabase && supabase.auth) {
          console.log('Performing periodic connection check...');
          supabase.auth.getSession().then(({ data }) => {
            if (data && data.session) {
              console.log('Connection check successful');
            } else {
              console.log('No active session found during check, refreshing...');
              window.location.reload();
            }
          });
        }
      } catch (e) {
        console.error('Error during periodic connection check:', e);
      }
    }, 60000); // Check every minute
  } catch (e) {
    console.error('Error resetting connection state:', e);
  }
};

// Fix text visibility issues
const fixTextVisibility = () => {
  console.log('Applying text visibility fixes...');
  
  // Create a style element
  const style = document.createElement('style');
  
  // Add CSS rules to fix text visibility - ENHANCED VERSION
  style.textContent = `
    /* Global text color fix - make all text white by default */
    body, p, h1, h2, h3, h4, h5, h6, span, div, li, a, label, small {
      color: white !important;
    }
    
    /* Make text in specific containers white */
    .navbar, .sidebar, .footer, .header, main, section, article, aside, .container {
      color: white !important;
    }
    
    /* Make text in specific elements white */
    .text-primary, .text-secondary, .text-muted, .text-dark, 
    .text-gray-500, .text-gray-600, .text-gray-700, .text-gray-800, .text-gray-900 {
      color: rgba(255, 255, 255, 0.9) !important;
    }
    
    /* Make text on light backgrounds black and ALWAYS visible (not just on hover) */
    .bg-white *, .bg-light *, .bg-secondary *, .card *, 
    [class*="bg-light"] *, [class*="bg-white"] * {
      color: black !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    /* Make text in buttons with light backgrounds black and always visible */
    button.bg-white, button.bg-light, button.bg-secondary,
    .btn-light, .btn-white, .btn-secondary,
    button[type="submit"],
    button[class*="bg-white"],
    button[class*="bg-light"],
    button[style*="background-color: white"],
    button[style*="background: white"] {
      color: black !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    /* Exception: Make text in dark buttons white */
    button.bg-dark, button.bg-black, button.bg-primary,
    .btn-dark, .btn-black, .btn-primary {
      color: white !important;
    }
    
    /* Fix for inputs */
    input, select, textarea {
      color: black !important;
      background-color: white !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    /* Fix for links */
    a, a:hover, a:focus, a:active {
      color: rgba(255, 255, 255, 0.9) !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    /* Fix for specific components */
    .navbar-brand, .nav-link {
      color: white !important;
    }
    
    /* Fix for landing page */
    .landing-page *, .hero-section * {
      color: white !important;
    }
    
    /* Fix for buttons in cards */
    .card button, .bg-white button, .bg-light button {
      color: black !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    /* Fix for headings in cards */
    .card h1, .card h2, .card h3, .card h4, .card h5, .card h6 {
      color: black !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    /* Fix for text in tables */
    table, th, td {
      color: white !important;
    }
    
    /* Fix for form labels */
    label {
      color: white !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    /* Fix for auth pages */
    .auth-layout * {
      color: white !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    /* Fix for auth page inputs */
    .auth-layout input, .auth-layout select, .auth-layout textarea {
      color: black !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    /* Fix for auth page buttons */
    .auth-layout button[type="submit"] {
      background-color: white !important;
      color: black !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    .auth-layout button:not([type="submit"]) {
      background-color: black !important;
      color: white !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    /* Fix specifically for login/register pages */
    form input, form button, form label, form a {
      opacity: 1 !important;
      visibility: visible !important;
    }
    
    /* Additional fix for text on white backgrounds */
    [style*="background-color: white"] *, 
    [style*="background: white"] *,
    [style*="background-color: #fff"] *, 
    [style*="background: #fff"] * {
      color: black !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
  `;
  
  // Append the style element to the head
  document.head.appendChild(style);
};

// Fix auth pages styling
const fixAuthStyling = () => {
  console.log('Applying auth pages styling fixes...');
  
  // Find all buttons on login/register pages and update their styling
  const authPages = document.querySelector('.auth-layout');
  
  if (authPages) {
    // Update primary buttons to white
    const primaryButtons = authPages.querySelectorAll('button[type="submit"]');
    primaryButtons.forEach(button => {
      button.classList.remove('bg-primary', 'bg-blue-600', 'bg-blue-500');
      button.classList.add('bg-white', 'text-black', 'hover:bg-gray-200');
      button.style.opacity = '1';
      button.style.visibility = 'visible';
    });
    
    // Update Google buttons to black
    const googleButtons = authPages.querySelectorAll('button:not([type="submit"])');
    googleButtons.forEach(button => {
      button.classList.remove('bg-surface-light', 'bg-gray-800');
      button.classList.add('bg-black', 'text-white', 'hover:bg-gray-800');
      button.style.opacity = '1';
      button.style.visibility = 'visible';
    });
    
    // Make sure all inputs are visible
    const inputs = authPages.querySelectorAll('input');
    inputs.forEach(input => {
      input.style.opacity = '1';
      input.style.visibility = 'visible';
    });
    
    // Make sure all labels are visible
    const labels = authPages.querySelectorAll('label');
    labels.forEach(label => {
      label.style.opacity = '1';
      label.style.visibility = 'visible';
    });
  }
};

// Apply fixes immediately and also after DOM content loaded
const applyAllFixes = () => {
  console.log('Applying all fixes...');
  
  // Fix connection middleware
  fixConnectionMiddleware();
  
  // Fix text visibility
  fixTextVisibility();
  
  // Fix auth styling
  setTimeout(fixAuthStyling, 100);
  
  console.log('All fixes applied successfully!');
};

// Run all fixes immediately
applyAllFixes();

// Also run fixes when DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
  applyAllFixes();
});

// Run fixes again after a delay to catch dynamically loaded content
setTimeout(applyAllFixes, 1000);
setTimeout(applyAllFixes, 3000);

// Listen for network status changes
window.addEventListener('online', () => {
  console.log('Network connection restored, refreshing page...');
  window.location.reload();
});

// Export the functions for manual use
window.fixSupabaseConnection = {
  fixConnectionMiddleware,
  fixTextVisibility,
  fixAuthStyling,
  applyAllFixes
};

console.log('Fix script loaded. You can manually run fixes using window.fixSupabaseConnection functions.'); 