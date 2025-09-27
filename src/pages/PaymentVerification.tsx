import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifyPayPalPayment, updatePaymentStatus, updateUserSubscription } from '../api/paymentService';
import AppLayout from '../components/layout/AppLayout';

const PaymentVerification: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      // Get payment parameters from URL
      const params = new URLSearchParams(location.search);
      const tx = params.get('tx');
      const status = params.get('status');
      
      // Get payment ID from localStorage (stored during payment initiation)
      const paymentId = localStorage.getItem('pendingPaymentId');
      
      if (!tx || !status || !paymentId || !user) {
        setStatus('error');
        setErrorMessage('Missing payment information. Please contact support.');
        return;
      }

      try {
        // Verify the payment with PayPal
        const verificationResult: any = await verifyPayPalPayment(tx);
        
        if (verificationResult.verified) {
          // Update payment status in database
          await updatePaymentStatus(paymentId, 'completed');
          
          // Get billing cycle from localStorage
          const billingCycle: 'monthly' | 'yearly' = 
            localStorage.getItem('billingCycle') === 'yearly' ? 'yearly' : 'monthly';
          
          // Update user's subscription
          await updateUserSubscription(user.id, billingCycle);
          
          // Clear stored payment data
          localStorage.removeItem('pendingPaymentId');
          localStorage.removeItem('billingCycle');
          
          // Update status
          setStatus('success');
          
          // Redirect to subscription page after delay
          setTimeout(() => {
            navigate('/subscription', { replace: true });
          }, 3000);
        } else {
          // Payment verification failed
          await updatePaymentStatus(paymentId, 'failed');
          setStatus('error');
          setErrorMessage('Payment verification failed. Please contact support.');
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        setStatus('error');
        setErrorMessage('An error occurred during payment verification. Please contact support.');
      }
    };

    verifyPayment();
  }, [location, navigate, user]);

  return (
    <AppLayout>
      <div className="max-w-md mx-auto mt-16 p-6 bg-surface rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Payment Verification</h1>
        
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin h-12 w-12 border-4 border-accent border-t-transparent rounded-full mb-4"></div>
            <p className="text-center text-lg">Verifying your payment...</p>
            <p className="text-center text-muted mt-2">Please wait while we confirm your payment.</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 text-green-500 rounded-full mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
            <p className="text-muted mb-6">Your subscription has been activated successfully.</p>
            <p className="text-accent">Redirecting to your subscription page...</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 text-red-500 rounded-full mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Payment Verification Failed</h2>
            <p className="text-muted mb-4">{errorMessage || 'There was an error processing your payment.'}</p>
            <button
              onClick={() => navigate('/subscription')}
              className="px-4 py-2 bg-accent text-buttonText rounded-md hover:bg-accent/90"
            >
              Return to Subscription Page
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default PaymentVerification; 