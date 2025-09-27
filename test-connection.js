// Simple connection test script
// Run with: node test-connection.js

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const supabaseUrl = 'https://ghspfcpkmvasswohlwjc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdoc3BmY3BrbXZhc3N3b2hsd2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMDk5NTcsImV4cCI6MjA2MjY4NTk1N30.kNoCH4OnFVfTNz6N584GPQP_wNIz9Crs1OwzPyrFkao';

console.log('Starting Supabase connectivity test...');
console.log(`URL: ${supabaseUrl}`);
console.log(`Key Length: ${supabaseKey.length} characters`);

// Test 1: Check profiles table
console.log('\nTest 1: Checking profiles table');
fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  }
})
.then(response => {
  console.log(`  Status: ${response.status} ${response.statusText}`);
  console.log(`  Headers: ${JSON.stringify(Object.fromEntries(response.headers))}`);
  return response.text();
})
.then(text => {
  console.log(`  Response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
  runTest2();
})
.catch(error => {
  console.error('  Error:', error);
  runTest2();
});

// Test 2: Authentication check
async function runTest2() {
  console.log('\nTest 2: Authentication endpoint check');
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        email: 'test@example.com',  // This will fail but we only care about connectivity
        password: 'password123'
      })
    });
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log(`  Response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
    
    // Add a test for service health
    await runTest3();
  } catch (error) {
    console.error('  Error:', error);
    await runTest3();
  }
}

// Test 3: Service health check
async function runTest3() {
  console.log('\nTest 3: Service health check');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log(`  Response: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
  } catch (error) {
    console.error('  Error:', error);
  }
  
  console.log('\nTests complete');
} 