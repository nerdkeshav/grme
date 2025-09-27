import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../layout/AuthLayout';

// Debug mode
const DEBUG_LOGIN = true;

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { signIn, signInWithGoogle, user, connectionError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the intended destination from URL parameters or use face-rating as default
  const getRedirectPath = () => {
    const params = new URLSearchParams(location.search);
    return params.get('redirect') || '/face-rating';
  };

  useEffect(() => {
    // If user is already logged in, redirect to the intended destination
    if (user) {
      if (DEBUG_LOGIN) console.log('User already logged in, redirecting to:', getRedirectPath());
      navigate(getRedirectPath(), { replace: true });
      return;
    }
    
    // Check for OAuth callback indicators - multiple possible formats
    const hasAuthCode = location.search.includes('code=');
    const hasAccessToken = location.hash.includes('access_token=');
    const hasOAuthIndicator = hasAuthCode || hasAccessToken;
    
    if (DEBUG_LOGIN) {
      console.log('Login component init:', {
        hasAuthCode,
        hasAccessToken,
        user: !!user,
        googleLoading,
        connectionError
      });
    }
    
    if (hasOAuthIndicator && !user && !googleLoading) {
      console.log('Auth indicators detected, attempting to complete Google sign-in');
      setGoogleLoading(true);
      
      // Complete the sign-in flow
      handleGoogleAuthCallback();
    }
    
    // If there's a connection error, provide user feedback
    if (connectionError) {
      setError('Connection issues detected. Please check your internet connection and try again.');
    }
    
    // Cleanup loading state if stuck
    const loadingTimeout = setTimeout(() => {
      if (googleLoading) {
        console.warn('Google loading state stuck, resetting...');
        setGoogleLoading(false);
      }
    }, 15000); // Emergency timeout after 15 seconds
    
    return () => clearTimeout(loadingTimeout);
  }, [user, navigate, location, connectionError]);
  
  // Handle Google OAuth callback
  const handleGoogleAuthCallback = async () => {
    try {
      console.log('Processing Google sign-in callback...');
      setError('');
      
      // The code/token is included in the URL already, handled by the signInWithGoogle function
      const { data, error } = await signInWithGoogle();
      
      if (error) {
        console.error('Google sign-in callback error:', error);
        
        // Check if this is a connection error and show a more user-friendly message
        if (error.message && (
            error.message.includes('network') || 
            error.message.includes('connect') || 
            error.message.includes('internet') ||
            error.message.includes('offline') ||
            error.message.includes('timeout')
        )) {
          setError('Unable to connect to authentication service. Please check your internet connection and try again.');
        } else if (error.message && error.message.includes('session')) {
          setError('Unable to establish a secure session. Please try again or use email login instead.');
        } else {
          setError(error.message || 'Failed to complete Google sign-in');
        }
        
        setGoogleLoading(false);
        return;
      }
      
      if (data?.session) {
        // Successfully logged in
        console.log('Google sign-in successful, session established');
        navigate(getRedirectPath(), { replace: true });
        return;
      }
      
      // No session could mean we need to wait a bit longer
      console.log('No session established after Google callback, trying again in 1s');
      
      // Try one more time after a short delay
      setTimeout(async () => {
        try {
          const retryResult = await signInWithGoogle();
          if (retryResult.data?.session) {
            console.log('Google sign-in successful on retry');
            navigate(getRedirectPath(), { replace: true });
            return;
          } else {
            console.log('Still no session available after retry');
            // Check if user is still not logged in
            if (!user) {
              setError('Google sign-in was not completed. Please try again or use email login.');
              setGoogleLoading(false);
            } else {
              // Something odd happened - user is logged in but we didn't detect it
              console.log('User is logged in but we missed it, redirecting...');
              navigate(getRedirectPath(), { replace: true });
            }
          }
        } catch (retryErr) {
          console.error('Error during sign-in retry:', retryErr);
          setError('Failed to complete Google sign-in. Please try again later.');
          setGoogleLoading(false);
        }
      }, 1500);
    } catch (err: any) {
      console.error('Unexpected error during Google sign-in callback:', err);
      setError(err.message || 'Failed to complete Google sign-in');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Add basic validation
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }
    
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        // Format user-friendly error messages
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (error.message.includes('network') || error.message.includes('connect')) {
          setError('Connection error. Please check your internet and try again.');
        } else {
          setError(error.message);
        }
      } else {
        navigate(getRedirectPath(), { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    setIsRedirecting(false);
    console.log('Initiating Google sign in...');

    // Set a timeout to exit loading state if it takes too long
    const loadingTimeout = setTimeout(() => {
      if (googleLoading) {
        console.warn('Google sign-in timeout reached, resetting loading state');
        setGoogleLoading(false);
        setError('Sign in with Google is taking too long. Please try again or use email login instead.');
      }
    }, 12000); // 12 seconds timeout

    try {
      // Start the OAuth flow
      const { data, error } = await signInWithGoogle();
      
      // Clear the timeout as we got a response
      clearTimeout(loadingTimeout);
      
      if (error) {
        console.error('Google sign in initiation error:', error);
        
        // Handle connection errors
        if (error.message && (
            error.message.includes('network') || 
            error.message.includes('connect') || 
            error.message.includes('internet') ||
            error.message.includes('offline')
        )) {
          setError('Unable to connect to Google authentication service. Please check your internet connection and try again.');
        } else {
          setError(error.message || 'Failed to start Google sign-in');
        }
        
        setGoogleLoading(false);
        return;
      }
      
      console.log('Google sign in successfully initiated');
      
      // If we have a session already, we're done
      if (data?.session) {
        console.log('Session established immediately after OAuth initiation');
        navigate(getRedirectPath(), { replace: true });
        return;
      }
      
      // For most cases, the OAuth flow continues without immediately returning a session
      // User will be redirected to Google's consent page
      console.log('Redirecting to Google for authentication...');
      setIsRedirecting(true);
      
      // Keep loading state active for better UX during redirect
      // We'll set a safety timeout to reset loading if redirect doesn't happen
      setTimeout(() => {
        if (googleLoading && !user) {
          console.warn('Redirect didn\'t occur as expected');
          setGoogleLoading(false);
          setIsRedirecting(false);
          setError('Browser redirect failed. Please try again or use email login.');
        }
      }, 5000);
    } catch (err: any) {
      // Clear the timeout as we encountered an error
      clearTimeout(loadingTimeout);
      
      console.error('Unexpected error during Google sign in initiation:', err);
      setError(err.message || 'Failed to sign in with Google');
      setGoogleLoading(false);
      setIsRedirecting(false);
    }
  };

  // Determine what status message to show during Google auth
  const getGoogleStatusMessage = () => {
    if (isRedirecting) {
      return "Redirecting to Google authentication...";
    }
    return "Connecting to Google...";
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
          <p className="text-muted">Sign in to your account to continue</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-surface text-text rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
              />
            </div>

            <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <Link to="/forgot-password" className="text-sm hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-surface text-text rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

            <button
              type="submit"
              disabled={loading}
            className="w-full py-2 px-4 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
            >
            {loading ? 'Signing in...' : 'Sign In'}
            </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-muted">Or continue with</span>
          </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-2 px-4 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
            >
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" />
              </svg>
              {googleLoading ? getGoogleStatusMessage() : 'Sign in with Google'}
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Login; 