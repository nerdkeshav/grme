-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  plan VARCHAR(10) NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  amount DECIMAL(10, 2) NOT NULL,
  paypal_transaction_id VARCHAR(255),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscription table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'canceled', 'expired')),
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('free', 'premium')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own payments
CREATE POLICY payments_select_policy ON payments 
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own payments
CREATE POLICY payments_insert_policy ON payments 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only authenticated users can use these tables
CREATE POLICY payments_auth_policy ON payments 
  USING (auth.role() = 'authenticated');

-- Create RLS policies for subscriptions table
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own subscription
CREATE POLICY subscriptions_select_policy ON subscriptions 
  FOR SELECT USING (auth.uid() = user_id);

-- Allow backend services to manage subscriptions (would be restricted in production)
CREATE POLICY subscriptions_all_policy ON subscriptions 
  USING (auth.role() = 'authenticated');

-- Create index for user_id in payments table
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments (user_id);

-- Create index on paypal_transaction_id for verification lookups
CREATE INDEX IF NOT EXISTS payments_transaction_id_idx ON payments (paypal_transaction_id);

-- Create index for subscription lookups by user
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions (user_id);

-- Update profiles to include is_premium flag if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_premium'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_premium BOOLEAN DEFAULT FALSE;
  END IF;
END $$; 