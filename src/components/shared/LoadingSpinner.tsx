import React, { memo } from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  subText?: string;
  fullScreen?: boolean;
  type?: 'spinner' | 'pulse' | 'wave' | 'logo';
  color?: string;
}

// Using memo to prevent unnecessary re-renders
const LoadingSpinner: React.FC<LoadingSpinnerProps> = memo(({
  size = 'md',
  text = 'Loading...',
  subText,
  fullScreen = false,
  type = 'spinner',
  color = 'accent',
}) => {
  // Size mappings based on variant
  const sizeMap = {
    sm: { container: 'h-8 w-8', text: 'text-sm' },
    md: { container: 'h-12 w-12', text: 'text-base' },
    lg: { container: 'h-16 w-16', text: 'text-lg' },
    xl: { container: 'h-24 w-24', text: 'text-xl' },
  };

  // Wrapper classes based on fullScreen prop
  const wrapperClasses = fullScreen
    ? 'fixed inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-sm'
    : 'flex flex-col items-center justify-center py-8';

  // Render the specific loading animation based on type
  const renderLoadingAnimation = () => {
    switch (type) {
      case 'logo':
        return (
          <div className="relative">
            <div className={`${sizeMap[size].container} relative`}>
              <div className="absolute inset-0 rounded-full border-2 border-gray-700"></div>
              <div className="absolute inset-0 rounded-full border-t-2 border-accent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className={`h-1/2 w-1/2 text-${color}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
        );
      
      case 'pulse':
        return (
          <div className="flex space-x-2">
            <div className={`h-3 w-3 bg-${color} rounded-full animate-pulse delay-0`}></div>
            <div className={`h-3 w-3 bg-${color} rounded-full animate-pulse delay-300`}></div>
            <div className={`h-3 w-3 bg-${color} rounded-full animate-pulse delay-600`}></div>
          </div>
        );
      
      case 'wave':
        return (
          <div className="flex space-x-1 items-center">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-1 bg-${color} rounded-full animate-wave`}
                style={{ 
                  height: `${0.5 + Math.random() * 0.5}rem`,
                  animationDelay: `${i * 0.1}s` 
                }}
              ></div>
            ))}
          </div>
        );
      
      case 'spinner':
      default:
        return (
          <div className={`${sizeMap[size].container} relative`}>
            <svg className="animate-spin" viewBox="0 0 50 50">
              <circle
                className={`text-${color}`}
                cx="25"
                cy="25"
                r="20"
                fill="none"
                strokeWidth="5"
                stroke="currentColor"
                strokeDasharray="80"
                strokeDashoffset="60"
              ></circle>
            </svg>
          </div>
        );
    }
  };

  return (
    <div className={wrapperClasses}>
      <div className="flex flex-col items-center">
        {renderLoadingAnimation()}
        {text && (
          <p className={`mt-4 ${sizeMap[size].text} font-medium text-${color} animate-pulse`}>{text}</p>
        )}
        {subText && <p className="mt-1 text-sm text-muted">{subText}</p>}
      </div>
    </div>
  );
});

// Add display name for debugging
LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner; 