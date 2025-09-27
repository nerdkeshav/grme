import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

type TableName = string;
type Event = 'INSERT' | 'UPDATE' | 'DELETE' | '*';
type Filter = string | null;
type CallbackFunction = (payload: any) => void;

/**
 * Hook to get real-time updates with automatic fallback to polling
 * 
 * @param tableName Table to watch for changes
 * @param event Event type to watch for ('INSERT', 'UPDATE', 'DELETE', or '*')
 * @param filter Optional filter string (e.g. "id=eq.123")
 * @param callback Function to call when changes are detected
 * @param pollingInterval How often to poll in milliseconds if real-time fails (default: 10000ms)
 * @param pollFunction Optional custom polling function (defaults to a simple select * query)
 */
export const useRealtimeOrPolling = (
  tableName: TableName,
  event: Event,
  filter: Filter,
  callback: CallbackFunction,
  pollingInterval: number = 10000,
  pollFunction?: () => Promise<any>
) => {
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const lastDataRef = useRef<any>(null);
  const webSocketFailed = useRef<boolean>(false);

  useEffect(() => {
    let subscription: any = null;
    let mounted = true;

    const setupRealtime = async () => {
      try {
        // Try to set up a realtime subscription
        const channel = supabase.channel(`table-changes-${tableName}`);

        // Set up subscription
        // Note: This is a simplified example - the actual implementation would need
        // to handle the Supabase realtime API correctly
        try {
          subscription = channel.on(
            'postgres_changes' as any,
            {
              event: event,
              schema: 'public',
              table: tableName,
              ...(filter ? { filter } : {})
            },
            (payload: any) => {
              if (mounted) {
                callback(payload);
                setLastUpdate(new Date());
              }
            }
          ).subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              console.log(`Subscribed to ${tableName} changes successfully`);
            } else if (status === 'CHANNEL_ERROR' || status === 'SUBSCRIPTION_ERROR') {
              console.warn(`Realtime subscription error for ${tableName}, falling back to polling`);
              webSocketFailed.current = true;
              setupPolling();
            }
          });
        } catch (subscribeErr) {
          console.error('Error during subscription:', subscribeErr);
          webSocketFailed.current = true;
          setupPolling();
        }

        channelRef.current = channel;

        // Set a timeout to check if real-time subscription is working
        setTimeout(() => {
          if (mounted && webSocketFailed.current) {
            console.warn(`WebSocket timeout for ${tableName}, falling back to polling`);
            setupPolling();
          }
        }, 5000);
      } catch (err) {
        console.error('Error setting up realtime subscription:', err);
        webSocketFailed.current = true;
        setError(err instanceof Error ? err : new Error(String(err)));
        setupPolling();
      }
    };

    const setupPolling = async () => {
      if (isPolling || !mounted) return;
      
      setIsPolling(true);
      console.log(`Setting up polling for ${tableName} changes (every ${pollingInterval}ms)`);

      // Default polling function - fetches all data from table
      const defaultPollFunction = async () => {
        const { data, error } = await supabase
          .from(tableName)
          .select('*');
          
        if (error) throw error;
        return data;
      };

      const poll = async () => {
        try {
          // Use custom polling function if provided, otherwise use default
          const data = await (pollFunction || defaultPollFunction)();
          
          // Only trigger callback if data has changed
          const dataStr = JSON.stringify(data);
          if (dataStr !== lastDataRef.current) {
            callback({ table: tableName, type: 'POLL', new: { data } });
            lastDataRef.current = dataStr;
            setLastUpdate(new Date());
          }
        } catch (err) {
          console.error('Error polling for changes:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
        
        // Set up next poll if component is still mounted
        if (mounted) {
          pollingTimerRef.current = setTimeout(poll, pollingInterval);
        }
      };

      // Start polling immediately
      poll();
    };

    // Try to set up real-time first
    setupRealtime();

    // Clean up
    return () => {
      mounted = false;
      if (subscription) {
        supabase.removeChannel(channelRef.current);
      }
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, [tableName, event, filter, callback, pollingInterval, pollFunction]);

  // Force switch to polling mode
  const forcePolling = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    webSocketFailed.current = true;
    setIsPolling(true);
  };

  return {
    isPolling,
    error,
    lastUpdate,
    forcePolling
  };
};

export default useRealtimeOrPolling; 