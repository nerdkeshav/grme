import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  icon?: React.ReactNode;
  duration?: number;
  playSound?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Create AudioContext on component mount
  useEffect(() => {
    // Initialize audio context only when interacting with the page, to prevent autoplay issues
    const initAudio = () => {
      if (!audioContext) {
        try {
          const context = new (window.AudioContext || (window as any).webkitAudioContext)();
          setAudioContext(context);
        } catch (error) {
          console.error('Failed to create AudioContext:', error);
        }
      }
    };

    // Add listeners for user interaction
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
    
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
      if (audioContext) {
        audioContext.close();
      }
    };
  }, []);

  // Play notification sound
  const playNotificationSound = (type: 'success' | 'error' | 'info') => {
    if (!audioContext) return;
    
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different sounds based on notification type
      switch(type) {
        case 'success':
          oscillator.type = 'sine';
          oscillator.frequency.value = 587.33; // D5
          oscillator.frequency.exponentialRampToValueAtTime(783.99, audioContext.currentTime + 0.1); // G5
          gainNode.gain.value = 0.2;
          break;
        case 'error': 
          oscillator.type = 'sawtooth';
          oscillator.frequency.value = 369.99; // F#4
          oscillator.frequency.exponentialRampToValueAtTime(349.23, audioContext.currentTime + 0.1); // F4
          gainNode.gain.value = 0.2;
          break;
        case 'info':
        default:
          oscillator.type = 'sine';
          oscillator.frequency.value = 523.25; // C5
          gainNode.gain.value = 0.15;
      }
      
      // Start sound and stop after 0.2 seconds
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.3);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  const showNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const duration = notification.duration || 5000; // Default 5 seconds
    
    // If sound is enabled, play it
    if (notification.playSound !== false) {
      playNotificationSound(notification.type);
    }
    
    // Add notification to the array
    setNotifications(prev => [...prev, { ...notification, id }]);
    
    // Remove notification after duration
    setTimeout(() => {
      removeNotification(id);
    }, duration);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notifications, showNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}; 