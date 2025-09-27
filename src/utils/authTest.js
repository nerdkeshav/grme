// Authentication Test Utility
//
// This file provides utilities to test Supabase authentication functionality
// Run with: node src/utils/authTest.js
// 
// Note: This is a server-side script and should not be imported into the React app

const { createClient } = require('@supabase/supabase-js');

// Supabase Configuration
const supabaseUrl = 'https://ghspfcpkmvasswohlwjc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdoc3BmY3BrbXZhc3N3b2hsd2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMDk5NTcsImV4cCI6MjA2MjY4NTk1N30.kNoCH4OnFVfTNz6N584GPQP_wNIz9Crs1OwzPyrFkao';

// Create the Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ANSI color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test suite
const runTests = async () => {
  console.log(`${colors.bright}${colors.cyan}=== Supabase Authentication Test Suite ===${colors.reset}\n`);
  
  // Start with connectivity check
  await testConnectivity();
  
  // Test auth endpoints
  await testAuthEndpoints();
  
  // Test database access
  await testDatabaseAccess();
  
  console.log(`\n${colors.bright}${colors.cyan}=== Test Suite Complete ===${colors.reset}\n`);
};

const testConnectivity = async () => {
  console.log(`${colors.bright}Testing Supabase Connectivity...${colors.reset}`);
  
  try {
    const startTime = Date.now();
    const { data, error } = await supabase.auth.getSession();
    const endTime = Date.now();
    
    if (error) {
      console.log(`${colors.red}✗ Connectivity Failed: ${error.message}${colors.reset}`);
      return false;
    }
    
    console.log(`${colors.green}✓ Supabase API Reachable (${endTime - startTime}ms)${colors.reset}`);
    return true;
  } catch (err) {
    console.log(`${colors.red}✗ Connectivity Error: ${err.message}${colors.reset}`);
    return false;
  }
};

const testAuthEndpoints = async () => {
  console.log(`\n${colors.bright}Testing Authentication Endpoints...${colors.reset}`);
  
  // Test password login status (we don't actually login)
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com', 
      password: 'incorrect_password_to_test_endpoint'
    });
    
    if (error && error.message.includes('Invalid login credentials')) {
      console.log(`${colors.green}✓ Password Authentication Endpoint Working${colors.reset}`);
    } else if (error) {
      console.log(`${colors.yellow}⚠ Password Authentication Returned Unexpected Error: ${error.message}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Password Authentication Failed: No Error Returned for Invalid Credentials${colors.reset}`);
    }
  } catch (err) {
    console.log(`${colors.red}✗ Password Authentication Error: ${err.message}${colors.reset}`);
  }
  
  // Test the OAuth URL generation (without actually redirecting)
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000',
        skipBrowserRedirect: true
      }
    });
    
    if (error) {
      console.log(`${colors.red}✗ OAuth URL Generation Failed: ${error.message}${colors.reset}`);
    } else if (data && data.url) {
      console.log(`${colors.green}✓ OAuth URL Generation Working${colors.reset}`);
      console.log(`${colors.dim}  URL: ${data.url.substring(0, 60)}...${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ OAuth URL Generation Returned Unexpected Data${colors.reset}`);
    }
  } catch (err) {
    console.log(`${colors.red}✗ OAuth URL Generation Error: ${err.message}${colors.reset}`);
  }
};

const testDatabaseAccess = async () => {
  console.log(`\n${colors.bright}Testing Database Access...${colors.reset}`);
  
  // Test profiles table access
  try {
    const { data, error, status } = await supabase
      .from('profiles')
      .select('id, full_name')
      .limit(1);
    
    if (error) {
      console.log(`${colors.red}✗ Profiles Table Access Failed: ${error.message}${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Profiles Table Accessible${colors.reset}`);
      console.log(`${colors.dim}  Retrieved ${data.length} records, status: ${status}${colors.reset}`);
    }
  } catch (err) {
    console.log(`${colors.red}✗ Profiles Table Access Error: ${err.message}${colors.reset}`);
  }
  
  // Test RPC function access
  try {
    const { data, error } = await supabase.rpc('get_connection_info');
    
    if (error) {
      console.log(`${colors.yellow}⚠ RPC Function 'get_connection_info' Not Available: ${error.message}${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ RPC Functions Accessible${colors.reset}`);
      console.log(`${colors.dim}  Data: ${JSON.stringify(data)}${colors.reset}`);
    }
  } catch (err) {
    console.log(`${colors.red}✗ RPC Function Access Error: ${err.message}${colors.reset}`);
  }
  
  // Test service health via health_check table
  try {
    const { data, error } = await supabase
      .from('health_check')
      .select('*')
      .limit(1);
    
    if (error && error.code === '42P01') { // Table doesn't exist
      console.log(`${colors.yellow}⚠ Health Check Table Not Found: This is normal if you haven't set up a health check table${colors.reset}`);
    } else if (error) {
      console.log(`${colors.red}✗ Health Check Failed: ${error.message}${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Health Check Table Accessible${colors.reset}`);
      console.log(`${colors.dim}  Data: ${JSON.stringify(data)}${colors.reset}`);
    }
  } catch (err) {
    console.log(`${colors.red}✗ Health Check Error: ${err.message}${colors.reset}`);
  }
  
  // Database schema information
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(10);
    
    if (error) {
      console.log(`${colors.yellow}⚠ Schema Information Not Available: ${error.message}${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Database Schema Accessible${colors.reset}`);
      console.log(`${colors.dim}  Available Tables: ${data.map(t => t.table_name).join(', ')}${colors.reset}`);
    }
  } catch (err) {
    console.log(`${colors.red}✗ Schema Information Error: ${err.message}${colors.reset}`);
  }
};

// Run the tests
runTests().catch(err => {
  console.error(`${colors.red}Fatal Error: ${err.message}${colors.reset}`);
  process.exit(1);
}); 