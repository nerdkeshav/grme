import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../layout/AuthLayout';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const checkResetToken = async () => {
      // Parse URL for components
      const searchParams = new URLSearchParams(location.search);
      const hashParams = new URLSearchParams(location.hash.replace('#', ''));
      
      // Check for error in URL params - common when links expire
      const errorFromURL = searchParams.get('error') || hashParams.get('error');
      const errorDescription = 
        searchParams.get('error_description') || 
        hashParams.get('error_description') || 
        'Invalid or expired password reset link';
      
      if (errorFromURL) {
        console.log('Error from URL:', errorFromURL, decodeURIComponent(errorDescription));
        setError(decodeURIComponent(errorDescription));
        setTokenValid(false);
        return;
      }
      
      // Extract auth parameters
      const accessToken = hashParams.get('access_token');
      const typeParam = hashParams.get('type');
      const codeParam = searchParams.get('code');
      const refreshToken = hashParams.get('refresh_token');
      
      console.log('Reset password auth parameters:', { 
        hasAccessToken: !!accessToken,
        hasTypeRecovery: typeParam === 'recovery',
        hasCode: !!codeParam,
        hasRefreshToken: !!refreshToken,
        urlPath: location.pathname,
        searchParams: Object.fromEntries(searchParams.entries()),
        hashParams: Object.fromEntries(hashParams.entries())
      });
      
      // Check if the reset link has the necessary parameters
      const isValidResetLink = (
        !!accessToken || 
        (typeParam === 'recovery') || 
        !!codeParam ||
        // If code is in the URL path (Supabase sometimes does this)
        location.pathname.includes('/reset-password/code=')
      );
      
      if (!isValidResetLink && !user) {
        console.log('No valid reset parameters found');
        setError('Invalid password reset link. Please request a new link.');
        setTokenValid(false);
        return;
      }
      
      // Handle code parameter if present
      if (codeParam && !accessToken) {
        try {
          console.log('Exchanging code parameter for session');
          // Exchange code for session - this should happen automatically
          // but we'll make it explicit here
          await supabase.auth.exchangeCodeForSession(codeParam);
          setTokenValid(true);
        } catch (codeError) {
          console.error('Error exchanging code for session:', codeError);
          setError('Error processing password reset link. Please try again.');
          setTokenValid(false);
          return;
        }
      } else {
        // If we have an access token, we're good
        setTokenValid(true);
      }
    };
    
    checkResetToken();
  }, [location, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Form validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      console.log('Updating password...');
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        console.error('Password update error:', updateError);
        setError(updateError.message);
      } else {
        console.log('Password updated successfully');
        setMessage('Password updated successfully! Redirecting to login...');
        
        // Sign the user out to clear any session state
        await supabase.auth.signOut();
        
        // Redirect to login after a delay
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      }
    } catch (err: any) {
      console.error('Unexpected error during password update:', err);
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  // Render different content based on token validity
  const renderContent = () => {
    if (tokenValid === null) {
      // Still checking token
      return (
        <div className="text-center py-6">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-accent mx-auto"></div>
          <p className="mt-3 text-accent">Verifying your reset link...</p>
        </div>
      );
    } else if (tokenValid === false) {
      // Invalid or expired token
      return (
        <div className="rounded-md bg-red-500/20 px-4 py-4 text-sm text-red-400">
          <p className="mb-3">{error}</p>
          <p className="mb-3">
            The password reset link may have expired or is invalid. Please request a new password reset link.
          </p>
          <div className="mt-4">
            <Link 
              to="/forgot-password" 
              className="px-4 py-2 bg-secondary text-white rounded-md inline-block text-center"
            >
              Request New Link
            </Link>
          </div>
        </div>
      );
    } else {
      // Valid token, show password reset form
      return (
        <>
          {error && (
            <div className="rounded-md bg-red-500/20 px-4 py-3 text-sm text-red-400 mb-4">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-md bg-green-500/20 px-4 py-3 text-sm text-green-400 mb-4">
              {message}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4 rounded-md">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-text/80">
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 px-3 py-2 text-text focus:border-primary focus:ring-primary sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text/80">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 px-3 py-2 text-text focus:border-primary focus:ring-primary sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-70"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </>
      );
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md space-y-6 rounded-xl bg-surface p-6 sm:p-8 shadow-lg m-4 animate-fadeIn">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">GRME</h1>
          <h2 className="mt-2 text-xl font-semibold">Reset Your Password</h2>
          <p className="mt-2 text-sm text-muted">
            Enter your new password below.
          </p>
        </div>

        {renderContent()}

        <div className="flex items-center justify-center text-sm">
          <Link to="/login" className="text-secondary hover:text-secondary/80">
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;