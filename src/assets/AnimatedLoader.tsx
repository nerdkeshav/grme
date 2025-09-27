import React from 'react';
import './animated-loader.css';

interface AnimatedLoaderProps {
  type?: 'circle' | 'wave' | 'dots';
  text?: string;
  subText?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const AnimatedLoader: React.FC<AnimatedLoaderProps> = ({
  type = 'circle',
  text = 'Loading...',
  subText,
  fullScreen = false,
  size = 'md',
  color = 'accent',
}) => {
  const sizeMap = {
    sm: { logo: 40, text: 'text-sm' },
    md: { logo: 60, text: 'text-base' },
    lg: { logo: 80, text: 'text-lg' },
  };

  const containerClasses = fullScreen 
    ? 'loading-fullscreen'
    : 'loading-container';
  
  const renderLoader = () => {
    switch (type) {
      case 'wave':
        return (
          <div className="loading-wave">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="loading-wave-bar" />
            ))}
          </div>
        );
      
      case 'dots':
        return (
          <div className="loading-dots">
            {[1, 2, 3].map((i) => (
              <div key={i} className="loading-dot" />
            ))}
          </div>
        );
      
      case 'circle':
      default:
        return (
          <div 
            className="loading-logo" 
            style={{ 
              width: sizeMap[size].logo, 
              height: sizeMap[size].logo,
            }}
          >
            <div className="loading-logo-circle" />
            <div className="loading-logo-spinner" />
            <div className="loading-logo-content">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className={`w-1/2 h-1/2 text-${color}`}
              >
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center justify-center">
        {renderLoader()}
        
        {text && (
          <p className={`loading-text ${sizeMap[size].text}`}>
            {text}
          </p>
        )}
        
        {subText && (
          <p className="loading-subtext">
            {subText}
          </p>
        )}
      </div>
    </div>
  );
};

export default AnimatedLoader; 