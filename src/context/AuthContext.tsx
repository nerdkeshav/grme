import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, checkDatabaseHealth } from '../utils/supabaseClient';
import { Profile } from '../types/supabase';
import { usePreventRefresh } from '../utils/preventRefresh';

// Flag for using mock auth - set to false to always use real authentication
const USE_MOCK_AUTH = false;

// Debug mode - set to true to see detailed auth logs
const DEBUG_AUTH = true;

// Offline fallback - create a simple in-memory store when database is unreachable
const offlineFallback = {
  user: null as User | null,
  session: null as Session | null,
  profile: null as Profile | null
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  connectionError: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any | null; data: any | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any | null; data: any | null }>;
  signInWithGoogle: () => Promise<{ error: any | null; data: any | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any | null; data: any | null }>;
  updateProfile: (profile: Partial<Profile>) => Promise<{ error: any | null; data: Profile | null }>;
  refreshProfile: () => Promise<void>;
  checkConnection: () => Promise<boolean>;
  forceRefreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Use the prevent refresh hook to keep auth state during tab switching
  usePreventRefresh('auth-provider');
  
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  
  // Store auth state in sessionStorage to survive refreshes
  useEffect(() => {
    // Save auth state when it changes
    if (session && user) {
      try {
        sessionStorage.setItem('grme_auth_state', JSON.stringify({
          hasAuth: true,
          userId: user.id,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.error('Failed to store auth state:', e);
      }
    }
  }, [session, user]);
  
  // Maximum time to stay in loading state regardless of what happens
  const MAX_LOADING_TIME = 30000; // 30 seconds
  
  // Reference to store the interval ID for periodic connection checking
  const connectionCheckerRef = React.useRef<number | null>(null);

  useEffect(() => {
    // Set a hard timeout for the loading state
    const loadingTimeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Maximum loading time reached, forcing exit from loading state');
        setLoading(false);
      }
    }, MAX_LOADING_TIME);
    
    // Real Supabase authentication
    const initAuth = async () => {
      try {
        console.log("Starting authentication initialization...");
        
        // First check database connectivity to avoid timeouts
        const { connected, responseTime } = await checkDatabaseHealth();
        
        console.log("Health check results:", { connected, responseTime });
        
        if (!connected) {
          console.error('Database connectivity check failed, continuing without session');
          
          // Check local storage for any existing session data
          try {
            const storedSession = localStorage.getItem('supabase.auth.token');
            console.log("Checking for stored session:", !!storedSession);
            
            if (storedSession) {
              console.log('Found stored session data, attempting to use it despite connection issues');
              try {
                const sessionData = JSON.parse(storedSession);
                if (sessionData && sessionData.currentSession) {
                  console.log('Using locally stored session as fallback');
                  // Create a minimal session and user object
                  const minimalSession = {
                    ...sessionData.currentSession,
                    user: sessionData.currentSession.user
                  } as Session;
                  
                  setSession(minimalSession);
                  setUser(minimalSession.user);
                  
                  // Create a minimal profile as fallback
                  const minimalProfile = {
                    id: minimalSession.user.id,
                    user_id: minimalSession.user.id,
                    username: minimalSession.user.email?.split('@')[0] || 'user',
                    full_name: minimalSession.user.user_metadata?.full_name || '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    is_admin: false,
                    is_premium: false
                  } as Profile;
                  
                  setProfile(minimalProfile);
                  
                  // Store in the offline fallback
                  offlineFallback.user = minimalSession.user;
                  offlineFallback.session = minimalSession;
                  offlineFallback.profile = minimalProfile;
                  
                  setConnectionError(true);
                  setLoading(false);
                  return;
                }
              } catch (parseError) {
                console.error('Error parsing stored session:', parseError);
              }
            }
          } catch (storageError) {
            console.error('Error accessing local storage:', storageError);
          }
          
          setConnectionError(true);
          setLoading(false);
          return;
        }
        
        if (responseTime > 2000) {
          console.warn(`Database response time is slow: ${responseTime}ms`);
        }
        
        console.log('Database connectivity check passed, proceeding with authentication');
        
        // First check for auth fragments in the URL that indicate we're in an OAuth callback
        const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
        const searchParams = new URLSearchParams(window.location.search);
        const hasAuthFragment = 
          hashParams.has('access_token') || 
          hashParams.has('error') || 
          searchParams.has('code') ||
          window.location.href.includes('type=recovery');
        
        if (hasAuthFragment) {
          console.log('Auth fragment detected in URL, handling as potential OAuth callback');
        }
        
        // Add a timeout to prevent getting stuck in loading
        const timeoutPromise = new Promise<{data: {session: null}}>(resolve => {
          const timer = setTimeout(() => {
            console.warn('Auth session fetch timed out, continuing without session');
            resolve({data: {session: null}});
          }, 15000); // Increased timeout to 15 seconds
          return () => clearTimeout(timer);
        });
        
        // Race between the actual auth fetch and the timeout
        console.log("Attempting to get session from Supabase...");
        const sessionStart = Date.now();
        
        try {
        const { data } = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]);
          
          console.log(`Session retrieved in ${Date.now() - sessionStart}ms:`, data.session ? 'Valid session' : 'No session');
        
        setSession(data.session);
        setUser(data.session?.user ?? null);
        
        if (data.session?.user) {
          await fetchProfile(data.session.user.id);
        } else {
          setProfile(null);
          }
        } catch (sessionError) {
          console.error("Error getting session:", sessionError);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        // Ensure loading is set to false regardless of success or failure
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null;
    try {
      const { data } = supabase.auth.onAuthStateChange(
        async (_event: string, session: Session | null) => {
          setSession(session);
          setUser(session?.user ?? null);
            
          if (session?.user) {
            await fetchProfile(session.user.id);
          } else {
            setProfile(null);
          }
        }
      );
      subscription = data.subscription;
    } catch (err) {
      console.error('Error setting up auth state listener:', err);
    }
    
    // Listen for visibility changes to refresh auth state and reconnect
    const handleVisibilityEvent = async (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Visibility change event received:', customEvent.detail);
      
      if (customEvent.detail?.visible) {
        // Check if we have a user but no connection
        if (user && connectionError) {
          console.log('Refreshing auth state after visibility change');
          try {
            // Try to refresh the session
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              console.log('Session successfully refreshed after visibility change');
              setConnectionError(false);
              setSession(data.session);
              setUser(data.session.user);
              
              if (data.session.user) {
                await fetchProfile(data.session.user.id);
              }
            }
          } catch (err) {
            console.error('Error refreshing session after visibility change:', err);
          }
        }
      }
    };
    
    // Add visibility change handler for browser tab switching
    const handleBrowserVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('Browser tab became visible');
        
        // Mark that we're handling visibility change
        document.body.dataset.handlingVisibility = 'true';
        
        // Only check connection status without refreshing session
        if (user && session) {
          console.log('User session exists, checking realtime connection status only');
          
          try {
            // Check if realtime connection is closed
            const connectionState = supabase.realtime.connectionState();
            if (connectionState === 'closed') {
              console.log('Realtime connection is closed, reconnecting without refreshing session');
              
              // Just reconnect without refreshing the auth token
              supabase.realtime.connect();
              console.log('Realtime connection reconnected');
            } else {
              console.log(`Realtime connection is in ${connectionState} state, no reconnection needed`);
            }
            
            // If we had a connection error, check if it's resolved
            if (connectionError) {
              console.log('Connection error flag was set, checking if connection is restored');
              
              // Just check if database is accessible without refreshing auth
              const { connected } = await checkDatabaseHealth();
              if (connected) {
                console.log('Connection restored, clearing connection error flag');
                setConnectionError(false);
              }
            }
          } catch (err) {
            console.error('Error handling visibility change:', err);
          }
        }
        
        // Clear handling state after a delay
        setTimeout(() => {
          document.body.dataset.handlingVisibility = 'false';
        }, 500);
      }
    };
    
    document.addEventListener('app:visibility-change', handleVisibilityEvent);
    document.addEventListener('visibilitychange', handleBrowserVisibilityChange);

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      document.removeEventListener('app:visibility-change', handleVisibilityEvent);
      document.removeEventListener('visibilitychange', handleBrowserVisibilityChange);
      clearTimeout(loadingTimeoutId);
      
      // Clean up connection checker on unmount
      if (connectionCheckerRef.current) {
        window.clearInterval(connectionCheckerRef.current);
        connectionCheckerRef.current = null;
      }
    };
  }, [user, connectionError, loading]);

  // Set up connection checker in a separate effect
  useEffect(() => {
    // Setup periodic connection checker if there's a connection error
    if (connectionError) {
      // Clear any existing interval
      if (connectionCheckerRef.current) {
        window.clearInterval(connectionCheckerRef.current);
        connectionCheckerRef.current = null;
      }
      
      // Run initial check immediately
      checkConnection().then(connected => {
        if (connected) {
          console.log('Initial check shows connection is restored');
          setConnectionError(false);
        }
      });
      
      // Set up a new checker that runs every 20 seconds (reduced from 30)
      connectionCheckerRef.current = window.setInterval(() => {
        console.log('Running periodic connection check...');
        checkConnection()
          .then(connected => {
            if (connected) {
              console.log('Connection restored, clearing connection checker');
              // If connection is restored, clear the interval
              if (connectionCheckerRef.current) {
                window.clearInterval(connectionCheckerRef.current);
                connectionCheckerRef.current = null;
              }
              
              // Don't reload the page, just update the state
              console.log('Connection restored - continuing without page reload');
            } else {
              console.log('Connection still down during periodic check');
            }
          })
          .catch(err => {
            console.error('Error during periodic connection check:', err);
          });
      }, 20000); // Check every 20 seconds instead of 30
      
      // Log the checker setup
      console.log('Connection error detected, set up periodic connection checker');
    } else {
      // Clear any existing interval if connection is working
      if (connectionCheckerRef.current) {
        window.clearInterval(connectionCheckerRef.current);
        connectionCheckerRef.current = null;
        console.log('Connection working, cleared connection checker');
      }
    }

    return () => {
      // Clean up connection checker when this effect is cleaned up
      if (connectionCheckerRef.current) {
        window.clearInterval(connectionCheckerRef.current);
        connectionCheckerRef.current = null;
      }
    };
  }, [connectionError]); // Only depend on connectionError

  // Use a reference to track retry attempts for profile fetching
  const profileFetchRetryCount = React.useRef(0);
  const MAX_PROFILE_FETCH_RETRIES = 3;

  const fetchProfile = async (userId: string): Promise<void> => {
    try {
      if (DEBUG_AUTH) console.log(`Fetching profile for user ID: ${userId}`);
      
      // Reset retry counter on new fetch attempts
      if (profileFetchRetryCount.current >= MAX_PROFILE_FETCH_RETRIES) {
        console.warn(`Maximum profile fetch retries (${MAX_PROFILE_FETCH_RETRIES}) reached, creating default profile`);
        return await createDefaultProfile(userId);
      }
      
      // First, check if the profile exists to avoid timeout errors
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('id', userId);
        
      if (countError) {
        console.error('Error checking profile count:', countError);
        
        // If we can't even check if profile exists, try to create one
        if (countError.message.includes('timeout') || countError.code === 'PGRST') {
          profileFetchRetryCount.current++;
          console.warn(`Profile count check failed (attempt ${profileFetchRetryCount.current}/${MAX_PROFILE_FETCH_RETRIES})`);
          
          if (profileFetchRetryCount.current >= MAX_PROFILE_FETCH_RETRIES) {
            return await createDefaultProfile(userId);
          }
          
          // Add delay between retries
          await new Promise(resolve => setTimeout(resolve, 1000));
          return await fetchProfile(userId);
        }
      } else if (count === 0) {
        console.log(`No profile found for user ${userId}, creating default profile...`);
        // Profile doesn't exist, create one immediately
        return await createDefaultProfile(userId);
      }
      
      // Add a timeout to prevent getting stuck
      const timeoutPromise = new Promise<{data: null, error: Error}>(resolve => {
        const timer = setTimeout(() => {
          resolve({
            data: null, 
            error: new Error('Profile fetch timed out')
          });
        }, 10000); // Increased to 10 seconds timeout
        return () => clearTimeout(timer);
      });
      
      const { data, error } = await Promise.race([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        timeoutPromise
      ]);

      if (error) {
        console.error('Error fetching profile:', error);
        
        // If the error is a timeout or not found, try retrying before creating a default profile
        if (error.message.includes('timed out') || error.message.includes('not found')) {
          profileFetchRetryCount.current++;
          console.warn(`Profile fetch failed (attempt ${profileFetchRetryCount.current}/${MAX_PROFILE_FETCH_RETRIES}): ${error.message}`);
          
          if (profileFetchRetryCount.current >= MAX_PROFILE_FETCH_RETRIES) {
            console.log('Maximum retries reached, creating default profile...');
            return await createDefaultProfile(userId);
          }
          
          // Add delay between retries that increases with each retry
          await new Promise(resolve => setTimeout(resolve, 1000 * profileFetchRetryCount.current));
          return await fetchProfile(userId);
        }
        return;
      }

      // Reset retry counter on successful fetch
      profileFetchRetryCount.current = 0;

      if (DEBUG_AUTH) {
        console.log('Profile loaded successfully:', data);
        console.log(`Admin status: ${data.is_admin ? 'YES' : 'NO'}`);
        console.log(`Premium status: ${data.is_premium ? 'YES' : 'NO'}`);
      }

      setProfile(data as Profile);
    } catch (err) {
      console.error('Profile fetch error:', err);
      
      // Increment retry counter and retry or create default profile
      profileFetchRetryCount.current++;
      if (profileFetchRetryCount.current >= MAX_PROFILE_FETCH_RETRIES) {
        // Create a default profile as a fallback
        await createDefaultProfile(userId);
      } else {
        // Add delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchProfile(userId);
      }
    }
  };
  
  // Helper function to create a default profile if none exists
  const createDefaultProfile = async (userId: string) => {
    try {
      if (DEBUG_AUTH) console.log('Creating default profile for user', userId);
      
      // Get user details first
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user details:', userError);
        // Set a minimal profile to prevent infinite loading
        const minimalProfile = {
          id: userId,
          username: `user_${userId.substring(0, 8)}`,
          full_name: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_admin: false,
          is_premium: false,
          user_id: userId
        } as Profile;
        
        setProfile(minimalProfile);
        return;
      }
      
      // Check for existing profile one more time to prevent duplicates
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (existingProfile) {
        console.log('Profile already exists, using existing profile');
        setProfile(existingProfile as Profile);
        return;
      }
      
      // Create default profile
      const defaultProfile = {
          id: userId,
          username: userData.user?.email?.split('@')[0] || `user_${userId.substring(0, 8)}`,
          full_name: userData.user?.user_metadata?.full_name || '',
          avatar_url: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_admin: false,
          is_premium: false
      };
      
      console.log('Inserting default profile:', defaultProfile);
      
      // Try upsert first to handle potential race conditions
      const { data: upsertData, error: upsertError } = await supabase
        .from('profiles')
        .upsert(defaultProfile)
        .select();
        
      if (upsertError) {
        console.error('Error upserting default profile:', upsertError);
        
        // Try inserting as a fallback
        const { data: insertData, error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile)
          .select();
          
        if (insertError) {
          console.error('Error inserting default profile:', insertError);
          
          // Last resort: just set the profile in state so the app can function
          setProfile(defaultProfile as Profile);
        } else if (insertData && insertData.length > 0) {
          console.log('Default profile inserted successfully:', insertData);
          setProfile(insertData[0] as Profile);
        }
      } else if (upsertData && upsertData.length > 0) {
        console.log('Default profile upserted successfully:', upsertData);
        setProfile(upsertData[0] as Profile);
      }
      
      // Reset retry counter after creating a profile
      profileFetchRetryCount.current = 0;
    } catch (err) {
      console.error('Error in createDefaultProfile:', err);
      
      // Ensure we have some profile data so the app doesn't get stuck
      const fallbackProfile = {
        id: userId,
        username: `user_${userId.substring(0, 6)}`,
        full_name: '',
        avatar_url: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_admin: false,
        is_premium: false,
        user_id: userId
      } as Profile;
      
      setProfile(fallbackProfile);
      profileFetchRetryCount.current = 0;
    }
  };

  // Add a function to manually refresh profile data
  const refreshProfile = async () => {
    if (!user) return;
    
    if (connectionError) {
      console.warn('Cannot refresh profile: Database connection error');
      return;
    }
    
    console.log('Manually refreshing profile data...');
    await fetchProfile(user.id);
  };

  const signIn = async (email: string, password: string) => {
    try {
      // If we have connection error but user is trying to sign in,
      // let them know about the connection issue
      if (connectionError) {
        console.error('Cannot sign in: Database connection error');
        return { 
          data: null, 
          error: new Error('Cannot sign in due to connection issues. Please check your internet connection and try again.') 
        };
      }
      
      return await supabase.auth.signInWithPassword({ email, password });
    } catch (err) {
      console.error('Sign in error:', err);
      return { data: null, error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (!error && data?.user) {
        // Create profile entry
        await supabase.from('profiles').insert([
          {
            id: data.user.id,
            username: email.split('@')[0],
            full_name: fullName,
            avatar_url: '', // Use empty string instead of null
          },
        ]);

        // Create default user settings
        await supabase.from('user_settings').insert([
          {
            user_id: data.user.id,
            notifications_enabled: true,
            dark_mode: true,
            data_sharing_enabled: false,
            language: 'en',
            measurement_unit: 'metric',
          },
        ]);

        // Create initial subscription (free plan)
        await supabase.from('subscriptions').insert([
          {
            user_id: data.user.id,
            plan: 'free',
            start_date: new Date().toISOString(),
            is_active: true,
            payment_status: 'none',
          },
        ]);
      }

      return { data, error };
    } catch (err) {
      console.error('Sign up error:', err);
      return { data: null, error: err as Error };
    }
  };

  const signOut = async () => {
    // Clear auth state first
    setUser(null);
    setProfile(null);
    setSession(null);
    
    // Reset connection error flag to prevent showing error page after logout
    setConnectionError(false);
    
    // Clear offline fallback
    offlineFallback.user = null;
    offlineFallback.session = null;
    offlineFallback.profile = null;
    
    try {
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      }
      
      // Clear any locally stored session data
      try {
        localStorage.removeItem('supabase.auth.token');
      } catch (storageError) {
        console.error('Error clearing local storage:', storageError);
      }
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      // Ensure the correct URL for password reset
      const resetUrl = `${window.location.origin}/reset-password`;
      console.log('Sending password reset to email:', email);
      console.log('Using redirect URL:', resetUrl);
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      });
      
      if (error) {
        console.error('Password reset error:', error);
      } else {
        console.log('Password reset email sent successfully');
      }
      
      return { data, error };
    } catch (err) {
      console.error('Reset password error:', err);
      return { data: null, error: err as Error };
    }
  };

  const updateProfile = async (profileData: Partial<Profile>) => {
    if (!user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...profileData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return { data: null, error };
      }

      setProfile(data as Profile);
      return { data: data as Profile, error: null };
    } catch (err) {
      console.error('Update profile error:', err);
      return { data: null, error: err as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Check if we're in the OAuth callback phase by looking for code parameter
      const url = new URL(window.location.href);
      const hasAuthCode = url.searchParams.has('code') || url.hash.includes('access_token=');
      
      if (DEBUG_AUTH) {
        console.log('Google OAuth flow:', { 
          hasAuthCode,
          hasCodeParam: url.searchParams.has('code'),
          hasAccessToken: url.hash.includes('access_token='),
          currentPath: window.location.pathname,
          fullUrl: window.location.href.substring(0, 100) // Truncate for logs
        });
      }
      
      // Check if Supabase is accessible first with a timeout
      const timeoutPromise = new Promise<{data: null, error: Error}>((resolve) => {
        setTimeout(() => {
          resolve({ 
            data: null, 
            error: new Error('Connection to authentication service timed out. Please check your internet connection and try again.') 
          });
        }, 10000); // 10 second timeout
      });
      
      // Modified handling for connection errors during OAuth
      try {
        // Quick connectivity check before proceeding
        const connectivityCheckPromise = checkConnection();
        const connectivityResult = await Promise.race([
          new Promise<{data: null, error: Error} | boolean>(resolve => {
            connectivityCheckPromise.then(result => resolve(result));
          }), 
          timeoutPromise
        ]);
        
        if (typeof connectivityResult === 'object' && 'error' in connectivityResult) {
          console.error('Connection timeout detected before processing OAuth');
          return connectivityResult;
        }
        
        const isConnected = await connectivityCheckPromise;
        if (!isConnected) {
          console.error('Connection error detected before processing OAuth');
          return { 
            data: null, 
            error: new Error('Could not connect to authentication service. Please check your internet connection and try again.') 
          };
        }
      } catch (connErr) {
        console.error('Connection check failed during OAuth flow:', connErr);
        // Continue with the flow, as the error might be temporary
      }
      
      if (hasAuthCode) {
        // We're in the callback phase - let Supabase handle the token exchange
        console.log('Processing OAuth callback with code parameter or hash fragment');
        
        // Exchange the code for a session
        try {
          // First check if we have a hash fragment with access_token (implicit flow)
          if (url.hash.includes('access_token=')) {
            console.log('Detected access_token in hash, handling implicit flow');
            
            // Give the browser a moment to process the hash
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // The Supabase client should automatically detect and use the hash fragment
            const sessionResult = await Promise.race([supabase.auth.getSession(), timeoutPromise]);
            
            if (sessionResult.error) {
              console.error('Error in implicit flow session retrieval:', sessionResult.error);
              
              // Try to explicitly extract and set the access token as a fallback
              try {
                const hashParams = new URLSearchParams(url.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const expiresIn = hashParams.get('expires_in');
                
                if (accessToken) {
                  console.log('Manually processing access token from hash');
                  
                  // Use setSession directly with the extracted token
                  const manualSessionResult = await Promise.race([
                    supabase.auth.setSession({
                      access_token: accessToken,
                      refresh_token: '' // We don't have a refresh token in implicit flow
                    }),
                    timeoutPromise
                  ]);
                  
                  if (manualSessionResult.error) {
                    console.error('Manual session setup failed:', manualSessionResult.error);
                    return manualSessionResult;
                  }
                  
                  if (manualSessionResult.data?.session) {
                    console.log('Successfully set session from hash parameters');
                    return manualSessionResult;
                  }
                }
              } catch (hashErr) {
                console.error('Error processing hash parameters:', hashErr);
              }
              
              return sessionResult;
            }
            
            if (sessionResult.data?.session) {
              console.log('Successfully retrieved session from implicit flow');
              return sessionResult;
            }
          }
          
          // Wait for Supabase to process the OAuth code if using authorization code flow
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Set a timeout for session retrieval to avoid getting stuck
          const sessionPromise = supabase.auth.getSession();
          const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);
          
          if (DEBUG_AUTH) {
            console.log('Session data after getSession:', { 
              hasSession: !!data?.session,
              error: error ? error.message : null
            });
          }
        
        if (error) {
            console.error('Error getting session during OAuth callback:', error);
          return { data: null, error };
        }
        
          if (data?.session) {
            console.log('Successfully retrieved session from OAuth callback');
            // Session exists, we're good
          return { data, error: null };
          } else {
            console.log('No session available yet from callback, trying session retrieval again...');
            
            // Try one more time after a short delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            const retrySessionPromise = supabase.auth.getSession();
            const retryResult = await Promise.race([retrySessionPromise, timeoutPromise]);
            
            if (retryResult.data?.session) {
              console.log('Successfully retrieved session from OAuth callback on retry');
              return retryResult;
            } else if (retryResult.error) {
              console.error('Error retrieving session on retry:', retryResult.error);
              return retryResult;
            } else {
              console.log('Still no session available after retry');
              
              // Check if we have a code parameter for authorization code flow
              if (url.searchParams.has('code')) {
                try {
                  console.log('Attempting to exchange OAuth token explicitly');
                  // The URL contains the authorization code, which we can use to get a session
                  const codeParam = url.searchParams.get('code') || '';
                  console.log('Exchanging code param:', codeParam.substring(0, 10) + '...');
                  
                  const exchangePromise = supabase.auth.exchangeCodeForSession(codeParam);
                  const exchangeResult = await Promise.race([exchangePromise, timeoutPromise]);
                  
                  if (exchangeResult.data?.session) {
                    console.log('Successfully exchanged code for session');
                    return exchangeResult;
                  } else if (exchangeResult.error) {
                    console.error('Failed to exchange code for session:', exchangeResult.error);
                    return exchangeResult;
                  }
                } catch (exchangeErr) {
                  console.error('Error during token exchange:', exchangeErr);
                  return { 
                    data: null, 
                    error: exchangeErr instanceof Error ? exchangeErr : new Error('Failed to exchange authorization code for session')
                  };
                }
              }
              
              // Last resort - check if we already have a stored session in localStorage
              try {
                console.log('Checking for existing session in localStorage as last resort');
                const storedSession = localStorage.getItem('supabase.auth.token');
                
                if (storedSession) {
                  console.log('Found stored session, attempting to restore');
                  const refreshResult = await Promise.race([
                    supabase.auth.refreshSession(),
                    timeoutPromise
                  ]);
                  
                  if (refreshResult.data?.session) {
                    console.log('Successfully restored session from localStorage');
                    return refreshResult;
                  }
                }
              } catch (storageErr) {
                console.error('Error checking localStorage:', storageErr);
              }
              
              return { data: null, error: new Error('Failed to retrieve session after OAuth callback') };
            }
          }
        } catch (sessionError) {
          console.error('Unexpected error during OAuth session retrieval:', sessionError);
          return { data: null, error: sessionError as Error };
        }
      }
      
      // Starting a new OAuth flow (not in callback phase)
      console.log('Starting new Google OAuth flow');
      
      // Get current origin and path for constructing the redirect URL
      const origin = window.location.origin;
      const currentPath = window.location.pathname;
      
      // Determine appropriate redirect path
      // If we're on login or register pages, redirect to face-rating after auth
      // Otherwise, redirect back to the current page
      const redirectPath = 
        currentPath === '/login' || 
        currentPath === '/register' || 
        currentPath === '/' 
          ? '/face-rating' 
          : currentPath;
      
      // Preserve query parameters from the current URL that we want to keep after redirect
      const currentQuery = new URLSearchParams(window.location.search);
      const preserveParams = ['redirect']; // Parameters we want to preserve
      const redirectParams = new URLSearchParams();
      
      preserveParams.forEach(param => {
        if (currentQuery.has(param)) {
          redirectParams.set(param, currentQuery.get(param)!);
        }
      });
      
      // Construct the redirect URL with proper parameters
      const redirectUrl = `${origin}${redirectPath}${redirectParams.toString() ? '?' + redirectParams.toString() : ''}`;
      
      if (DEBUG_AUTH) {
        console.log('Starting OAuth flow with redirect to:', redirectUrl);
      }
      
      // Start the OAuth flow with improved parameters and timeout
      const oauthPromise = supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account' // Allow user to select account each time
          },
          skipBrowserRedirect: false // Ensure the browser redirects
        }
      });
      
      try {
        const result = await Promise.race([oauthPromise, timeoutPromise]);
        
        if (result.error) {
          console.error('Error initiating OAuth flow:', result.error);
          return result;
        }
        
        // Successfully initiated OAuth flow
        console.log('OAuth initiation successful, redirecting...');
        return result;
      } catch (flowErr) {
        console.error('Error during OAuth flow initiation:', flowErr);
        return { 
          data: null, 
          error: flowErr instanceof Error ? flowErr : new Error('Failed to start Google sign-in process') 
        };
      }
    } catch (err) {
      console.error('Error in Google sign in flow:', err);
      return { data: null, error: err as Error };
    }
  };

  // Add a function to check connection status and try to recover
  const checkConnection = async () => {
    try {
      const { connected } = await checkDatabaseHealth();
      setConnectionError(!connected);
      return connected;
    } catch (err) {
      console.error('Error checking connection:', err);
        setConnectionError(true);
        return false;
      }
  };

  // Add a function to force refresh the session
  const forceRefreshSession = async () => {
    try {
      console.log('Forcing session refresh');
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
            setConnectionError(false);
        
        if (data.session.user) {
          await fetchProfile(data.session.user.id);
      }
      return true;
      }
      return false;
    } catch (err) {
      console.error('Error forcing session refresh:', err);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        connectionError,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateProfile,
        signInWithGoogle,
        refreshProfile,
        checkConnection,
        forceRefreshSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 