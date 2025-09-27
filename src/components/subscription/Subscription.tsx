import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import AppLayout from '../layout/AppLayout';
import { useLocation, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../shared/LoadingSpinner';
import { 
  createPaymentRecord, 
  updatePaymentStatus, 
  verifyPayPalPayment, 
  updateUserSubscription,
  getPayPalCheckoutUrl
} from '../../api/paymentService';

interface SubscriptionTier {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  recommended?: boolean;
}

// Define subscription tiers here for easy access
const subscriptionTiers: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Basic skin analysis',
      'Limited progress tracking',
      'Community tips'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    monthlyPrice: 9.99,
    yearlyPrice: 8.25,
    features: [
      'Advanced facial analysis & tracking',
      'Unlimited progress tracking',
      'Custom skincare routines',
      'Premium content & tutorials',
      'Community badge & priority support'
    ],
    recommended: true
  }
];

const Subscription: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentStatus, setPaymentStatus] = useState<'none' | 'pending' | 'completed' | 'failed'>('none');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);

  // Get billing cycle from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const billingParam = params.get('billing');
    if (billingParam === 'yearly' || billingParam === 'monthly') {
      setBillingCycle(billingParam);
    }

    // Check for payment verification
    const verificationStatus = params.get('payment_status');
    const transactionId = params.get('tx');
    const paymentIdParam = params.get('payment_id');

    if (verificationStatus && transactionId && paymentIdParam) {
      setPaymentStatus('pending');
      setPaymentId(paymentIdParam);
      handlePaymentVerification(transactionId, paymentIdParam);
    }
  }, [location]);
  
  // Fetch user's current subscription
  useEffect(() => {
    if (user) {
      fetchUserSubscription();
    }
  }, [user]);
  
  const fetchUserSubscription = async () => {
    setLoading(true);
    
    try {
      // Fetch user profile which includes premium status
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', user?.id)
        .single();
      
      if (profileError) throw profileError;
      
      // Fetch subscription details if available
      const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('*')
        .eq('user_id', user?.id)
          .eq('status', 'active')
        .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" error, which is fine if user has no subscription
        throw subscriptionError;
      }
      
      setSubscription(subscriptionData || null);
      setCurrentPlan(profileData?.is_premium ? 'premium' : 'free');
    } catch (err) {
      console.error('Error fetching subscription:', err);
      // Default to free plan if there's an error
          setCurrentPlan('free');
      } finally {
        setLoading(false);
      }
    };
    
  // Handle payment verification after PayPal redirect
  const handlePaymentVerification = async (transactionId: string, paymentId: string) => {
    setPaymentProcessing(true);
    setPaymentError(null);
    
    try {
      // Call the verification function with the correct signature
      const result = await verifyPayPalPayment(transactionId);
      const verified = result && typeof result === 'object' && 'verified' in result ? result.verified : false;
      
      if (verified) {
        // Update payment record with the correct signature
        await updatePaymentStatus(paymentId, 'completed');
        
        // Update user subscription - use monthly as default
        await updateUserSubscription(user?.id as string, 'monthly');
        
        setPaymentStatus('completed');
        
        // Update local state
        setCurrentPlan('premium');
        
        // Clear URL parameters
        window.history.replaceState({}, document.title, '/subscription');
      } else {
        throw new Error('Payment verification failed');
      }
    } catch (err: any) {
      console.error('Payment verification error:', err);
      setPaymentStatus('failed');
      setPaymentError(err.message || 'Payment verification failed');
    } finally {
      setPaymentProcessing(false);
    }
  };
  
  // Initiate PayPal payment
  const handlePayPalPayment = async (planId: string) => {
    if (!user) return;
    
    setPaymentLoading(true);
    setPaymentError(null);
    
    try {
      // Get the plan details
      const plan = subscriptionTiers.find(tier => tier.id === planId);
      if (!plan) throw new Error('Invalid plan selected');
      
      // Calculate the amount based on the billing cycle
      const amount = billingCycle === 'monthly' 
        ? plan.monthlyPrice 
        : plan.yearlyPrice * 12; // Annual billing
      
      // Create a payment record in the database
      const paymentRecord = await createPaymentRecord({
        userId: user.id,
        plan: billingCycle,
        amount,
        paypalTransactionId: 'pending', // Will be updated after completion
        status: 'pending'
      });
      
      // Generate the PayPal checkout URL
      const paypalUrl = getPayPalCheckoutUrl(
        amount, 
        billingCycle,
        paymentRecord.id
      );
      
      // Redirect to PayPal
      window.location.href = paypalUrl;
    } catch (error) {
      console.error('Error initiating PayPal payment:', error);
      setPaymentError('Failed to initiate payment. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };
  
  const formatDate = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Get the billing period for display
  const getBillingPeriod = () => {
    return billingCycle === 'monthly' ? 'month' : 'year';
  };

  // Get price display based on the billing cycle
  const getPriceDisplay = (tier: SubscriptionTier) => {
    if (tier.id === 'free') return '$0';
    
    if (billingCycle === 'monthly') {
      return `$${tier.monthlyPrice.toFixed(2)}/month`;
    } else {
      return `$${tier.yearlyPrice.toFixed(2)}/month`;
    }
  };

  // Get the annual price for yearly billing
  const getAnnualPrice = (tier: SubscriptionTier) => {
    if (tier.id === 'free') return null;
    
    if (billingCycle === 'yearly') {
      return `$${(tier.yearlyPrice * 12).toFixed(2)} billed annually`;
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Subscription</h1>
        <p className="text-muted mb-6">
          Manage your subscription and upgrade for premium features
        </p>
        
        {/* Payment status messages */}
        {paymentStatus === 'completed' && (
          <div className="mb-6 bg-green-500/20 text-green-400 p-4 rounded-lg">
            Payment completed successfully! Your subscription has been updated.
          </div>
        )}
        
        {paymentStatus === 'failed' && (
          <div className="mb-6 bg-red-500/20 text-red-400 p-4 rounded-lg">
            {paymentError || 'Payment verification failed. Please try again.'}
          </div>
        )}
        
        {paymentProcessing && (
          <div className="mb-6 bg-blue-500/20 text-blue-400 p-4 rounded-lg flex items-center">
            <div className="animate-spin mr-3 h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            Verifying your payment...
          </div>
        )}
        
        {loading ? (
          <LoadingSpinner 
            text="Loading subscription data..."
            type="pulse"
            size="md"
          />
        ) : (
          <>
            {/* Current subscription status */}
            <div className="bg-surface rounded-lg p-6 shadow-lg mb-8">
              <h2 className="text-lg font-semibold mb-4">Current Subscription</h2>
              <div className="flex items-baseline">
                <span className="text-2xl font-bold">
                  {subscriptionTiers.find(tier => tier.id === currentPlan)?.name || 'Free'}
                </span>
                <span className="ml-2 text-muted">
                  {currentPlan !== 'free' ? `- Active until ${formatDate(30)}` : ''}
                </span>
              </div>
              
              {currentPlan !== 'free' && (
                <div className="mt-6 pt-4 border-t border-gray-800">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">Next billing date</div>
                      <div className="text-muted text-sm">{formatDate(30)}</div>
                    </div>
                    <button className="text-red-400 hover:text-red-300 px-3 py-1 text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Billing cycle selector */}
            <div className="mb-6 flex justify-center">
              <div className="inline-flex p-1 bg-surface rounded-full border border-accent/20">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-6 py-2 rounded-full text-sm ${
                    billingCycle === 'monthly' 
                      ? 'bg-accent text-buttonText' 
                      : 'text-muted hover:text-text'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-6 py-2 rounded-full text-sm ${
                    billingCycle === 'yearly' 
                      ? 'bg-accent text-buttonText' 
                      : 'text-muted hover:text-text'
                  }`}
                >
                  Yearly <span className="text-xs text-accent/80">(Save 17%)</span>
                </button>
              </div>
            </div>
            
            {/* Subscription tiers */}
            <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {subscriptionTiers.map(tier => (
                <div 
                  key={tier.id}
                  className={`bg-surface rounded-lg overflow-hidden shadow-lg flex flex-col relative ${
                    tier.recommended ? 'ring-2 ring-accent' : ''
                  }`}
                >
                  {tier.recommended && (
                    <div className="absolute top-0 right-0 bg-accent text-buttonText px-3 py-1 text-xs font-bold">
                      RECOMMENDED
                    </div>
                  )}
                  
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-1">{tier.name}</h3>
                    <div className="text-3xl font-bold mb-1">{getPriceDisplay(tier)}</div>
                    {getAnnualPrice(tier) && (
                      <div className="text-sm text-muted mb-4">{getAnnualPrice(tier)}</div>
                    )}
                    
                    <ul className="space-y-2 mb-6">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center">
                          <svg className="w-5 h-5 mr-2 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="px-6 pb-6 mt-auto">
                    {currentPlan === tier.id ? (
                      <button 
                        disabled
                        className="w-full py-2 px-4 bg-gray-700 text-white rounded-md opacity-70 cursor-not-allowed"
                      >
                        Current Plan
                      </button>
                    ) : (
                      <button 
                        onClick={() => handlePayPalPayment(tier.id)}
                        disabled={paymentLoading || tier.id === 'free' || paymentProcessing}
                        className={`w-full py-2 px-4 rounded-md ${
                          tier.id === 'premium'
                            ? 'bg-accent hover:bg-accent/90 text-buttonText'
                            : 'bg-surface hover:bg-hover text-text border border-accent/30'
                        } ${(paymentLoading || paymentProcessing) && 'opacity-70 cursor-wait'}`}
                      >
                        {paymentLoading ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                            Processing...
                          </div>
                        ) : tier.id === 'free' ? (
                          'Free Plan'
                        ) : (
                          `Subscribe with PayPal`
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Payment details section */}
            <div className="mt-8 bg-surface rounded-lg p-6 shadow-lg">
              <h2 className="text-lg font-semibold mb-4">Payment Information</h2>
              <p className="text-muted mb-4">
                Secure payments are processed through PayPal. You can use a credit card or your PayPal account.
              </p>
              <div className="flex items-center space-x-2 mt-4">
                <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" alt="PayPal" className="h-8" />
                <span className="text-sm text-muted">Protected by PayPal's buyer protection</span>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Subscription; 