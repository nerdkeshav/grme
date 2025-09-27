import { useState, useEffect } from 'react';
import { 
  ConnectionState, 
  addConnectionStateListener, 
  getCurrentConnectionState,
  checkConnection
} from '../utils/connectionManager';

/**
 * Hook to monitor and interact with connection status
 * @returns Connection status and helper functions
 */
export const useConnectionStatus = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    getCurrentConnectionState()
  );
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribe = addConnectionStateListener((state) => {
      setConnectionState(state);
    });

    // Clean up subscription
    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Manually check connection status
   * @returns A promise that resolves to the new connection state
   */
  const checkConnectionStatus = async (): Promise<ConnectionState> => {
    setIsChecking(true);
    try {
      await checkConnection(true);
      return connectionState;
    } catch (error) {
      console.error('Error checking connection status:', error);
      return connectionState;
    } finally {
      setIsChecking(false);
    }
  };

  return {
    // Connection state
    connectionState,
    isConnected: connectionState === ConnectionState.CONNECTED,
    isLimitedConnectivity: connectionState === ConnectionState.LIMITED_CONNECTIVITY,
    isDisconnected: connectionState === ConnectionState.DISCONNECTED,
    isChecking: connectionState === ConnectionState.CHECKING || isChecking,
    
    // Helper functions
    checkConnectionStatus,
  };
};

export default useConnectionStatus; 