import React, { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '../layout/AppLayout';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Profile } from '../../types/supabase';
import { useNotification } from '../../context/NotificationContext';
import { Link } from 'react-router-dom';
import useRealtimeOrPolling from '../../hooks/useRealtimeOrPolling';

// Extended profile type to include friendship data
interface ProfileWithFriendship extends Profile {
  friendshipStatus?: string | null;
  isRequester?: boolean;
}

// Define search result types
interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'tip' | 'progress' | 'exercise' | 'article' | 'user';
  link: string;
  imageUrl?: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  friendshipStatus?: string | null;
  isRequester?: boolean;
}

const Search: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [friendRequestSent, setFriendRequestSent] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load recent searches from local storage on component mount
  useEffect(() => {
    if (user) {
      const storedSearches = localStorage.getItem(`recent_searches_${user.id}`);
      if (storedSearches) {
        try {
          setRecentSearches(JSON.parse(storedSearches));
        } catch (err) {
          console.error('Error parsing recent searches:', err);
        }
      }
    }
  }, [user]);

  // Handle clicks outside the suggestions dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) && 
        searchInputRef.current && 
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus handler for the search input
  const handleInputFocus = () => {
    setShowSuggestions(true);
    // If we have previous search results, show them again
    if (searchTerm.trim() && !results.length) {
      performSearch(searchTerm);
    }
  };

  // Debounced search as user types
  useEffect(() => {
    if (searchTerm.trim()) {
      // Show suggestions immediately when typing
      setShowSuggestions(true);
      
      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // Set new timeout for search
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchTerm);
      }, 300); // 300ms debounce
    } else {
      setResults([]);
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Perform actual search
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || !user) return;

    setIsSearching(true);
    setError('');
    
    try {
      // Search for users with improved matching
      // First, escape any special characters in the query to prevent SQL injection
      const safeQuery = query.replace(/[%_]/g, '\\$&');
      
      // Use a parameterized query with multiple search patterns
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .or(
          `username.ilike.${safeQuery}%,` +          // Starts with exact match (highest priority)
          `username.ilike.%${safeQuery}%,` +         // Contains match (medium priority)
          `full_name.ilike.${safeQuery}%,` +         // Full name starts with
          `full_name.ilike.% ${safeQuery}%`          // Full name contains after space (for last names)
        )
        .neq('id', user.id) // Don't show current user
        .order('username', { ascending: true }) // Sort alphabetically
        .limit(20);
      
      if (profilesError) {
        console.error('Profile search error:', profilesError);
        throw new Error('Error searching for users: ' + profilesError.message);
      }
      
      if (!profilesData || profilesData.length === 0) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      // Get friendship status for each user - handle empty results case to avoid SQL errors
      const userIds = profilesData.map((profile: Profile) => profile.id);
      let friendshipsData: { id: string; user_id: string; friend_id: string; status: string }[] = [];
      
      // Fixed approach: Split into two separate queries instead of using complex OR condition
      if (userIds.length > 0) {
        // First query: Get friendships where current user is the requester
        const { data: outgoingFriendships, error: outgoingError } = await supabase
          .from('friendships')
          .select('id, user_id, friend_id, status')
          .eq('user_id', user.id)
          .in('friend_id', userIds);
        
        if (outgoingError) {
          console.error('Error getting outgoing friendships:', outgoingError);
        }
        
        // Second query: Get friendships where current user is the recipient
        const { data: incomingFriendships, error: incomingError } = await supabase
          .from('friendships')
          .select('id, user_id, friend_id, status')
          .eq('friend_id', user.id)
          .in('user_id', userIds);
        
        if (incomingError) {
          console.error('Error getting incoming friendships:', incomingError);
        }
        
        // Combine the results from both queries
        friendshipsData = [
          ...(outgoingFriendships as { id: string; user_id: string; friend_id: string; status: string }[] || []),
          ...(incomingFriendships as { id: string; user_id: string; friend_id: string; status: string }[] || [])
        ];
      }

      // Map friendship data to profiles
      const resultsWithFriendships: SearchResult[] = profilesData.map((profile: Profile) => {
        const friendship = friendshipsData.find((f: { user_id: string, friend_id: string, status: string }) => 
          (f.user_id === user.id && f.friend_id === profile.id) ||
          (f.friend_id === user.id && f.user_id === profile.id)
        );

        return {
          id: profile.id,
          title: profile.full_name || profile.username || 'Anonymous User',
          description: `@${profile.username || 'anonymous'}`,
          type: 'user', // Changed from 'tip' to 'user' for better clarity
          link: `/profile/${profile.id}`,
          avatar_url: profile.avatar_url,
          username: profile.username,
          full_name: profile.full_name,
          imageUrl: profile.avatar_url,
          friendshipStatus: friendship?.status || null,
          isRequester: friendship?.user_id === user.id || false
        };
      });

      // Update friend request sent UI state
      const newFriendRequestSent: Record<string, boolean> = {};
      resultsWithFriendships.forEach(profile => {
        if (profile.friendshipStatus === 'pending' && profile.isRequester) {
          newFriendRequestSent[profile.id] = true;
        }
      });
      
      setFriendRequestSent(prev => ({ ...prev, ...newFriendRequestSent }));
      setResults(resultsWithFriendships);
    } catch (err: any) {
      console.error('Error searching for users:', err);
      
      // Format specific error message for better user experience
      let errorMessage = 'Failed to search for users';
      
      // Handle parse errors specifically
      if (err.message?.includes('parse') || err.message?.includes('syntax')) {
        errorMessage = 'Search error: Invalid search format. Please try a simpler search query.';
      } else if (err.message?.includes('friendship')) {
        errorMessage = 'Error loading friendship data. Please try again.';
      } else if (err.message) {
        // Use the original error message if available
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      // Clear the error after a delay
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsSearching(false);
    }
  }, [user]);

  // Use our new hook instead of manually managing WebSocket subscription
  useRealtimeOrPolling(
    'friendships',
    '*',
    user ? `user_id.eq.${user.id},friend_id.eq.${user.id}` : null,
    useCallback(() => {
      // Refresh search results if they're showing
      if (searchTerm.trim() && results.length > 0 && !isSearching) {
        performSearch(searchTerm);
      }
    }, [searchTerm, results, isSearching, performSearch]),
    15000, // Check every 15 seconds instead of 10
  );

  // Normal search on form submit
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    
    setShowSuggestions(false);
    await performSearch(searchTerm);
  };

  // Add a user to recent searches
  const addToRecentSearches = (profile: SearchResult) => {
    if (!user) return;
    
    // Add to recent searches (remove duplicates and keep last 8)
    const updatedRecentSearches = [
      profile,
      ...recentSearches.filter(p => p.id !== profile.id)
    ].slice(0, 8);
    
    setRecentSearches(updatedRecentSearches);
    
    // Save to localStorage
    try {
      localStorage.setItem(
        `recent_searches_${user.id}`,
        JSON.stringify(updatedRecentSearches)
      );
    } catch (err) {
      console.error('Error saving recent searches:', err);
    }
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    if (!user) return;
    
    setRecentSearches([]);
    localStorage.removeItem(`recent_searches_${user.id}`);
  };

  const handleAddFriend = async (profileId: string) => {
    if (!user) return;
    
    try {
      // Create a pending friendship record
      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: profileId,
          status: 'pending'
        });
      
      if (error) throw error;
      
      // Update UI state
      setFriendRequestSent(prev => ({
        ...prev,
        [profileId]: true
      }));
      
      // No need to refresh results as real-time subscription will handle it
    } catch (err: any) {
      console.error('Error sending friend request:', err);
      // Show error to user
    }
  };

  const handleAcceptFriendRequest = async (friendId: string) => {
    if (!user) return;
    
    try {
      // Get the friendship id
      const { data, error: fetchError } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id', friendId)
        .eq('friend_id', user.id)
        .eq('status', 'pending')
        .single();
      
      if (fetchError) throw fetchError;
      if (!data) {
        throw new Error('Friendship request not found');
      }
      
      // Update friendship status
      const { error: updateError } = await supabase
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', data.id);
      
      if (updateError) throw updateError;
      
      // Update local state
      setResults(prevResults => 
        prevResults.map(p => 
          p.id === friendId 
            ? { ...p, friendshipStatus: 'accepted' } 
            : p
        )
      );
      
      showNotification({
        message: 'Friend request accepted!',
        type: 'success',
        duration: 3000
      });
    } catch (err: any) {
      console.error('Error accepting friend request:', err);
      setError(err.message || 'Failed to accept friend request');
      setTimeout(() => setError(''), 3000);
    }
  };
  
  const handleDeclineFriendRequest = async (friendId: string) => {
    if (!user) return;
    
    try {
      // Get the friendship id
      const { data, error: fetchError } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id', friendId)
        .eq('friend_id', user.id)
        .eq('status', 'pending')
        .single();
      
      if (fetchError) throw fetchError;
      if (!data) {
        throw new Error('Friendship request not found');
      }
      
      // Delete the friendship
      const { error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .eq('id', data.id);
      
      if (deleteError) throw deleteError;
      
      // Update local state
      setResults(prevResults => 
        prevResults.map(p => 
          p.id === friendId 
            ? { ...p, friendshipStatus: null, isRequester: false } 
            : p
        )
      );
      
      showNotification({
        message: 'Friend request declined',
        type: 'info',
        duration: 3000
      });
    } catch (err: any) {
      console.error('Error declining friend request:', err);
      setError(err.message || 'Failed to decline friend request');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Render user card (used in both search results and recent searches)
  const renderUserCard = (profile: SearchResult) => (
    <Link
      to={`/profile/${profile.id}`}
      key={profile.id} 
      className="block bg-surface border border-accent/10 rounded-lg p-4 hover:bg-surface-light transition-colors duration-200"
    >
      <div className="flex items-center">
        <div className="h-14 w-14 rounded-full bg-accent/20 overflow-hidden mr-4 border border-accent/30">
          {profile.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt={profile.username || 'User'} 
              className="h-full w-full object-cover"
              onError={(e) => {
                // Fall back to placeholder on image load error
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=User';
              }}
            />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full text-accent p-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{profile.full_name || 'User'}</h3>
          {profile.username && (
            <p className="text-sm text-muted truncate">
              @{profile.username}
            </p>
          )}
          {/* Show friendship badge for accepted friends */}
          {profile.friendshipStatus === 'accepted' && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-xs bg-green-900/30 text-green-400">
              Friends
            </span>
          )}
        </div>
        <div className="ml-2">
          {(() => {
            // Show appropriate button based on friendship status
            if (profile.friendshipStatus === 'accepted') {
              return (
                <button
                  className="px-3 py-1.5 rounded-md text-sm bg-surface-light border border-gray-700 text-text hover:bg-hover"
                  onClick={(e) => {
                    e.preventDefault();
                    // Show profile
                  }}
                >
                  View
                </button>
              );
            } else if (profile.friendshipStatus === 'pending') {
              return profile.isRequester ? (
                <span className="px-3 py-1.5 rounded-md text-sm bg-green-900/30 text-green-400">
                  Pending
                </span>
              ) : (
                <div className="flex flex-col space-y-2">
                  <button
                    className="px-3 py-1.5 rounded-md text-sm bg-accent hover:bg-accent/90 text-buttonText"
                    onClick={(e) => {
                      e.preventDefault();
                      handleAcceptFriendRequest(profile.id);
                    }}
                  >
                    Accept
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-md text-sm bg-hover hover:bg-red-500/20 text-red-400"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeclineFriendRequest(profile.id);
                    }}
                  >
                    Decline
                  </button>
                </div>
              );
            } else {
              // No relationship yet
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleAddFriend(profile.id);
                  }}
                  disabled={friendRequestSent[profile.id]}
                  className={`px-3 py-1.5 rounded-md text-sm ${
                    friendRequestSent[profile.id]
                      ? 'bg-green-900/30 text-green-400 cursor-not-allowed'
                      : 'bg-accent hover:bg-accent/90 text-buttonText'
                  }`}
                >
                  {friendRequestSent[profile.id] ? 'Requested' : 'Add Friend'}
                </button>
              );
            }
          })()}
        </div>
      </div>
    </Link>
  );

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Search Users</h1>
        
        <form onSubmit={handleSearch} className="mb-8 relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={handleInputFocus}
                placeholder="Search for users by username..."
                className="w-full rounded-md border-gray-700 bg-gray-800 px-4 py-2 pl-10 text-text focus:border-primary focus:ring-primary"
                autoComplete="off"
                aria-label="Search users"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              {searchTerm && (
                <button 
                  type="button"
                  className="absolute inset-y-0 right-2 flex items-center"
                  onClick={() => setSearchTerm('')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        
          {/* Live search suggestions dropdown */}
          {showSuggestions && (searchTerm.trim() || recentSearches.length > 0) && (
            <div 
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-2 bg-surface rounded-lg shadow-lg z-50 border border-accent/10 max-h-[60vh] overflow-y-auto"
            >
              {isSearching ? (
                <div className="p-4 text-center">
                  <div className="inline-flex flex-col items-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-accent"></div>
                    <p className="mt-2 text-xs text-accent">Searching...</p>
                  </div>
                </div>
              ) : (
                <>
                  {searchTerm.trim() && results.length > 0 ? (
                    <div className="p-3">
                      <div className="text-xs text-muted uppercase tracking-wider mb-2 px-2">Users</div>
                      <div className="space-y-2">
                        {results.map(profile => (
                          <Link 
                            key={profile.id}
                            to={`/profile/${profile.id}`}
                            className="block p-2 hover:bg-hover rounded-md"
                            onClick={() => {
                              addToRecentSearches(profile);
                              setShowSuggestions(false);
                            }}
                          >
                            <div className="flex items-center">
                              <div className="h-12 w-12 rounded-full bg-accent/20 overflow-hidden mr-3">
                                {profile.avatar_url ? (
                                  <img 
                                    src={profile.avatar_url} 
                                    alt={profile.username || 'User'} 
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full text-accent p-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{profile.full_name || 'User'}</div>
                                {profile.username && (
                                  <div className="text-xs text-muted">
                                    @{profile.username}
                                    {searchTerm && profile.username?.toLowerCase().includes(searchTerm.toLowerCase()) && (
                                      <span className="ml-2 text-primary-400 text-opacity-80">
                                        Matches "{searchTerm}"
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleAddFriend(profile.id);
                                }}
                                disabled={friendRequestSent[profile.id] || profile.friendshipStatus === 'accepted'}
                                className={`ml-auto px-3 py-1.5 rounded-md text-xs ${
                                  friendRequestSent[profile.id]
                                    ? 'bg-green-900/30 text-green-400 cursor-not-allowed'
                                    : profile.friendshipStatus === 'accepted'
                                    ? 'bg-green-900/30 text-green-400 cursor-not-allowed'
                                    : 'bg-accent hover:bg-accent/90 text-buttonText'
                                }`}
                              >
                                {friendRequestSent[profile.id] ? 'Sent' : 
                                  profile.friendshipStatus === 'accepted' ? 'Friends' : 'Add Friend'}
                              </button>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : searchTerm.trim() ? (
                    <div className="p-4 text-center text-muted">
                      No users found matching "{searchTerm}"
                    </div>
                  ) : null}
                  
                  {/* Recent searches section */}
                  {recentSearches.length > 0 && (
                    <div className="p-3 border-t border-accent/10">
                      <div className="flex justify-between items-center mb-2 px-2">
                        <div className="text-xs text-muted uppercase tracking-wider">Recent</div>
                        <button 
                          onClick={clearRecentSearches}
                          className="text-xs text-muted hover:text-white"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="space-y-2">
                        {recentSearches.map(profile => (
                          <Link 
                            key={profile.id}
                            to={`/profile/${profile.id}`} 
                            className="block p-2 hover:bg-hover rounded-md flex items-center"
                            onClick={() => {
                              setShowSuggestions(false);
                            }}
                          >
                            <div className="h-10 w-10 rounded-full bg-accent/20 overflow-hidden mr-3">
                              {profile.avatar_url ? (
                                <img 
                                  src={profile.avatar_url} 
                                  alt={profile.username || 'User'} 
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full text-accent p-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{profile.full_name || 'User'}</div>
                              {profile.username && <div className="text-xs text-muted">@{profile.username}</div>}
                            </div>
                            <button 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Remove this user from recent searches
                                const updated = recentSearches.filter(p => p.id !== profile.id);
                                setRecentSearches(updated);
                                localStorage.setItem(
                                  `recent_searches_${user?.id}`,
                                  JSON.stringify(updated)
                                );
                              }}
                              className="ml-auto text-muted hover:text-white p-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Main search results area (shown after submit) */}
        <div className="mt-6">
          {isSearching && !showSuggestions ? (
            <div className="flex justify-center py-14">
              <div className="relative flex flex-col items-center">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-accent"></div>
                <p className="mt-3 text-accent animate-pulse">Searching...</p>
              </div>
            </div>
          ) : results.length > 0 && !showSuggestions ? (
            <div className="space-y-4">
              {results.map(profile => renderUserCard(profile))}
            </div>
          ) : !searchTerm.trim() && !showSuggestions ? (
            <div className="text-center text-muted py-14">
              <div className="space-y-4">
                <svg 
                  className="w-20 h-20 mx-auto text-muted opacity-50" 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <p className="text-lg">Search for users</p>
                <p className="text-sm mt-2 opacity-70">
                  Search by username or full name<br />
                  Examples: "john", "jane doe", or "@username"
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
};

export default Search; 