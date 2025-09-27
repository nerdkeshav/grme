import React from 'react';

interface PremiumBadgeProps {
  color: 'green' | 'red';
  className?: string;
}

const PremiumBadge: React.FC<PremiumBadgeProps> = ({ color, className = '' }) => {
  // Define colors based on the prop
  const bgColor = color === 'green' ? 'bg-green-500' : 'bg-red-500';
  const shadowColor = color === 'green' ? 'shadow-green-500/50' : 'shadow-red-500/50';
  
  return (
    <div 
      className={`
        ${bgColor} ${shadowColor}
        inline-flex items-center justify-center
        rounded-full px-3 py-0.5
        text-white text-xs font-bold
        shadow-lg
        transform transition-all duration-300 hover:scale-105
        ${className}
      `}
      style={{
        textShadow: '0 0 5px rgba(255,255,255,0.5)',
        boxShadow: `0 0 10px ${color === 'green' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`
      }}
    >
      pro
    </div>
  );
};

export default PremiumBadge; 