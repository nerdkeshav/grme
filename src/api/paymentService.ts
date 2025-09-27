import { supabase } from '../utils/supabaseClient';

interface PaymentDetails {
  userId: string;
  plan: 'monthly' | 'yearly';
  amount: number;
  paypalTransactionId: string;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Create a new payment record in the database
 */
export const createPaymentRecord = async (paymentDetails: PaymentDetails) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert([
        {
          user_id: paymentDetails.userId,
          plan: paymentDetails.plan,
          amount: paymentDetails.amount,
          paypal_transaction_id: paymentDetails.paypalTransactionId,
          status: paymentDetails.status,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error creating payment record:', error);
    throw error;
  }
};

/**
 * Update a payment record status
 */
export const updatePaymentStatus = async (paymentId: string, status: 'pending' | 'completed' | 'failed') => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error updating payment status:', error);
    throw error;
  }
};

/**
 * Verify a PayPal payment
 * This would call your backend API which would verify with PayPal's API
 */
export const verifyPayPalPayment = async (paypalTransactionId: string) => {
  try {
    // In a real implementation, this would call your backend API endpoint
    // which would then verify the payment with PayPal's API
    
    // For demo purposes, we're simulating a verification with a timeout
    return new Promise((resolve) => {
      setTimeout(() => {
        // Assume verification is successful
        resolve({ verified: true, message: 'Payment verified successfully' });
      }, 1500);
    });
  } catch (error) {
    console.error('Error verifying PayPal payment:', error);
    throw error;
  }
};

/**
 * Update user subscription after payment
 */
export const updateUserSubscription = async (userId: string, plan: 'monthly' | 'yearly') => {
  try {
    const endDate = new Date();
    
    // Set subscription end date based on plan
    if (plan === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    
    // Update or create subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (existingSubscription) {
      // Update existing subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          tier: 'premium',
          start_date: new Date().toISOString(),
          end_date: endDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Create new subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .insert([
          {
            user_id: userId,
            status: 'active',
            tier: 'premium',
            start_date: new Date().toISOString(),
            end_date: endDate.toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }
};

/**
 * Get PayPal checkout URL with appropriate parameters
 */
export const getPayPalCheckoutUrl = (amount: number, plan: 'monthly' | 'yearly', userId: string) => {
  // In production, this would be a properly constructed PayPal checkout URL
  // For now, we'll use the paypalme link with some parameters
  const baseUrl = 'https://www.paypal.com/paypalme/nerdkeshav';
  const description = encodeURIComponent(`GRME Premium ${plan} Plan`);
  
  // Note: PayPal.me doesn't support URL parameters for automatic checkout
  // In a production app, you'd use PayPal's JavaScript SDK or create a payment link
  // through their API
  
  return `${baseUrl}/${amount}?description=${description}&reference=${userId}`;
}; 