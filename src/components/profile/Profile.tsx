import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, STORAGE_BUCKETS } from '../../utils/supabaseClient';
import { compressImage, validateImageFile } from '../../utils/imageCompression';
import AppLayout from '../layout/AppLayout';
import Friends from './Friends';
import PremiumBadge from '../shared/PremiumBadge';
import UserAvatar from '../shared/UserAvatar';
import { BadgePreferences } from '../../types/supabase';

const Profile: React.FC = () => {
  const { user, profile, updateProfile, refreshProfile, checkConnection, resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showFriends, setShowFriends] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [deleteAccountSuccess, setDeleteAccountSuccess] = useState('');
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState('');
  const [auraPoints, setAuraPoints] = useState(0);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [friendCount, setFriendCount] = useState(0);
  const usernameTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [badgePreferences, setBadgePreferences] = useState<BadgePreferences | null>(null);
  const [badgeColor, setBadgeColor] = useState<'green' | 'red'>('green');
  const [badgeVisible, setBadgeVisible] = useState(true);
  const [savingBadgePrefs, setSavingBadgePrefs] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [resetPasswordSent, setResetPasswordSent] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');

  // Add a retry mechanism for loading profile data
  const tryLoadUserData = async () => {
    if (!user) return;
    
    setLoading(true);
    setProfileLoadError(false);
    
    try {
      // First check connection
      const connected = await checkConnection();
      if (!connected) {
        console.error('Cannot load user data due to connection issues');
        setProfileLoadError(true);
        setLoading(false);
        return;
      }
      
      // If profile is null, try refreshing it
      if (!profile) {
        await refreshProfile();
      }
      
      // Update local state from profile
      if (profile) {
        setFullName(profile.full_name || '');
        setUsername(profile.username || '');
        setAvatarPreview(profile.avatar_url || null);
      }
      
      // Load additional user data
      await Promise.all([
        fetchUserAuraPoints(),
        fetchFriendCount(),
        checkPremiumStatus(),
        fetchBadgePreferences()
      ]);
      
    } catch (err) {
      console.error('Error loading user data:', err);
      setProfileLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (user) {
      tryLoadUserData();
    }
  }, [user, profile]);
  
  // Add a profile recovery UI if we have issues
  const ProfileErrorState = () => {
    return (
      <div className="text-center p-6 bg-red-50 rounded-lg shadow-sm mb-6">
        <h2 className="text-xl font-bold text-red-600 mb-2">Profile Data Issue</h2>
        <p className="mb-4">We're having trouble loading your profile data. This could be due to connection issues or server problems.</p>
        <button
          onClick={() => tryLoadUserData()}
          className="px-4 py-2 bg-accent text-buttonText rounded-md"
          disabled={loading}
        >
          {loading ? 'Trying...' : 'Retry Loading Data'}
        </button>
      </div>
    );
  };

  // Function to cancel the processing
  const cancelProcessing = () => {
    setProcessing(false);
    setProcessingProgress(0);
    setUploadError(null);
  };

  // Retry upload function
  const retryUpload = () => {
    setUploadError(null);
    if (avatarFile) {
      handleSaveProfile();
    }
  };

  // Function to handle image selection
  const handleSelectImage = () => {
    fileInputRef.current?.click();
  };

  // Handle file change when user selects a new avatar
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const valid = validateImageFile(files[0]);
      if (!valid) {
        setError('Please select a valid image file (JPEG, PNG) under 5MB');
        return;
      }

      setAvatarFile(files[0]);
      // Create a preview URL
      const previewUrl = URL.createObjectURL(files[0]);
      setAvatarPreview(previewUrl);
      // Clear any previous errors
      setError('');
    } catch (err: any) {
      console.error('Error handling file selection:', err);
      setError(err.message || 'Failed to process selected image');
    }
  };

  // Check if user has premium subscription
  const checkPremiumStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('tier', ['premium', 'pro'])
        .limit(1)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
        console.error('Error checking premium status:', error);
        return;
      }
      
      setIsPremium(!!data);
    } catch (err) {
      console.error('Error in checkPremiumStatus:', err);
    }
  };
  
  // Fetch badge preferences
  const fetchBadgePreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('badge_preferences')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') { // No records found
          // Create default badge preferences if none exist
          await createDefaultBadgePreferences();
        } else {
          console.error('Error fetching badge preferences:', error);
        }
        return;
      }
      
      setBadgePreferences(data);
      setBadgeColor(data.badge_color);
      setBadgeVisible(data.badge_visible);
    } catch (err) {
      console.error('Error in fetchBadgePreferences:', err);
    }
  };
  
  // Create default badge preferences
  const createDefaultBadgePreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('badge_preferences')
        .insert({
          user_id: user.id,
          badge_color: 'green',
          badge_visible: true
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error creating default badge preferences:', error);
        return;
      }
      
      setBadgePreferences(data);
      setBadgeColor('green');
      setBadgeVisible(true);
    } catch (err) {
      console.error('Error in createDefaultBadgePreferences:', err);
    }
  };
  
  // Save badge preferences
  const saveBadgePreferences = async () => {
    if (!user) return;
    
    setSavingBadgePrefs(true);
    try {
      const { error } = await supabase
        .from('badge_preferences')
        .upsert({
          user_id: user.id,
          badge_color: badgeColor,
          badge_visible: badgeVisible,
          updated_at: new Date().toISOString()
        });
        
      if (error) {
        console.error('Error saving badge preferences:', error);
        setError('Failed to save badge preferences');
        return;
      }
      
      setSuccess('Badge preferences saved successfully');
    } catch (err) {
      console.error('Error in saveBadgePreferences:', err);
      setError('An error occurred while saving badge preferences');
    } finally {
      setSavingBadgePrefs(false);
    }
  };

  // Add username availability check
  const checkUsernameAvailability = async (username: string) => {
    if (!username || username === profile?.username) {
      setUsernameAvailable(null);
      return;
    }
    
    try {
      setCheckingUsername(true);
      
      // Check if username exists in profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .limit(1);
      
      if (error) throw error;
      
      // Username is available if no matching records found
      setUsernameAvailable(data.length === 0);
    } catch (err) {
      console.error('Error checking username:', err);
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };
  
  // Handle username change with debounce
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    
    // Clear any previous timeout
    if (usernameTimeoutRef.current) {
      clearTimeout(usernameTimeoutRef.current);
    }
    
    // Set a new timeout to check availability after typing stops
    usernameTimeoutRef.current = setTimeout(() => {
      checkUsernameAvailability(value);
    }, 500);
  };

  // Function to handle form submission
  const handleSaveProfile = async () => {
    if (!user) return;
    
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Check username availability one more time before saving
      if (username && username !== profile?.username) {
        setCheckingUsername(true);
        const { data, error: usernameError } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .limit(1);
        
        setCheckingUsername(false);
        
        if (usernameError) throw usernameError;
        
        if (data && data.length > 0) {
          setUsernameAvailable(false);
          throw new Error('This username is already taken. Please choose another one.');
        }
      }

      let avatarUrl = profile?.avatar_url || null;

      // Upload avatar if a file was selected
      if (avatarFile) {
        setProcessing(true);
        
        // Compress the image before uploading
        const compressedFile = await compressImage(avatarFile, {
          onProgress: (progress) => setProcessingProgress(progress)
        });
        
        // Upload to Supabase storage
        const fileName = `avatar-${user.id}-${Date.now()}`;
        const filePath = `${fileName}.jpg`;
        
        // Upload the file
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKETS.PROFILES)
          .upload(filePath, compressedFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get the public URL
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKETS.PROFILES)
          .getPublicUrl(filePath);
          
        avatarUrl = urlData.publicUrl;
      }
      
      // Update the user profile in Supabase
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
        full_name: fullName,
          username: username,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        // Check if this is a duplicate key violation
        if (updateError.message.includes('duplicate key') && updateError.message.includes('profiles_username_key')) {
          setUsernameAvailable(false);
          throw new Error('This username is already taken. Please choose another one.');
        }
        throw updateError;
      }

      setSuccess('Profile updated successfully');
      
      // If update was successful, update the context as well
      if (updateProfile) {
        await updateProfile({
          full_name: fullName,
          username: username,
          avatar_url: avatarUrl || undefined,
        });
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
      if (err.message.includes('username')) {
        setUsernameAvailable(false);
      }
    } finally {
      setLoading(false);
      setProcessing(false);
      setProcessingProgress(0);
    }
  };

  // Handle account deletion with email confirmation
  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setDeleteAccountError('');
    setDeleteAccountSuccess('');
    
    // Verify the email confirmation
    if (!confirmDeleteEmail || confirmDeleteEmail !== user.email) {
      setDeleteAccountError('Please enter your correct email address to confirm account deletion.');
      return;
    }
    
    try {
      setDeleteAccountSuccess('Processing your request...');
      
      // Instead of using admin API (which requires special privileges),
      // we can either sign out the user and mark their account as deleted in the database
      // or have the user delete their own data
      
      // 1. Mark profile as deleted
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          username: `deleted_${Date.now()}`,
          full_name: 'Deleted User',
          avatar_url: null
        })
        .eq('id', user.id);
        
      if (profileError) {
        throw profileError;
      }
      
      // 2. Sign the user out
      await supabase.auth.signOut();
      
      // Clear the confirmation email
      setConfirmDeleteEmail('');
      
      // Show success message
      setDeleteAccountSuccess('Your account has been marked for deletion. You will be signed out shortly.');
      
      // Redirect to homepage after a delay
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    } catch (err: any) {
      console.error('Error marking account for deletion:', err);
      setDeleteAccountError(err.message || 'Failed to process deletion request. Please try again later.');
    }
  };

  // Handle invite user
  const handleInviteUser = async () => {
    if (!user) return;
    
    // Validate email
    if (!inviteEmail || !/^\S+@\S+\.\S+$/.test(inviteEmail)) {
      setInviteError('Please enter a valid email address');
      return;
    }
    
    setInviteError('');
    setInviteSuccess('');
    
    try {
      // Generate a signup link that users can share
      const signupUrl = `${window.location.origin}/signup?referral=${user.id}`;
      
      // In a production app, this would trigger a server function to send an email
      // For now, we'll just display the link and let the user copy it
      setInviteSuccess('Invitation link ready to share!');
      setInviteEmail(''); // Reset email field
      
      // Copy to clipboard
      navigator.clipboard.writeText(signupUrl)
        .then(() => {
          setInviteSuccess('Signup link copied to clipboard! Share this with your friend.');
        })
        .catch(err => {
          console.error('Failed to copy link:', err);
          setInviteSuccess('Invitation link generated. Please copy manually: ' + signupUrl);
        });
    } catch (err: any) {
      console.error('Error generating invitation link:', err);
      setInviteError(err.message || 'Failed to generate invitation link');
    }
  };

  // Add this new function to fetch friend count
  const fetchFriendCount = async () => {
    if (!user) return;
    
    try {
      // Count friendships where the user is either the requester or the accepter
      const { data, error } = await supabase
        .from('friendships')
        .select('id', { count: 'exact' })
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
      
      if (error) throw error;
      
      setFriendCount(data.length);
    } catch (err) {
      console.error('Error fetching friend count:', err);
    }
  };

  // Add a function to fetch aura points
  const fetchUserAuraPoints = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('aura_points')
        .select('points')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No record found, set to 0
          setAuraPoints(0);
        } else {
          console.error('Error fetching aura points:', error);
          // Set to 0 as a fallback
          setAuraPoints(0);
        }
      } else if (data) {
        // Set the actual points from the database
        setAuraPoints(data.points);
      } else {
        // No data, default to 0
        setAuraPoints(0);
      }
    } catch (err) {
      console.error('Error in fetchUserAuraPoints:', err);
      // Set to 0 as a fallback
      setAuraPoints(0);
    }
  };

  // Add a function to handle password reset
  const handleResetPassword = async () => {
    if (!user?.email) return;
    
    setResetPasswordError('');
    setResetPasswordSent(false);
    setLoading(true);
    
    try {
      const { error } = await resetPassword(user.email);
      
      if (error) {
        setResetPasswordError(error.message);
      } else {
        setResetPasswordSent(true);
      }
    } catch (err: any) {
      setResetPasswordError(err.message || 'Failed to send reset password email');
    } finally {
      setLoading(false);
    }
  };

  // Render the processing animation
  const renderProcessingAnimation = () => {
    if (processingProgress <= 0 && !uploadError) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm transition-opacity"
           style={{ opacity: processingProgress < 100 || uploadError ? 1 : 0 }}>
        <div className="bg-surface p-8 rounded-xl shadow-2xl max-w-md w-full">
          {uploadError ? (
            // Error state
            <div className="text-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto text-red-500 mb-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <h3 className="text-xl font-bold mb-2 text-red-500">Upload Failed</h3>
              <p className="text-muted text-sm mb-4">{uploadError}</p>
              
              <div className="flex space-x-4 justify-center">
                <button 
                  onClick={cancelProcessing}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={retryUpload}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            // Processing state with progress indicator
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-6 relative">
                <svg className="w-full h-full text-gray-600" viewBox="0 0 100 100">
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    stroke="currentColor" 
                    strokeWidth="8" 
                    fill="none" 
                    opacity="0.3" 
                  />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    stroke="currentColor" 
                    strokeWidth="8" 
                    fill="none" 
                    strokeDasharray="251.2" 
                    strokeDashoffset={(251.2 * (100 - processingProgress)) / 100} 
                    className="text-accent" 
                    transform="rotate(-90 50 50)" 
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-semibold">
                    {Math.round(processingProgress)}%
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Processing Image</h3>
              <p className="text-muted text-sm">Please wait while we process your avatar</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render delete account confirmation modal
  const renderDeleteConfirmation = () => {
    if (!showDeleteConfirm) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
        <div className="bg-surface rounded-lg p-6 w-full max-w-md mx-4">
          <h3 className="text-xl font-semibold mb-4">Delete Account</h3>
          <p className="text-muted mb-6">
            This action is permanent and cannot be undone. All your data will be removed.
            Please enter your email address to confirm.
          </p>

          {deleteAccountError && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
              {deleteAccountError}
            </div>
          )}

          {deleteAccountSuccess && (
            <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400">
              {deleteAccountSuccess}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="confirm-email" className="block text-sm font-medium mb-1">
              Confirm your email: {user?.email}
            </label>
            <input
              id="confirm-email"
              type="email"
              value={confirmDeleteEmail}
              onChange={(e) => setConfirmDeleteEmail(e.target.value)}
              className="w-full px-3 py-2 bg-hover border border-accent/20 rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Enter your email"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                setConfirmDeleteEmail('');
                setDeleteAccountError('');
                setDeleteAccountSuccess('');
              }}
              className="px-4 py-2 border border-accent/20 rounded-md hover:bg-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md"
            >
              Delete My Account
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render invite user modal
  const renderInviteUserModal = () => {
    if (!showInviteUser) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
        <div className="bg-surface p-6 rounded-xl shadow-2xl max-w-md w-full">
          <h3 className="text-xl font-bold mb-3">Invite a Friend</h3>
          
          {!inviteSuccess ? (
            <>
              <p className="text-muted text-sm mb-4">
                Enter your friend's email address to generate a signup link you can share with them.
              </p>
              
              {inviteError && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                  {inviteError}
                </div>
              )}
              
              <div className="mb-4">
                <label htmlFor="inviteEmail" className="block text-sm text-muted mb-2">Email Address</label>
                <input
                  type="email"
                  id="inviteEmail"
                  placeholder="friend@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-hover rounded-lg px-4 py-3 text-text border border-accent/20 focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
              </div>
            </>
          ) : (
            <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-400 text-sm">
              {inviteSuccess}
            </div>
          )}
          
          <div className="flex justify-end space-x-3 mt-4">
            <button 
              onClick={() => {
                setShowInviteUser(false);
                setTimeout(() => {
                  setInviteSuccess('');
                  setInviteError('');
                }, 300);
              }}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
            >
              {inviteSuccess ? 'Close' : 'Cancel'}
            </button>
            {!inviteSuccess && (
              <button 
                onClick={handleInviteUser}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition"
              >
                Generate Link
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-screen-lg">
        <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
        
        {/* Show error state if we have profile loading issues */}
        {profileLoadError && <ProfileErrorState />}
        
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 page-title">Profile</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-400">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="rounded-lg bg-surface p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-6">Edit Profile</h2>
                
                {/* Email display section */}
                <div className="mb-6 p-4 bg-surface rounded-lg border border-accent/10">
                  <h3 className="text-md font-medium mb-2">Email Address</h3>
                  <div className="flex items-center">
                    <div className="px-3 py-2 bg-hover border border-border rounded-md text-text w-full">
                      {user?.email || 'No email available'}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted">Your email cannot be changed directly.</p>
                </div>
                
                {/* Reset password section */}
                <div className="mb-6 p-4 bg-surface rounded-lg border border-accent/10">
                  <h3 className="text-md font-medium mb-2">Password</h3>
                  
                  {resetPasswordSent && (
                    <div className="mb-3 p-2 bg-green-900/30 border border-green-700 rounded text-green-400 text-sm">
                      Password reset email sent. Please check your inbox.
                    </div>
                  )}
                  
                  {resetPasswordError && (
                    <div className="mb-3 p-2 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
                      {resetPasswordError}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted">Change your account password</p>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={loading}
                      className="px-3 py-1.5 bg-accent text-buttonText rounded-md hover:bg-accent/90 transition-colors duration-300 disabled:opacity-70"
                    >
                      {loading ? 'Sending...' : 'Reset Password'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted">We'll send a reset link to your email address.</p>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label htmlFor="fullName" className="block text-sm text-muted mb-2">Full Name</label>
                    <input
                      type="text"
                      id="fullName"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-hover rounded-lg px-4 py-3 text-text border border-accent/20 focus:outline-none focus:ring-1 focus:ring-accent/50"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="username" className="block text-sm text-muted mb-2">Username</label>
                    <div className="relative">
                      <input
                        type="text"
                        id="username"
                        placeholder="Your username"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        className={`w-full bg-hover rounded-lg px-4 py-3 text-text border ${
                          usernameAvailable === true ? 'border-green-500' : 
                          usernameAvailable === false ? 'border-red-500' : 
                          'border-accent/20'
                        } focus:outline-none focus:ring-1 focus:ring-accent/50`}
                      />
                      
                      {checkingUsername && (
                        <div className="absolute right-3 top-3">
                          <div className="animate-spin h-5 w-5 border-2 border-accent/70 rounded-full border-t-transparent"></div>
                        </div>
                      )}
                      
                      {!checkingUsername && usernameAvailable !== null && username && (
                        <div className="absolute right-3 top-3">
                          {usernameAvailable ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {usernameAvailable === false && username && (
                      <p className="text-red-400 text-xs mt-1">This username is already taken</p>
                    )}
                    
                    {usernameAvailable === true && username && (
                      <p className="text-green-400 text-xs mt-1">Username is available</p>
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading || processing || usernameAvailable === false}
                      className={`px-5 py-2.5 rounded-lg text-buttonText ${
                        loading || processing || usernameAvailable === false
                          ? 'bg-accent/50 cursor-not-allowed'
                          : 'bg-accent hover:bg-accent/90'
                      }`}
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:row-start-1 lg:col-start-3">
              <div className="rounded-lg bg-surface p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Profile Picture</h2>
                
                <div className="relative mx-auto w-32 h-32">
                  {user && (
                    <>
                      {avatarFile ? (
                        // Show local preview if a file is selected
                        <div className="rounded-full overflow-hidden w-32 h-32 border-2 border-accent/20 shadow-lg">
                          <img 
                            src={avatarPreview || ''} 
                            alt="Profile preview" 
                            className="w-full h-full object-cover"
                          />
                          {isPremium && badgeVisible && (
                            <div className="absolute -top-2 -right-2">
                              <PremiumBadge color={badgeColor as 'green' | 'red'} />
                            </div>
                          )}
                        </div>
                      ) : (
                        // Otherwise use the UserAvatar component
                        <UserAvatar 
                          userId={user.id} 
                          avatarUrl={profile?.avatar_url} 
                          size="xl"
                        />
                      )}
                    </>
                  )}
                  
                <button
                  onClick={handleSelectImage}
                    className="absolute bottom-0 right-0 bg-accent hover:bg-accent/90 text-buttonText rounded-full p-2 shadow-lg border-2 border-background"
                    title="Upload Profile Picture"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
                  </svg>
                </button>
                  
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />
              </div>

                <p className="text-center text-xs text-muted mt-2">Max 5MB</p>
                  </div>

              <div className="mt-6 pt-6 border-t border-accent/10">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-muted">Aura Points</span>
                  <span className="text-2xl font-bold text-accent">{auraPoints}</span>
                  </div>
                <div className="w-full h-2 bg-accent/10 rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${Math.min(100, auraPoints / 10)}%` }}></div>
                </div>

                  <button
                  onClick={() => setShowFriends(true)}
                  className="flex items-center justify-center gap-2 w-full bg-accent/10 hover:bg-accent/20 text-accent py-2 rounded-md transition-colors"
                  >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>{friendCount} {friendCount === 1 ? 'Friend' : 'Friends'}</span>
                  </button>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-lg bg-surface p-6 shadow-lg">
            <h2 className="text-xl font-semibold">Account Information</h2>
            <div className="mt-4">
              <div className="flex justify-between py-3 border-b border-gray-700">
                <span className="text-text/70">Account type</span>
                <span className="font-medium">{isPremium ? 'Premium' : 'Free'}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-gray-700">
                <span className="text-text/70">Member since</span>
                <span className="font-medium">
                  {profile?.created_at 
                    ? new Date(profile.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
              
              {isPremium && (
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <h3 className="font-medium mb-4">Premium Badge Settings</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={badgeVisible}
                          onChange={(e) => setBadgeVisible(e.target.checked)}
                          className="rounded bg-hover text-accent border-accent/20 focus:ring-accent focus:ring-opacity-50 mr-2"
                        />
                        <span>Show premium badge on profile</span>
                      </label>
                    </div>
                    
                    <div>
                      <label className="block mb-2">Badge Color</label>
                      <div className="flex gap-3">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="badgeColor"
                            value="green"
                            checked={badgeColor === 'green'}
                            onChange={() => setBadgeColor('green')}
                            className="hidden"
                          />
                          <div className={`w-6 h-6 rounded-full bg-green-500 ${badgeColor === 'green' ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''}`}></div>
                          <span className="ml-2">Green</span>
                        </label>
                        
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="badgeColor"
                            value="red"
                            checked={badgeColor === 'red'}
                            onChange={() => setBadgeColor('red')}
                            className="hidden"
                          />
                          <div className={`w-6 h-6 rounded-full bg-red-500 ${badgeColor === 'red' ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''}`}></div>
                          <span className="ml-2">Red</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="flex items-center pt-2">
                      <span className="mr-4">Preview:</span>
                      <PremiumBadge color={badgeColor} />
                    </div>
                    
                    <div className="pt-2">
                      <button
                        onClick={saveBadgePreferences}
                        disabled={savingBadgePrefs}
                        className={`px-4 py-2 rounded-md text-white ${
                          savingBadgePrefs 
                            ? 'bg-accent/50 cursor-not-allowed' 
                            : 'bg-accent hover:bg-accent/90'
                        }`}
                      >
                        {savingBadgePrefs ? 'Saving...' : 'Save Badge Preferences'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-6">
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-400 hover:text-red-300 text-sm font-medium"
              >
                Delete Account
              </button>
              
              {/* Add Invite User button */}
              <div className="mt-6 pt-6 border-t border-gray-700">
                <h3 className="font-medium mb-2">Invite a Friend</h3>
                <p className="text-muted text-sm mb-3">
                  Invite a friend to join GRME and start their self-improvement journey.
                </p>
                <button 
                  onClick={() => setShowInviteUser(true)}
                  className="px-4 py-2 bg-accent text-buttonText rounded-md hover:bg-accent/90 text-sm"
                >
                  Invite User
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Render processing animation */}
        {renderProcessingAnimation()}

        {/* Render delete account confirmation */}
        {renderDeleteConfirmation()}

        {/* Invite user modal */}
        {renderInviteUserModal()}

        {/* Friends modal */}
        {showFriends && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
            <Friends onClose={() => setShowFriends(false)} showWorldwide={true} />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Profile; 