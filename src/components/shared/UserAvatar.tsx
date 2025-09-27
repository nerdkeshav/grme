import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import PremiumBadge from './PremiumBadge';
import { BadgePreferences } from '../../types/supabase';

interface UserAvatarProps {
  userId: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ 
  userId, 
  avatarUrl, 
  size = 'md',
  className = '' 
}) => {
  const [isPremium, setIsPremium] = useState(false);
  const [badgePrefs, setBadgePrefs] = useState<BadgePreferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Define size classes
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32'
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) return;
      
      setLoading(true);
      try {
        // Check premium status
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .in('tier', ['premium', 'pro'])
          .limit(1);
          
        if (subscriptionError) {
          console.error('Error fetching subscription:', subscriptionError);
        } else {
          setIsPremium(subscriptionData && subscriptionData.length > 0);
          
          // If premium, fetch badge preferences
          if (subscriptionData && subscriptionData.length > 0) {
            const { data: badgeData, error: badgeError } = await supabase
              .from('badge_preferences')
              .select('*')
              .eq('user_id', userId)
              .limit(1)
              .single();
              
            if (badgeError && badgeError.code !== 'PGRST116') {
              console.error('Error fetching badge preferences:', badgeError);
            } else if (badgeData) {
              setBadgePrefs(badgeData);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching user premium data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [userId]);

  // Determine if badge should be shown
  const shouldShowBadge = isPremium && badgePrefs?.badge_visible;
  
  // Get badge color or use default
  const badgeColor = badgePrefs?.badge_color || 'green';

  return (
    <div className={`relative ${className}`}>
      <div className={`rounded-full overflow-hidden border-2 border-accent/20 shadow-lg ${sizeClasses[size]}`}>
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt="User avatar" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-accent/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-1/2 h-1/2 text-accent/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
      </div>
      
      {shouldShowBadge && (
        <div className={`absolute ${size === 'sm' ? '-top-1 -right-1' : '-top-2 -right-2'}`}>
          <PremiumBadge 
            color={badgeColor as 'green' | 'red'} 
            className={size === 'sm' ? 'scale-75' : ''}
          />
        </div>
      )}
    </div>
  );
};

export default UserAvatar; 