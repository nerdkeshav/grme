import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../layout/AuthLayout';

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { signUp, signInWithGoogle, user } = useAuth();
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
      navigate(getRedirectPath(), { replace: true });
      return;
    }
    
    // Check if we have a code parameter in the URL (Google OAuth callback)
    const hasAuthCode = location.search.includes('code=');
    if (hasAuthCode && !user && !googleLoading) {
      console.log('Auth code detected on register page, attempting to complete Google sign-in');
      setGoogleLoading(true);
      
      // Complete the sign-in flow
      handleGoogleAuthCallback();
    }
  }, [user, navigate, location]);
  
  // Handle Google OAuth callback
  const handleGoogleAuthCallback = async () => {
    try {
      console.log('Processing Google sign-in callback from register page...');
      setError('');
      
      // The code is included in the URL already, so we just need to exchange it
      const { data, error } = await signInWithGoogle();
      
      if (error) {
        console.error('Google sign-in callback error on register page:', error);
        
        // Check if this is a connection error and show a more user-friendly message
        if (error.message && (
            error.message.includes('network') || 
            error.message.includes('connect') || 
            error.message.includes('internet') ||
            error.message.includes('offline')
        )) {
          setError('Unable to connect to authentication service. Please check your internet connection and try again.');
        } else {
        setError(error.message || 'Failed to complete Google sign-in');
        }
        
        setGoogleLoading(false);
        return;
      }
      
      if (data?.session) {
        // Successfully logged in
        console.log('Google sign-in successful from register page, session established');
        navigate(getRedirectPath(), { replace: true });
      } else {
        // No session could mean we need to wait a bit longer
        console.log('No session established after Google callback on register page, trying again in 1s');
        
        // Try one more time after a short delay
        setTimeout(async () => {
          try {
            const retryResult = await signInWithGoogle();
            if (retryResult.data?.session) {
              console.log('Google sign-in successful on retry from register page');
              navigate(getRedirectPath(), { replace: true });
              return;
            } else {
              console.log('Still no session available after retry from register page');
              // Check if we can manually get the session
              try {
                const sessionCheck = await signInWithGoogle();
                if (sessionCheck.data?.session) {
                  console.log('Session found on final check');
                  navigate(getRedirectPath(), { replace: true });
                  return;
                }
              } catch (finalErr) {
                console.error('Final session check failed:', finalErr);
              }
              
              setError('Google sign-in was not completed. Please try again.');
              setGoogleLoading(false);
            }
          } catch (retryErr) {
            console.error('Error during sign-in retry from register page:', retryErr);
            setError('Failed to complete Google sign-in');
        setGoogleLoading(false);
          }
        }, 1000);
      }
    } catch (err: any) {
      console.error('Unexpected error during Google sign-in callback on register page:', err);
      setError(err.message || 'Failed to complete Google sign-in');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { error } = await signUp(email, password, fullName);
      
      if (error) {
        setError(error.message);
      } else {
        setSuccessMessage('Registration successful! Please check your email to confirm your account.');
        // Clear the form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setFullName('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setSuccessMessage('');
    setGoogleLoading(true);
    console.log('Initiating Google sign up...');

    // Set a timeout to exit loading state if it takes too long
    const loadingTimeout = setTimeout(() => {
      if (googleLoading) {
        console.warn('Google sign-up timeout reached, resetting loading state');
        setGoogleLoading(false);
        setError('Sign up with Google is taking too long. Please try again or use email signup instead.');
      }
    }, 10000); // 10 seconds timeout

    try {
      // Check for any URL parameters we need to preserve after login
      const params = new URLSearchParams(location.search);
      const redirectPath = params.get('redirect');
      
      // Start the OAuth flow
      const { data, error } = await signInWithGoogle();
      
      // Clear the timeout as we got a response
      clearTimeout(loadingTimeout);
      
      if (error) {
        console.error('Google sign up initiation error:', error);
        
        // Handle connection errors
        if (error.message && (
            error.message.includes('network') || 
            error.message.includes('connect') || 
            error.message.includes('internet') ||
            error.message.includes('offline')
        )) {
          setError('Unable to connect to Google authentication service. Please check your internet connection and try again.');
        } else {
          setError(error.message || 'Failed to start Google sign-up');
        }
        
        setGoogleLoading(false);
        return;
      }
      
      console.log('Google sign up successfully initiated');
      
      // If we have a session already, we're done
      if (data?.session) {
        console.log('Session established immediately after OAuth initiation on register page');
        navigate(getRedirectPath(), { replace: true });
        return;
      }
      
      // For most cases, the OAuth flow continues without immediately returning a session
      // User will be redirected to Google's consent page
      console.log('Redirecting to Google for authentication from register page...');
      
      // Keep loading state active for better UX during redirect
    } catch (err: any) {
      // Clear the timeout as we encountered an error
      clearTimeout(loadingTimeout);
      
      console.error('Unexpected error during Google sign up:', err);
      setError(err.message || 'Failed to sign up with Google');
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Create Account</h1>
          <p className="text-muted">Sign up to get started</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
            <label htmlFor="fullName" className="block text-sm font-medium mb-1">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-surface text-text rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
              />
            </div>

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
            <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-surface text-text rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
              />
            </div>

            <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-surface text-text rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
              />
          </div>

            <button
              type="submit"
              disabled={loading}
            className="w-full py-2 px-4 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
            >
            {loading ? 'Creating Account...' : 'Create Account'}
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
              onClick={handleGoogleSignUp}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-2 px-4 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
            >
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" />
              </svg>
              {googleLoading ? 'Processing...' : 'Sign up with Google'}
            </button>
          </div>
          </div>

        <p className="mt-8 text-center text-sm">
            Already have an account?{' '}
          <Link to="/login" className="font-medium hover:underline">
              Sign in
            </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Register; 