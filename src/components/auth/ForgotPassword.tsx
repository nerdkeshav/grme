import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../layout/AuthLayout';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setError('');
    setMessage('');
    setLoading(true);

    try {
      // Log the reset process
      console.log('Sending password reset request for:', email);
      
      const { error } = await resetPassword(email);
      
      if (error) {
        console.error('Password reset error:', error);
        setError(error.message);
      } else {
        setMessage('Check your email for the password reset link');
        // Clear the email input after successful request
        setEmail('');
      }
    } catch (err: any) {
      console.error('Failed to send reset link:', err);
      setError(err.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md space-y-6 rounded-xl bg-surface p-6 sm:p-8 shadow-lg m-4 animate-fadeIn">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">GRME</h1>
          <h2 className="mt-2 text-xl font-semibold">Reset Your Password</h2>
          <p className="mt-2 text-sm text-muted">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-md bg-green-500/20 px-4 py-3 text-sm text-green-400">
            {message}
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text/80">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 px-3 py-2 text-text focus:border-primary focus:ring-primary sm:text-sm"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-70"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>

          <div className="flex items-center justify-center text-sm">
            <Link to="/login" className="text-secondary hover:text-secondary/80">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword; 