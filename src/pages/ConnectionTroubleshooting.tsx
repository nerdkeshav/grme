import React, { useState } from 'react';
import { resetConnectionState, clearConnectionState, getConnectionInfo, ConnectionState } from '../utils/connectionManager';
import { checkDatabaseHealth } from '../utils/supabaseClient';
import { useNavigate } from 'react-router-dom';

const ConnectionTroubleshooting: React.FC = () => {
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const navigate = useNavigate();
  
  // Get the current connection info for display
  const connectionInfo = getConnectionInfo();
  
  // Run a comprehensive connection test
  const runConnectionTest = async () => {
    setIsLoading(true);
    try {
      const startTime = Date.now();
      
      // Try multiple endpoints to diagnose the issue
      const tests = {
        supabase: await testSupabaseConnection(),
        localStorage: testLocalStorage(),
        network: await testNetworkConnection(),
        dns: await testDNSResolution()
      };
      
      setTestResults({
        ...tests,
        testTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error running connection tests:', error);
      setTestResults({
        error: 'Failed to complete all tests',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Test Supabase connection
  const testSupabaseConnection = async () => {
    try {
      const result = await checkDatabaseHealth();
      return {
        connected: result.connected,
        responseTime: result.responseTime,
        status: result.connected ? 'OK' : 'Failed'
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Error'
      };
    }
  };
  
  // Test localStorage access
  const testLocalStorage = () => {
    try {
      const testKey = '_connection_test';
      const testValue = Date.now().toString();
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      return {
        working: retrieved === testValue,
        status: retrieved === testValue ? 'OK' : 'Failed'
      };
    } catch (error) {
      return {
        working: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Error'
      };
    }
  };
  
  // Test basic network connectivity
  const testNetworkConnection = async () => {
    try {
      const online = navigator.onLine;
      
      // Try a fetch to a reliable endpoint
      let fetchStatus = 'Not attempted';
      try {
        const response = await fetch('https://httpbin.org/get', { 
          method: 'GET',
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache' }
        });
        fetchStatus = response.ok ? 'OK' : `Failed (${response.status})`;
      } catch (error) {
        fetchStatus = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
      
      return {
        browserOnline: online,
        fetchStatus,
        status: online && fetchStatus === 'OK' ? 'OK' : 'Issues detected'
      };
    } catch (error) {
      return {
        working: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Error'
      };
    }
  };
  
  // Test DNS resolution
  const testDNSResolution = async () => {
    try {
      // We can't directly test DNS, but we can try to access known domains
      const domains = [
        'https://ghspfcpkmvasswohlwjc.supabase.co',
        'https://google.com',
        'https://cloudflare.com'
      ];
      
      const results = await Promise.allSettled(
        domains.map(async (domain) => {
          try {
            const startTime = Date.now();
            const response = await fetch(`${domain}/favicon.ico`, { 
              method: 'HEAD',
              cache: 'no-cache',
              headers: { 'Cache-Control': 'no-cache' }
            });
            return {
              domain,
              success: response.ok,
              status: response.status,
              time: Date.now() - startTime
            };
          } catch (error) {
            return {
              domain,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );
      
      return {
        results: results.map(result => result.status === 'fulfilled' ? result.value : { error: 'Rejected promise' }),
        status: results.some(r => r.status === 'fulfilled' && (r as any).value?.success) ? 'Partial success' : 'All failed'
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Error'
      };
    }
  };
  
  // Reset connection state
  const handleResetConnection = () => {
    try {
      resetConnectionState();
      setResetMessage('Connection state reset! Testing now...');
      
      // Run tests after reset
      setTimeout(() => {
        runConnectionTest();
      }, 1000);
      
      // Clear message after a while
      setTimeout(() => {
        setResetMessage('');
      }, 5000);
    } catch (error) {
      setResetMessage(`Error resetting connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Clear all connection data
  const handleClearAllData = () => {
    try {
      clearConnectionState();
      localStorage.removeItem('supabase.auth.token');
      
      setResetMessage('All connection data cleared! You will need to log in again.');
      
      // Redirect to login page after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      setResetMessage(`Error clearing data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Connection Troubleshooting</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-3">Current Connection Status</h2>
        <div className="mb-4 p-4 bg-gray-100 rounded-md">
          <div className="grid grid-cols-2 gap-2">
            <div className="font-medium">State:</div>
            <div className={`
              ${connectionInfo.state === ConnectionState.CONNECTED ? 'text-green-600' : ''}
              ${connectionInfo.state === ConnectionState.LIMITED_CONNECTIVITY ? 'text-orange-600' : ''}
              ${connectionInfo.state === ConnectionState.DISCONNECTED ? 'text-red-600' : ''}
              ${connectionInfo.state === ConnectionState.CHECKING ? 'text-blue-600' : ''}
              font-semibold
            `}>
              {connectionInfo.state}
            </div>
            
            <div className="font-medium">Last Check:</div>
            <div>{connectionInfo.lastCheck ? new Date(connectionInfo.lastCheck).toLocaleString() : 'Never'}</div>
            
            <div className="font-medium">Last Successful:</div>
            <div>{connectionInfo.lastSuccessful ? new Date(connectionInfo.lastSuccessful).toLocaleString() : 'Never'}</div>
            
            <div className="font-medium">Consecutive Failures:</div>
            <div>{connectionInfo.consecutiveFailures}</div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={runConnectionTest}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Run Connection Test'}
          </button>
          
          <button 
            onClick={handleResetConnection}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded"
          >
            Reset Connection
          </button>
          
          <button 
            onClick={handleClearAllData}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded"
          >
            Clear All Data
          </button>
        </div>
        
        {resetMessage && (
          <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded-md">
            {resetMessage}
          </div>
        )}
      </div>
      
      {testResults && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-3">Test Results</h2>
          <div className="mb-2 text-sm text-gray-500">
            Completed in {testResults.testTime}ms at {new Date(testResults.timestamp).toLocaleString()}
          </div>
          
          <div className="space-y-4">
            {/* Supabase Test Results */}
            <div className="p-4 bg-gray-100 rounded-md">
              <h3 className="font-semibold mb-2">
                Supabase Connection: 
                <span className={`ml-2 ${testResults.supabase?.status === 'OK' ? 'text-green-600' : 'text-red-600'}`}>
                  {testResults.supabase?.status || 'Unknown'}
                </span>
              </h3>
              <div className="text-sm">
                <div>Connected: {testResults.supabase?.connected ? 'Yes' : 'No'}</div>
                {testResults.supabase?.responseTime && <div>Response Time: {testResults.supabase.responseTime}ms</div>}
                {testResults.supabase?.error && <div className="text-red-600">Error: {testResults.supabase.error}</div>}
              </div>
            </div>
            
            {/* LocalStorage Test Results */}
            <div className="p-4 bg-gray-100 rounded-md">
              <h3 className="font-semibold mb-2">
                LocalStorage: 
                <span className={`ml-2 ${testResults.localStorage?.status === 'OK' ? 'text-green-600' : 'text-red-600'}`}>
                  {testResults.localStorage?.status || 'Unknown'}
                </span>
              </h3>
              <div className="text-sm">
                <div>Working: {testResults.localStorage?.working ? 'Yes' : 'No'}</div>
                {testResults.localStorage?.error && <div className="text-red-600">Error: {testResults.localStorage.error}</div>}
              </div>
            </div>
            
            {/* Network Test Results */}
            <div className="p-4 bg-gray-100 rounded-md">
              <h3 className="font-semibold mb-2">
                Network: 
                <span className={`ml-2 ${testResults.network?.status === 'OK' ? 'text-green-600' : 'text-orange-600'}`}>
                  {testResults.network?.status || 'Unknown'}
                </span>
              </h3>
              <div className="text-sm">
                <div>Browser Online: {testResults.network?.browserOnline ? 'Yes' : 'No'}</div>
                <div>Fetch Test: {testResults.network?.fetchStatus}</div>
                {testResults.network?.error && <div className="text-red-600">Error: {testResults.network.error}</div>}
              </div>
            </div>
            
            {/* DNS Test Results */}
            <div className="p-4 bg-gray-100 rounded-md">
              <h3 className="font-semibold mb-2">
                DNS Resolution: 
                <span className={`ml-2 ${
                  testResults.dns?.status === 'OK' 
                    ? 'text-green-600' 
                    : testResults.dns?.status === 'Partial success' 
                      ? 'text-orange-600' 
                      : 'text-red-600'
                }`}>
                  {testResults.dns?.status || 'Unknown'}
                </span>
              </h3>
              <div className="text-sm">
                {testResults.dns?.results && (
                  <div className="space-y-2 mt-2">
                    {testResults.dns.results.map((result: any, index: number) => (
                      <div key={index} className="border-b border-gray-200 pb-2">
                        <div className="font-medium">{result.domain}</div>
                        <div className={result.success ? 'text-green-600' : 'text-red-600'}>
                          {result.success ? `Success (${result.time}ms)` : 'Failed'}
                        </div>
                        {!result.success && result.error && <div className="text-red-600 text-xs">{result.error}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {testResults.dns?.error && <div className="text-red-600">Error: {testResults.dns.error}</div>}
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <h3 className="font-semibold mb-2">Recommendation</h3>
            <div>
              {testResults.supabase?.connected 
                ? "Your connection to Supabase appears to be working. If you're still experiencing issues, try refreshing the page or logging out and back in."
                : testResults.network?.browserOnline === false
                  ? "Your browser reports that you're offline. Please check your internet connection and try again."
                  : testResults.localStorage?.working === false
                    ? "There appears to be an issue with your browser's local storage. Try clearing your browser cache or using a different browser."
                    : "There may be an issue with the connection to our servers. Please try again later or contact support if the problem persists."}
            </div>
          </div>
        </div>
      )}
      
      {/* WebSocket Error Help Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-xl font-semibold mb-3">WebSocket Connection Issues</h2>
        <div className="p-4 bg-yellow-50 rounded-md">
          <p className="mb-3">
            If you're seeing WebSocket-related errors in your browser console (ws does not work in browser), this is a known issue
            that can occur when using certain browsers or network configurations. We've implemented a fallback solution
            that should allow the application to work properly despite these errors.
          </p>
          <div className="mt-4">
            <h3 className="font-medium mb-2">What to do:</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Ignore any WebSocket-related errors in the console - they will not affect core functionality</li>
              <li>If real-time updates aren't working, the app will automatically poll for updates instead</li>
              <li>If you're experiencing persistent issues, try the following steps:</li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-3">
              <button 
                onClick={handleClearAllData}
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded"
              >
                Clear Browser Data & Logout
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionTroubleshooting; 