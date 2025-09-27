import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../layout/AppLayout';
import { getDailyTips, saveTip } from '../../api/tipsService';
import { Tip } from '../../types/supabase';
import { supabase } from '../../utils/supabaseClient';
import PersonalRoutineComponent from './PersonalRoutine';

const Tips: React.FC = () => {
  const { user, profile } = useAuth();
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTipId, setSavingTipId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString());
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  
  // Categories for the search dropdown
  const categories = [
    'Skincare',
    'Haircare',
    'Facial Structure',
    'Fitness',
    'Style',
    'Makeup',
    'Posture',
    'Nutrition',
    'Sleep'
  ];

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      setLoading(true);
      setError('');
      
      try {
        const dailyTips = await getDailyTips(user.id, 3);
        setTips(dailyTips);
      } catch (err: any) {
        console.error('Error fetching tips:', err);
        setError(err.message || 'Failed to load daily tips');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
    
    // Set up a "refresh" of tips when the date changes
    const timer = setInterval(() => {
      const currentDate = new Date().toLocaleDateString();
      if (currentDate !== date) {
        setDate(currentDate);
        fetchUserData();
      }
    }, 60000); // Check every minute

    return () => clearInterval(timer);
  }, [user, date]);

  const handleSaveTip = async (tipId: string) => {
    if (!user) return;
    
    setSavingTipId(tipId);
    setError('');
    setSuccess('');
    
    try {
      await saveTip(user.id, tipId);
      setSuccess('Tip saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error saving tip:', err);
      setError(err.message || 'Failed to save tip');
      
      // Clear error message after 3 seconds
      setTimeout(() => setError(''), 3000);
    } finally {
      setSavingTipId(null);
    }
  };

  // Search for tips based on query
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError('');
    
    try {
      // In a production app, this would call an AI service API
      // For now, we'll simulate results by generating them based on the query
      
      // First check if we have matching tips in the database
      const { data: dbTips, error: dbError } = await supabase
        .from('tips')
        .select('*')
        .ilike('category', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (dbError) throw dbError;
      
      if (dbTips && dbTips.length > 0) {
        // Map database tips to our Tip type
        const formattedTips = dbTips.map((tip: { id: string, title: string, description: string, category: string, image_url: string | null, content: string, created_at: string }) => ({
          id: tip.id,
          title: tip.title,
          description: tip.description,
          category: tip.category,
          imageUrl: tip.image_url || undefined,
          content: tip.content,
          created_at: tip.created_at
        }));
        
        setTips(formattedTips);
      } else {
        // Simulate AI-generated tips if none found in database
        const aiGeneratedTips = generateAITips(searchQuery);
        
        // Save these tips to database for future use
        const { data: newTipsData, error: insertError } = await supabase
          .from('tips')
          .insert(aiGeneratedTips.map(tip => ({
            title: tip.title,
            description: tip.description,
            content: tip.description,
            category: tip.category,
            image_url: tip.imageUrl
          })))
          .select();
        
        if (insertError) throw insertError;
        
        // Map the newly inserted tips
        if (newTipsData) {
          const formattedNewTips = newTipsData.map((tip: { id: string, title: string, description: string, category: string, image_url: string | null, content: string, created_at: string }) => ({
            id: tip.id,
            title: tip.title,
            description: tip.description,
            category: tip.category,
            imageUrl: tip.image_url || undefined,
            content: tip.content,
            created_at: tip.created_at
          }));
          
          setTips(formattedNewTips);
        } else {
          setTips(aiGeneratedTips);
        }
      }
    } catch (err: any) {
      console.error('Error searching for tips:', err);
      setError(err.message || 'Failed to search for tips');
    } finally {
      setSearching(false);
    }
  };
  
  // Generate AI tips based on query (simulated for now)
  const generateAITips = (query: string): Tip[] => {
    const category = query.charAt(0).toUpperCase() + query.slice(1);
    
    // A large array of diverse images to ensure uniqueness
    const images = [
      'https://images.unsplash.com/photo-1606902965551-dce093cda6e7',
      'https://images.unsplash.com/photo-1582748151341-7aeba4a8e194',
      'https://images.unsplash.com/photo-1517391882955-e1b20cafee7a',
      'https://images.unsplash.com/photo-1633332755192-727a05c4013d',
      'https://images.unsplash.com/photo-1580489944761-15a19d654956',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
      'https://images.unsplash.com/photo-1573461148067-a55ab1207b4c',
      'https://images.unsplash.com/photo-1612531386530-97286d97c2d2',
      'https://images.unsplash.com/photo-1618355776464-ae82d5ccf208'
    ];
    
    // Randomly select three different images
    const shuffledImages = [...images].sort(() => 0.5 - Math.random());
    const selectedImages = shuffledImages.slice(0, 3);
    
    // Generate 3 different tips based on the query
    return [
      {
        id: `ai-${Date.now()}-1`,
        title: `Improve your ${category} with daily habits`,
        description: `Consistency is key to improving ${category}. Set aside 5-10 minutes each day to focus on specific exercises and techniques tailored for ${category} enhancement.`,
        category: category,
        imageUrl: selectedImages[0] + '?q=80&w=2000',
        created_at: new Date().toISOString()
      },
      {
        id: `ai-${Date.now()}-2`,
        title: `${category} enhancement tips from experts`,
        description: `Experts recommend focusing on proper nutrition, adequate hydration, and targeted exercises to maximize ${category} improvements over time.`,
        category: category,
        imageUrl: selectedImages[1] + '?q=80&w=2000',
        created_at: new Date().toISOString()
      },
      {
        id: `ai-${Date.now()}-3`,
        title: `Science-backed approaches to ${category}`,
        description: `Research shows that consistent attention to ${category} combined with proper skincare and lifestyle habits can lead to significant improvements within 4-6 weeks.`,
        category: category,
        imageUrl: selectedImages[2] + '?q=80&w=2000',
        created_at: new Date().toISOString()
      }
    ];
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-3 page-title">Tips & Advice</h1>
          <p className="text-muted mb-6" style={{ fontSize: 'calc(1rem * 1.02)', lineHeight: '1.6' }}>
            AI-powered recommendations to help improve your appearance
          </p>
          
          {/* Personal Routines Section - Premium Only */}
          <PersonalRoutineComponent />
          
          {/* Search Form */}
          <form onSubmit={handleSearch} className="mt-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for tips (e.g. jawline, skincare, haircare)"
                  className="w-full bg-hover rounded-lg px-4 py-3 text-text border border-accent/20 focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
              </div>
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="bg-accent hover:bg-accent/90 text-buttonText rounded-lg px-6 py-3 font-medium disabled:opacity-60"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
            
            {/* Categories */}
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSearchQuery(category)}
                  className="px-3 py-1 text-sm bg-hover hover:bg-hover/80 rounded-full"
                >
                  {category}
                </button>
              ))}
            </div>
          </form>
        </div>

        {error && (
          <div className="mb-8 rounded-md bg-red-500/20 px-5 py-4 text-sm text-red-400">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-8 rounded-md bg-green-500/20 px-5 py-4 text-sm text-green-400">
            {success}
          </div>
        )}

        {loading || searching ? (
          <div className="flex justify-center my-16">
            <div className="animate-pulse flex space-x-3">
              <div className="h-3 w-3 bg-muted rounded-full"></div>
              <div className="h-3 w-3 bg-muted rounded-full"></div>
              <div className="h-3 w-3 bg-muted rounded-full"></div>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-1 section-container">
            {tips.length > 0 ? (
              tips.map((tip) => (
                <div key={tip.id} className="bg-surface rounded-lg overflow-hidden shadow-lg">
                  {tip.imageUrl && (
                    <div className="w-full h-52 md:h-72 overflow-hidden">
                      <img 
                        src={tip.imageUrl} 
                        alt={tip.title} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fall back to a placeholder image when the original fails to load
                          const target = e.target as HTMLImageElement;
                          console.log(`Image failed to load: ${target.src}`);
                          target.src = 'https://via.placeholder.com/800x600?text=GRME+Tip';
                          target.onerror = null; // Prevent infinite loop
                        }}
                      />
                    </div>
                  )}
                  <div className="p-7">
                    <div className="uppercase tracking-wide text-xs font-semibold text-muted mb-2">
                      {tip.category}
                    </div>
                    <h2 className="text-xl font-semibold mb-3" style={{ fontSize: 'calc(1.25rem * 1.02)' }}>{tip.title}</h2>
                    <p className="text-muted" style={{ fontSize: 'calc(1rem * 1.02)', lineHeight: '1.6' }}>{tip.description}</p>
                    
                    <div className="mt-7 flex justify-between items-center">
                      <span className="text-xs text-muted">
                        {searchQuery ? 'Search result' : `Tip for ${new Date().toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'long', 
                          day: 'numeric' 
                        })}`}
                      </span>
                      <button 
                        className="text-sm py-1.5 px-4 border border-muted rounded-full hover:bg-hover transition-colors"
                        onClick={() => handleSaveTip(tip.id)}
                        disabled={savingTipId === tip.id}
                        style={{ fontSize: 'calc(0.875rem * 1.02)' }}
                      >
                        {savingTipId === tip.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted mb-4">No tips found. Try searching for a different topic.</p>
                <p className="text-sm text-muted">Try searching for topics like "skincare", "haircare", or "posture"</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-14 bg-surface rounded-lg p-7 section-container">
          <h2 className="text-lg font-semibold mb-5 section-title">How Tips Work</h2>
          <ul className="space-y-4 text-muted">
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-3 text-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span style={{ fontSize: 'calc(1rem * 1.02)', lineHeight: '1.5' }}>AI-powered tips based on your search queries</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-3 text-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span style={{ fontSize: 'calc(1rem * 1.02)', lineHeight: '1.5' }}>Get personalized recommendations by searching specific topics</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 mr-3 text-secondary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span style={{ fontSize: 'calc(1rem * 1.02)', lineHeight: '1.5' }}>Save tips to reference them later in your saved tips page</span>
            </li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
};

export default Tips; 