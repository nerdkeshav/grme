import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import { Profile } from '../../types/supabase';
import UserAvatar from '../shared/UserAvatar';

interface FriendsProps {
  userId?: string; // If provided, show friends for this user, otherwise show current user's friends
  onClose?: () => void;
  showWorldwide?: boolean;
}

const Friends: React.FC<FriendsProps> = ({ userId, onClose, showWorldwide = false }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showPending, setShowPending] = useState(false);
  
  // View user is either provided userId or current user
  const viewUserId = userId || user?.id;

  // If we're viewing current user's profile
  const isCurrentUser = (!userId && user) || (userId && user && userId === user.id);
  
  useEffect(() => {
    if (viewUserId) {
      fetchFriends();
      
      if (isCurrentUser) {
        fetchPendingRequests();
      }
    }
  }, [viewUserId]);

  const fetchFriends = async () => {
    if (!viewUserId) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Fetch accepted friendships where the user is either the requester or the accepter
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          user_id,
          friend_id,
          friend:profiles!friendships_friend_id_fkey(id, username, full_name, avatar_url),
          user:profiles!friendships_user_id_fkey(id, username, full_name, avatar_url)
        `)
        .eq('status', 'accepted')
        .or(`user_id.eq.${viewUserId},friend_id.eq.${viewUserId}`);
      
      if (error) throw error;
      
      // Transform data to get friend profiles (regardless of whether they're in user_id or friend_id)
      const friendProfiles = data.map((friendship: any) => {
        const profileData = friendship.user_id === viewUserId ? friendship.friend : friendship.user;
        
        // Make sure the returned object matches the Profile type requirements
        return {
          id: profileData.id,
          username: profileData.username,
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url,
          // Add required Profile properties with default values
          user_id: profileData.id, // Use ID as a fallback
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as Profile;
      });
      
      setFriends(friendProfiles);
    } catch (err: any) {
      console.error('Error fetching friends:', err);
      setError(err.message || 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    if (!user?.id) return;
    
    try {
      // Fetch pending friendships where user is the recipient
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          user_id,
          user:profiles!friendships_user_id_fkey(id, username, full_name, avatar_url),
          created_at
        `)
        .eq('friend_id', user.id)
        .eq('status', 'pending');
      
      if (error) throw error;
      
      setPendingRequests(data);
    } catch (err: any) {
      console.error('Error fetching pending requests:', err);
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId)
        .eq('friend_id', user.id);
      
      if (error) throw error;
      
      // Refresh pending requests and friends
      fetchPendingRequests();
      fetchFriends();
    } catch (err: any) {
      console.error('Error accepting friend request:', err);
      setError(err.message || 'Failed to accept friend request');
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)
        .eq('friend_id', user.id);
      
      if (error) throw error;
      
      // Refresh pending requests
      fetchPendingRequests();
    } catch (err: any) {
      console.error('Error rejecting friend request:', err);
      setError(err.message || 'Failed to reject friend request');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`(user_id.eq.${user.id}.and.friend_id.eq.${friendId}),(user_id.eq.${friendId}.and.friend_id.eq.${user.id})`);
      
      if (error) throw error;
      
      // Refresh friends
      fetchFriends();
    } catch (err: any) {
      console.error('Error removing friend:', err);
      setError(err.message || 'Failed to remove friend');
    }
  };

  return (
    <div className="bg-surface rounded-lg shadow-xl max-w-lg w-full mx-auto overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-accent/10 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Friends</h2>
        <div className="flex items-center">
          {onClose && (
            <button onClick={onClose} className="text-muted hover:text-text">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Body */}
      <div className="p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
            {error}
          </div>
        )}
        
        {/* Pending requests section - only show for current user */}
        {isCurrentUser && pendingRequests.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowPending(!showPending)}
              className="flex items-center justify-between w-full p-2 bg-hover rounded-lg mb-2"
            >
              <span className="flex items-center">
                <span className="bg-accent text-buttonText rounded-full w-5 h-5 inline-flex items-center justify-center text-xs mr-2">
                  {pendingRequests.length}
                </span>
                <span>Pending Friend Requests</span>
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transform transition-transform ${showPending ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showPending && (
              <div className="space-y-3 mb-4">
                {pendingRequests.map(request => (
                  <div key={request.id} className="flex items-center justify-between p-3 bg-hover rounded-lg">
                    <div className="flex items-center">
                      <UserAvatar 
                        userId={request.user.id}
                        avatarUrl={request.user.avatar_url}
                        size="sm"
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium">{request.user.full_name || request.user.username}</div>
                        <div className="text-xs text-muted">@{request.user.username}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleAcceptRequest(request.id)}
                        className="text-green-500 hover:text-green-400 p-1"
                        title="Accept Request"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleRejectRequest(request.id)}
                        className="text-red-500 hover:text-red-400 p-1"
                        title="Reject Request"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Tabs for Friends/Worldwide - Only show tabs if showWorldwide is true */}
        {showWorldwide && (
          <div className="mb-4 border-b border-accent/10">
            <button
              className={`py-2 px-4 font-medium ${!showPending ? 'border-b-2 border-accent' : 'text-muted'}`}
              onClick={() => setShowPending(false)}
            >
              Friends
            </button>
            <button
              className={`py-2 px-4 font-medium ${showPending ? 'border-b-2 border-accent' : 'text-muted'}`}
              onClick={() => setShowPending(true)}
            >
              Worldwide
            </button>
          </div>
        )}
        
        {/* Friends list */}
        {loading ? (
          <div className="flex justify-center my-12">
            <div className="animate-pulse flex space-x-2">
              <div className="h-3 w-3 bg-muted rounded-full"></div>
              <div className="h-3 w-3 bg-muted rounded-full"></div>
              <div className="h-3 w-3 bg-muted rounded-full"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.length === 0 ? (
              <div className="text-center text-muted py-8">
                {isCurrentUser ? 
                  "You don't have any friends yet. Search for users to add them as friends." :
                  "This user doesn't have any friends yet."
                }
              </div>
            ) : (
              <>
                {friends.map(friend => (
                  <div key={friend.id} className="flex items-center justify-between p-3 bg-hover rounded-lg">
                    <div className="flex items-center">
                      <UserAvatar 
                        userId={friend.id}
                        avatarUrl={friend.avatar_url}
                        size="md"
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium">{friend.full_name || friend.username}</div>
                        <div className="text-xs text-muted">@{friend.username}</div>
                      </div>
                    </div>
                    {isCurrentUser && (
                      <button 
                        onClick={() => handleRemoveFriend(friend.id)}
                        className="text-red-500 hover:text-red-400 p-1"
                        title="Remove Friend"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Friends; 