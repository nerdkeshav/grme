import React from 'react';

interface ResetConnectionButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'text';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

/**
 * A button component that helps users resolve connection issues by
 * clearing problematic localStorage items and refreshing the connection
 */
const ResetConnectionButton: React.FC<ResetConnectionButtonProps> = () => {
  // Return null to not render the button
  return null;
};

export default ResetConnectionButton; 