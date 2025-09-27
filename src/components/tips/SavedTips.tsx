import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../layout/AppLayout';

interface SavedTip {
  id: string;
  tip_id: string;
  user_id: string;
  created_at: string;
  tip: {
    id: string;
    title: string;
    content: string;
    category: string;
    image_url?: string;
  };
}

const SavedTips: React.FC = () => {
  const { user } = useAuth();
  const [savedTips, setSavedTips] = useState<SavedTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    // In a real app, this would fetch saved tips from Supabase
    // For now, we'll use mock data
    const fetchSavedTips = async () => {
      try {
        setLoading(true);
        // Mock data for demonstration purposes
        const mockTips: SavedTip[] = [
          {
            id: '1',
            tip_id: '101',
            user_id: user?.id || '',
            created_at: new Date().toISOString(),
            tip: {
              id: '101',
              title: 'Proper Skin Care Routine',
              content: 'Cleanse, tone, moisturize daily. Use sunscreen during the day and apply a serum at night.',
              category: 'skincare',
              image_url: 'https://placehold.co/400x300/7C3AED/FFFFFF?text=Skin+Care+Routine'
            }
          },
          {
            id: '2',
            tip_id: '102',
            user_id: user?.id || '',
            created_at: new Date().toISOString(),
            tip: {
              id: '102',
              title: 'Proper Posture for Facial Harmony',
              content: 'Maintain good posture to enhance jawline definition and neck appearance.',
              category: 'posture',
              image_url: 'https://placehold.co/400x300/7C3AED/FFFFFF?text=Good+Posture'
            }
          },
          {
            id: '3',
            tip_id: '103',
            user_id: user?.id || '',
            created_at: new Date().toISOString(),
            tip: {
              id: '103',
              title: 'Face Exercises for Toning',
              content: 'Daily facial exercises can help tone facial muscles and improve definition.',
              category: 'exercise',
              image_url: 'https://placehold.co/400x300/7C3AED/FFFFFF?text=Face+Exercises'
            }
          }
        ];
        
        setSavedTips(mockTips);
      } catch (err) {
        console.error('Error fetching saved tips:', err);
        setError('Failed to load saved tips');
      } finally {
        setLoading(false);
      }
    };

    fetchSavedTips();
  }, [user]);

  const handleRemoveTip = (tipId: string) => {
    // In a real app, this would remove the tip from Supabase
    setSavedTips(prevTips => prevTips.filter(tip => tip.id !== tipId));
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Saved Tips</h1>
        
        {error && (
          <div className="bg-red-500/20 text-red-400 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="relative flex flex-col items-center">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-accent"></div>
              <p className="mt-3 text-accent animate-pulse">Loading saved tips...</p>
            </div>
          </div>
        ) : savedTips.length === 0 ? (
          <div className="text-center py-10 bg-surface rounded-lg">
            <p className="text-muted mb-4">You haven't saved any tips yet.</p>
            <a href="/tips" className="text-accent hover:underline">
              Browse tips to save
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedTips.map(savedTip => (
              <div 
                key={savedTip.id} 
                className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
              >
                {savedTip.tip.image_url && (
                  <div className="h-40 w-full overflow-hidden bg-gray-800">
                    <img 
                      src={savedTip.tip.image_url} 
                      alt={savedTip.tip.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold">{savedTip.tip.title}</h3>
                    <span className="bg-accent/20 text-accent text-xs px-2 py-1 rounded">
                      {savedTip.tip.category}
                    </span>
                  </div>
                  <p className="text-text/80 mb-4">{savedTip.tip.content}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">
                      Saved on {new Date(savedTip.created_at).toLocaleDateString()}
                    </span>
                    <button 
                      onClick={() => handleRemoveTip(savedTip.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SavedTips; 