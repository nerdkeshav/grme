import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabaseClient';
import AppLayout from '../layout/AppLayout';
import UserAvatar from '../shared/UserAvatar';
import LoadingSpinner from '../shared/LoadingSpinner';

interface LeaderboardUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  points: number;
  rank: number;
  progressPercentage: number;
  isCurrentUser?: boolean;
}

// Type for the Supabase response to be properly typed
interface ProfileData {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at?: string;
}

interface AuraPointData {
  points: number;
  user_id: string;
  profiles: ProfileData;
}

// Utility function to safely extract profile data
const extractProfileData = (profileData: any): ProfileData => {
  return {
    id: profileData?.id || '',
    username: profileData?.username || null,
    full_name: profileData?.full_name || null,
    avatar_url: profileData?.avatar_url || null
  };
};

const Leaderboard: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'allTime'>('monthly');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      fetchLeaderboardData();
    }
  }, [user, period]);

  const fetchLeaderboardData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Get period date filter
      const periodDate = new Date();
      if (period === 'weekly') {
        periodDate.setDate(periodDate.getDate() - 7);
      } else if (period === 'monthly') {
        periodDate.setMonth(periodDate.getMonth() - 1);
      }
      
      // Use RPC for better performance and error handling
      let data;
      
      if (period === 'allTime') {
        // Get all-time leaderboard data
        const { data: pointsData, error: pointsError } = await supabase
          .from('aura_points')
          .select(`
            points,
            user_id,
            profiles:profiles(id, username, full_name, avatar_url, created_at)
          `)
          .order('points', { ascending: false });
          
        if (pointsError) throw pointsError;
        data = pointsData;
      } else {
        // Get period-specific data
        // Use a different query approach that's likely to work better
        const { data: pointsData, error: pointsError } = await supabase
          .from('aura_points_audit')
          .select(`
            points,
            user_id,
            created_at,
            profiles:profiles(id, username, full_name, avatar_url, created_at)
          `)
          .gte('created_at', periodDate.toISOString())
          .order('points', { ascending: false });
          
        if (pointsError) throw pointsError;
        
        // Aggregate points by user
        const userPoints: Record<string, {
          user_id: string;
          points: number;
          profiles: ProfileData;
        }> = {};
        
        pointsData?.forEach((entry: { user_id: string, points: number, profiles: any }) => {
          const userId = entry.user_id;
          if (!userPoints[userId]) {
            userPoints[userId] = {
              user_id: userId,
              points: 0,
              profiles: extractProfileData(entry.profiles)
            };
          }
          userPoints[userId].points += entry.points;
        });
        
        data = Object.values(userPoints).sort((a, b) => b.points - a.points);
      }
      
      if (!data || data.length === 0) {
        setLeaderboardData([]);
        setLoading(false);
        return;
      }
      
      // Process and transform the data with proper typing
      const processedData: LeaderboardUser[] = (data as unknown as AuraPointData[])
        .filter(item => item.profiles) // Filter out entries with no profile
        .map(item => ({
          id: item.user_id,
          username: item.profiles.username || 'anonymous',
          fullName: item.profiles.full_name || 'Anonymous User',
          avatarUrl: item.profiles.avatar_url,
          points: item.points || 0,
          rank: 0, // Will be calculated after sorting
          progressPercentage: Math.min(100, Math.round((item.points / 1500) * 100)) || 0,
          isCurrentUser: item.user_id === user?.id
        }))
        .sort((a, b) => b.points - a.points); // Sort by points
      
      // Calculate ranks
      processedData.forEach((item, index) => {
        item.rank = index + 1;
        });
      
      setLeaderboardData(processedData);
    } catch (err: any) {
      console.error('Error fetching leaderboard data:', err);
      setError(err.message || 'Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <h1 className="text-2xl font-bold mb-4 md:mb-0">Community Leaderboard</h1>
          
          <div className="inline-flex rounded-md shadow-sm">
            <button
              onClick={() => setPeriod('weekly')}
              className={`px-4 py-2 text-sm font-medium rounded-l-md ${
                period === 'weekly' 
                  ? 'bg-accent text-white' 
                  : 'bg-surface text-text hover:bg-hover'
              } transition-colors duration-300`}
            >
              Weekly
            </button>
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-4 py-2 text-sm font-medium ${
                period === 'monthly' 
                  ? 'bg-accent text-white' 
                  : 'bg-surface text-text hover:bg-hover'
              } transition-colors duration-300`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPeriod('allTime')}
              className={`px-4 py-2 text-sm font-medium rounded-r-md ${
                period === 'allTime' 
                  ? 'bg-accent text-white' 
                  : 'bg-surface text-text hover:bg-hover'
              } transition-colors duration-300`}
            >
              All Time
            </button>
          </div>
        </div>
        
        {loading ? (
          <LoadingSpinner 
            text="Loading leaderboard..." 
            subText="Gathering the latest rankings"
            type="logo"
            size="lg"
          />
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-lg">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={fetchLeaderboardData}
              className="mt-4 px-4 py-2 bg-accent text-white rounded-md"
            >
              Try Again
            </button>
            </div>
        ) : leaderboardData.length === 0 ? (
          <div className="bg-surface rounded-lg border border-border shadow-sm p-8 text-center">
            <p className="text-lg text-muted">No leaderboard data available for this period.</p>
          </div>
        ) : (
          <div className="bg-surface rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-surface/70">
                  <tr>
                    <th scope="col" className="pl-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Rank
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Progress
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {leaderboardData.map((user) => (
                    <tr 
                      key={user.id} 
                      className={`${user.isCurrentUser ? 'bg-accent/10' : 'bg-surface hover:bg-hover'} transition-colors duration-300`}
                    >
                      <td className="pl-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm ${
                          user.rank <= 3 
                            ? 'bg-accent/20 text-accent font-bold' 
                            : 'bg-surface/50 text-muted'
                        }`}>
                          {user.rank}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <UserAvatar 
                              userId={user.id}
                              avatarUrl={user.avatarUrl}
                              size="md"
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium">{user.fullName}</div>
                            <div className="text-sm text-muted">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
                          <div 
                            className="bg-accent h-2.5 rounded-full" 
                            style={{ width: `${user.progressPercentage}%` }}
                          ></div>
                        </div>
                        <div className="text-right text-xs text-muted">{user.progressPercentage}%</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                        {user.points.toLocaleString()} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-4 bg-surface/70 border-t border-gray-700">
              <p className="text-sm text-muted">
                Points are calculated based on your progress, consistency, and engagement with the platform.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Leaderboard; 