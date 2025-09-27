import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Profile } from '../../types/supabase';
import { useNotification } from '../../context/NotificationContext';
import AppLayout from '../layout/AppLayout';
import UserAvatar from '../shared/UserAvatar';
import LoadingSpinner from '../shared/LoadingSpinner';
import Friends from './Friends';
import PremiumBadge from '../shared/PremiumBadge';

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [isRequester, setIsRequester] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const [showFriends, setShowFriends] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [badgeColor, setBadgeColor] = useState<'green' | 'red'>('green');
  const [badgeVisible, setBadgeVisible] = useState(true);

  // If viewing own profile, redirect to the profile edit page
  useEffect(() => {
    if (user && id === user.id) {
      navigate('/profile');
    }
  }, [user, id, navigate]);

  // Fetch user profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;
      
      setLoading(true);
      setError('');
      
      try {
        // Fetch the user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();
        
        if (profileError) throw profileError;
        if (!profileData) throw new Error('User not found');
        
        setUserProfile(profileData);
        setIsPremium(profileData.is_premium || false);
        
        // Fetch friendship status if user is logged in
        if (user) {
          const { data: friendshipData, error: friendshipError } = await supabase
            .from('friendships')
            .select('*')
            .or(`user_id.eq.${user.id}.and.friend_id.eq.${id},user_id.eq.${id}.and.friend_id.eq.${user.id}`)
            .single();
          
          if (!friendshipError && friendshipData) {
            setFriendshipStatus(friendshipData.status);
            setFriendshipId(friendshipData.id);
            setIsRequester(friendshipData.user_id === user.id);
          }
        }
        
        // Fetch friend count
        const { count, error: countError } = await supabase
          .from('friendships')
          .select('*', { count: 'exact', head: true })
          .or(`user_id.eq.${id}.and.status.eq.accepted,friend_id.eq.${id}.and.status.eq.accepted`);
        
        if (!countError && count !== null) {
          setFriendCount(count);
        }
        
        // Fetch badge preferences if user is premium
        if (profileData.is_premium) {
          const { data: badgeData, error: badgeError } = await supabase
            .from('badge_preferences')
            .select('*')
            .eq('user_id', id)
            .single();
          
          if (!badgeError && badgeData) {
            setBadgeColor(badgeData.badge_color || 'green');
            setBadgeVisible(badgeData.badge_visible !== false);
          }
        }
      } catch (err: any) {
        console.error('Error fetching user profile:', err);
        setError(err.message || 'Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [id, user]);

  // Handle sending friend request
  const handleAddFriend = async () => {
    if (!user || !id) return;
    
    try {
      // Create a pending friendship record
      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: id,
          status: 'pending'
        });
      
      if (error) throw error;
      
      // Update UI state
      setFriendshipStatus('pending');
      setIsRequester(true);
      
      showNotification({
        message: 'Friend request sent!',
        type: 'success',
        duration: 3000
      });
    } catch (err: any) {
      console.error('Error sending friend request:', err);
      showNotification({
        message: 'Failed to send friend request',
        type: 'error',
        duration: 3000
      });
    }
  };

  // Handle accepting friend request
  const handleAcceptFriendRequest = async () => {
    if (!user || !id || !friendshipId) return;
    
    try {
      // Update friendship status
      const { error } = await supabase
        .from('friendships')
        .update({ 
          status: 'accepted', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', friendshipId);
      
      if (error) throw error;
      
      // Update UI state
      setFriendshipStatus('accepted');
      setFriendCount(prev => prev + 1);
      
      showNotification({
        message: 'Friend request accepted!',
        type: 'success',
        duration: 3000
      });
    } catch (err: any) {
      console.error('Error accepting friend request:', err);
      showNotification({
        message: 'Failed to accept friend request',
        type: 'error',
        duration: 3000
      });
    }
  };

  // Handle declining friend request
  const handleDeclineFriendRequest = async () => {
    if (!user || !id || !friendshipId) return;
    
    try {
      // Delete the friendship record
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      
      if (error) throw error;
      
      // Update UI state
      setFriendshipStatus(null);
      setFriendshipId(null);
      
      showNotification({
        message: 'Friend request declined',
        type: 'info',
        duration: 3000
      });
    } catch (err: any) {
      console.error('Error declining friend request:', err);
      showNotification({
        message: 'Failed to decline friend request',
        type: 'error',
        duration: 3000
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
          <LoadingSpinner size="lg" text="Loading profile..." />
        </div>
      </AppLayout>
    );
  }

  if (error || !userProfile) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Profile</h2>
            <p className="text-red-300 mb-4">{error || 'User not found'}</p>
            <button
              onClick={() => navigate('/search')}
              className="px-4 py-2 bg-accent text-buttonText rounded-md"
            >
              Back to Search
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-surface rounded-lg shadow-lg p-6 mb-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Profile image */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-accent/20">
                  <UserAvatar 
                    userId={userProfile.id} 
                    avatarUrl={userProfile.avatar_url} 
                    size="xl"
                  />
                </div>
                {isPremium && badgeVisible && (
                  <div className="absolute -top-2 -right-2">
                    <PremiumBadge color={badgeColor} />
                  </div>
                )}
              </div>
              
              {/* Profile info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl font-bold">
                  {userProfile.full_name || 'User'}
                </h1>
                {userProfile.username && (
                  <p className="text-lg text-muted mb-4">@{userProfile.username}</p>
                )}
                
                <div className="flex flex-col md:flex-row gap-3 mt-4 md:items-center">
                  <button
                    onClick={() => setShowFriends(true)}
                    className="px-4 py-2 bg-surface-light border border-accent/10 rounded-md text-sm hover:bg-hover"
                  >
                    {friendCount} {friendCount === 1 ? 'Friend' : 'Friends'}
                  </button>
                  
                  {/* Friend request button */}
                  {user && (
                    <>
                      {friendshipStatus === 'accepted' ? (
                        <div className="px-4 py-2 bg-green-900/30 text-green-400 rounded-md">
                          Friends
                        </div>
                      ) : friendshipStatus === 'pending' ? (
                        isRequester ? (
                          <div className="px-4 py-2 bg-green-900/30 text-green-400 rounded-md">
                            Friend Request Sent
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={handleAcceptFriendRequest}
                              className="px-4 py-2 bg-accent hover:bg-accent/90 text-buttonText rounded-md"
                            >
                              Accept
                            </button>
                            <button
                              onClick={handleDeclineFriendRequest}
                              className="px-4 py-2 bg-hover hover:bg-red-500/20 text-red-400 rounded-md"
                            >
                              Decline
                            </button>
                          </div>
                        )
                      ) : (
                        <button
                          onClick={handleAddFriend}
                          className="px-4 py-2 bg-accent hover:bg-accent/90 text-buttonText rounded-md"
                        >
                          Add Friend
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Member info */}
          <div className="bg-surface rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Member Information</h2>
            <div className="divide-y divide-gray-700">
              {isPremium && (
                <div className="flex justify-between py-3">
                  <span className="text-text/70">Account type</span>
                  <span className="font-medium text-accent">Premium</span>
                </div>
              )}
              <div className="flex justify-between py-3">
                <span className="text-text/70">Member since</span>
                <span className="font-medium">
                  {userProfile.created_at 
                    ? new Date(userProfile.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Friends modal */}
        {showFriends && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
            <Friends userId={id} onClose={() => setShowFriends(false)} showWorldwide={true} />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default UserProfile; 