import React, { useState, useEffect } from 'react';
import { useNotification, Notification } from '../../context/NotificationContext';

const NotificationToast: React.FC = () => {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 w-72">
      {notifications.map((notification) => (
        <ToastItem 
          key={notification.id} 
          notification={notification}
          onRemove={removeNotification}
        />
      ))}
    </div>
  );
};

interface ToastItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ notification, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = notification.duration || 5000;

  useEffect(() => {
    // Start exit animation 300ms before removal
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 300);

    // Update progress bar
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (remaining <= 0) {
        clearInterval(progressInterval);
      }
    }, 16);

    return () => {
      clearTimeout(exitTimer);
      clearInterval(progressInterval);
    };
  }, [duration]);

  // Get background and icon based on notification type
  const getBgAndIcon = () => {
    switch (notification.type) {
      case 'success':
        return {
          bg: 'bg-green-500/20 border-green-500/30',
          icon: notification.icon || (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )
        };
      case 'error':
        return {
          bg: 'bg-red-500/20 border-red-500/30',
          icon: notification.icon || (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )
        };
      case 'info':
      default:
        return {
          bg: 'bg-accent/20 border-accent/30',
          icon: notification.icon || (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-accent" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          )
        };
    }
  };

  const { bg, icon } = getBgAndIcon();

  return (
    <div 
      className={`rounded-lg border shadow-lg overflow-hidden transition-all duration-300 ${bg} ${
        isExiting ? 'opacity-0 translate-x-10' : 'opacity-100'
      }`}
    >
      <div className="p-3 relative">
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-3 mt-0.5">
            {icon}
          </div>
          <div className="flex-1 mr-2">
            <p className="text-sm">{notification.message}</p>
          </div>
          <button 
            onClick={() => onRemove(notification.id)}
            className="text-text/60 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress bar */}
        <div className="h-0.5 w-full absolute bottom-0 left-0 bg-text/10">
          <div 
            className="h-full bg-white/30 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default NotificationToast; 