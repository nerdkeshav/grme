// Test script for checking Supabase connectivity
const { createClient } = require('@supabase/supabase-js');

// Use the direct connection details
const supabaseUrl = 'https://ghspfcpkmvasswohlwjc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdoc3BmY3BrbXZhc3N3b2hsd2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMDk5NTcsImV4cCI6MjA2MjY4NTk1N30.kNoCH4OnFVfTNz6N584GPQP_wNIz9Crs1OwzPyrFkao';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test function
async function testConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    // Try to get session
    console.log('Checking auth service...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Auth error:', sessionError.message);
    } else {
      console.log('Auth service is working:', !!sessionData);
    }
    
    // Try to query a table
    console.log('\nChecking database connection...');
    const { data: healthData, error: healthError } = await supabase
      .from('health_check')
      .select('*')
      .limit(1);
      
    if (healthError) {
      console.error('Database query error:', healthError.message);
      console.error('Error details:', healthError);
    } else {
      console.log('Database connection successful:', !!healthData);
      console.log('Data:', healthData);
    }
    
    // Try to verify direct PostgreSQL connection info
    console.log('\nChecking connection info...');
    const { data: connectionInfo, error: connectionError } = await supabase.rpc('get_connection_info');
    
    if (connectionError) {
      console.error('Connection info error:', connectionError.message);
    } else {
      console.log('Connection info retrieved:', !!connectionInfo);
    }
    
    // Check RLS policies
    console.log('\nChecking RLS policies...');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
      
    if (profileError) {
      console.error('Profile query error - likely RLS issue:', profileError.message);
      console.error('Make sure Row Level Security is properly configured');
    } else {
      console.log('Profile access successful:', !!profileData);
      console.log('Profile count:', profileData?.length);
    }

  } catch (error) {
    console.error('Unexpected error:', error.message);
    console.error(error);
  }
}

// Run the test
testConnection(); 