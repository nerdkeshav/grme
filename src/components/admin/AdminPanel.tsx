import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import AppLayout from '../layout/AppLayout';

interface User {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_premium: boolean;
  is_admin: boolean;
  aura_points?: number;
}

const AdminPanel: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { showNotification } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'premium' | 'admin' | 'aura' | null>(null);
  const [pointsAmount, setPointsAmount] = useState(0);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    // Check if user is admin
    if (!profile?.is_admin) {
      console.log('Access denied: Current user profile:', profile);
      setError('You do not have permission to access this page.');
      setIsLoading(false);
      return;
    }

    fetchUsers();
  }, [profile]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      
      // Fetch profiles with their aura points
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');
      
      if (profilesError) throw profilesError;

      // Fetch aura points for all users
      const { data: auraData, error: auraError } = await supabase
        .from('aura_points')
        .select('user_id, points');
      
      if (auraError) throw auraError;

      // Create a map of user_id to aura points
      const auraPointsMap = auraData?.reduce((acc: Record<string, number>, item: { user_id: string, points: number }) => {
        acc[item.user_id] = item.points;
        return acc;
      }, {} as Record<string, number>) || {};

      // Combine profiles with aura points
      const usersWithPoints = profilesData?.map((profile: { 
        id: string;
        username: string | null;
        full_name: string | null;
        avatar_url: string | null;
        created_at: string;
        is_premium: boolean;
        is_admin: boolean;
      }) => ({
        ...profile,
        aura_points: auraPointsMap[profile.id] || 0
      })) || [];

      setUsers(usersWithPoints);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const filteredUsers = users.filter(user => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchTermLower) ||
      user.full_name?.toLowerCase().includes(searchTermLower) ||
      user.id.includes(searchTerm)
    );
  });

  const handleTogglePremium = async (user: User) => {
    try {
      const newStatus = !user.is_premium;
      
      // Update user's premium status
      const { error } = await supabase
        .from('profiles')
        .update({ is_premium: newStatus })
        .eq('id', user.id);
      
      if (error) throw error;

      // Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action_type: newStatus ? 'GRANT_PREMIUM' : 'REVOKE_PREMIUM',
          target_user_id: user.id,
          details: { previous_status: user.is_premium, new_status: newStatus }
        });
      
      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === user.id ? { ...u, is_premium: newStatus } : u
        )
      );

      showNotification({
        message: `${user.username || 'User'}'s premium status ${newStatus ? 'granted' : 'revoked'} successfully`,
        type: 'success',
        duration: 3000
      });

    } catch (error: any) {
      console.error('Error updating premium status:', error);
      showNotification({
        message: `Error: ${error.message}`,
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleToggleAdmin = async (user: User) => {
    try {
      const newStatus = !user.is_admin;
      
      // Update user's admin status
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: newStatus })
        .eq('id', user.id);
      
      if (error) throw error;

      // Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action_type: newStatus ? 'GRANT_ADMIN' : 'REVOKE_ADMIN',
          target_user_id: user.id,
          details: { previous_status: user.is_admin, new_status: newStatus }
        });
      
      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === user.id ? { ...u, is_admin: newStatus } : u
        )
      );

      showNotification({
        message: `${user.username || 'User'}'s admin status ${newStatus ? 'granted' : 'revoked'} successfully`,
        type: 'success',
        duration: 3000
      });

    } catch (error: any) {
      console.error('Error updating admin status:', error);
      showNotification({
        message: `Error: ${error.message}`,
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleModifyAuraPoints = async (user: User, amount: number) => {
    try {
      // Check if user already has aura points
      const { data: existingPoints, error: fetchError } = await supabase
        .from('aura_points')
        .select('id, points')
        .eq('user_id', user.id)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      let newPoints = amount;
      
      if (existingPoints) {
        // Update existing points
        newPoints = existingPoints.points + amount;
        const { error: updateError } = await supabase
          .from('aura_points')
          .update({ points: newPoints })
          .eq('id', existingPoints.id);
        
        if (updateError) throw updateError;
      } else {
        // Create new aura points entry
        const { error: insertError } = await supabase
          .from('aura_points')
          .insert({
            user_id: user.id,
            points: amount
          });
        
        if (insertError) throw insertError;
      }

      // Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user?.id,
          action_type: 'MODIFY_AURA_POINTS',
          target_user_id: user.id,
          details: { 
            previous_points: user.aura_points || 0, 
            change: amount,
            new_points: newPoints 
          }
        });
      
      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === user.id ? { ...u, aura_points: newPoints } : u
        )
      );

      showNotification({
        message: `Added ${amount} Aura Points to ${user.username || 'User'}`,
        type: 'success',
        duration: 3000
      });

    } catch (error: any) {
      console.error('Error modifying aura points:', error);
      showNotification({
        message: `Error: ${error.message}`,
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleAction = () => {
    if (!selectedUser || !actionType) return;

    if (actionType === 'premium') {
      handleTogglePremium(selectedUser);
    } else if (actionType === 'admin') {
      handleToggleAdmin(selectedUser);
    } else if (actionType === 'aura') {
      handleModifyAuraPoints(selectedUser, pointsAmount);
    }

    // Reset the dialog
    setSelectedUser(null);
    setActionType(null);
    setPointsAmount(0);
  };

  const handleRefreshProfile = async () => {
    try {
      await refreshProfile();
      showNotification({
        message: 'Profile data refreshed',
        type: 'success',
        duration: 3000
      });
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  };

  if (error) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <div className="bg-red-900/30 text-red-400 p-4 rounded-lg max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p>{error}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 page-title">Admin Panel</h1>
        
        {error && (
          <div className="bg-red-900/30 text-red-400 p-4 rounded-lg mb-4">
            <p>{error}</p>
            <button 
              onClick={() => setDebugMode(!debugMode)}
              className="mt-2 text-sm underline"
            >
              {debugMode ? 'Hide Debug Info' : 'Show Debug Info'}
            </button>
            
            {debugMode && (
              <div className="mt-4 p-4 bg-surface rounded-lg text-xs overflow-auto">
                <h3 className="font-bold mb-2">Current User Profile:</h3>
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(profile, null, 2)}
                </pre>
                <div className="mt-4 flex gap-2">
                  <button 
                    onClick={handleRefreshProfile}
                    className="px-3 py-1 text-xs rounded bg-accent/20 hover:bg-accent/30"
                  >
                    Refresh Profile Data
                  </button>
                </div>
              </div>
            )}
            
            <div className="mt-4">
              <p>Run the make-admin.js script to give yourself admin privileges:</p>
              <code className="block bg-surface p-2 rounded mt-2 text-sm">
                node make-admin.js
              </code>
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-t-2 border-accent rounded-full"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">User Management</h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="bg-surface border border-accent/20 rounded-full py-2 px-4 pl-10 w-64"
                />
                <svg 
                  className="absolute left-3 top-2.5 w-4 h-4 text-muted" 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>
            </div>
            
            <div className="overflow-x-auto bg-surface rounded-lg border border-accent/10">
              <table className="min-w-full divide-y divide-accent/10">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Created At</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Aura Points</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accent/10">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                      <tr key={user.id} className="hover:bg-hover/30">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-accent/20 overflow-hidden mr-3">
                              {user.avatar_url ? (
                                <img 
                                  src={user.avatar_url} 
                                  alt={user.username || 'User'} 
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full text-accent p-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{user.full_name || 'Unnamed User'}</div>
                              {user.username && <div className="text-sm text-muted">@{user.username}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{user.id.substring(0, 8)}...</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-accent">{user.aura_points || 0}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            {user.is_premium && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/30 text-purple-400">
                                Premium
                              </span>
                            )}
                            {user.is_admin && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-400">
                                Admin
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('premium');
                              }}
                              className="px-3 py-1 rounded-md bg-purple-900/30 text-purple-400 hover:bg-purple-900/50"
                            >
                              {user.is_premium ? 'Revoke Premium' : 'Grant Premium'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('admin');
                              }}
                              className="px-3 py-1 rounded-md bg-red-900/30 text-red-400 hover:bg-red-900/50"
                            >
                              {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType('aura');
                                setPointsAmount(100);
                              }}
                              className="px-3 py-1 rounded-md bg-green-900/30 text-green-400 hover:bg-green-900/50"
                            >
                              Add Points
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-muted">
                        No users found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {selectedUser && actionType && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">
              {actionType === 'premium' 
                ? (selectedUser.is_premium ? 'Revoke Premium' : 'Grant Premium') 
                : actionType === 'admin'
                ? (selectedUser.is_admin ? 'Revoke Admin' : 'Make Admin')
                : 'Add Aura Points'}
            </h3>
            
            <p className="mb-6">
              {actionType === 'premium' 
                ? `Are you sure you want to ${selectedUser.is_premium ? 'revoke premium status from' : 'grant premium status to'} ${selectedUser.username || selectedUser.full_name || 'this user'}?`
                : actionType === 'admin'
                ? `Are you sure you want to ${selectedUser.is_admin ? 'revoke admin privileges from' : 'make admin'} ${selectedUser.username || selectedUser.full_name || 'this user'}?`
                : `Add Aura Points to ${selectedUser.username || selectedUser.full_name || 'this user'}`}
            </p>

            {actionType === 'aura' && (
              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Points to add</label>
                <input
                  type="number"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(parseInt(e.target.value) || 0)}
                  className="bg-surface border border-accent/20 rounded-md py-2 px-4 w-full"
                  min="1"
                />
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setActionType(null);
                  setPointsAmount(0);
                }}
                className="px-4 py-2 rounded-md bg-hover hover:bg-hover/70"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                className={`px-4 py-2 rounded-md ${
                  actionType === 'premium' 
                    ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50'
                    : actionType === 'admin'
                    ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                    : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default AdminPanel; 