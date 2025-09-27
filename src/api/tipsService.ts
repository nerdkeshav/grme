import { supabase } from '../utils/supabaseClient';
import { Tip, SavedTip } from '../types/supabase';

// Flag for using mock API in development
const USE_MOCK_API = false;

// Mock tips data - in a real app, this would come from an API/database
export const allTips: Tip[] = [
  {
    id: '1',
    title: 'Hydration for Better Skin',
    description: 'Drinking at least 8 glasses of water daily can improve skin elasticity and reduce dryness, giving your face a healthier glow.',
    category: 'skincare',
    imageUrl: 'https://images.unsplash.com/photo-1594540037777-e91d273f2f1e?q=80&w=1000',
  },
  {
    id: '2',
    title: 'Sleep Position Matters',
    description: 'Sleeping on your back can prevent compression wrinkles and facial asymmetry that develop over time from pressing your face against the pillow.',
    category: 'lifestyle',
    imageUrl: 'https://images.unsplash.com/photo-1631157805325-2fe2a9465e85?q=80&w=1000',
  },
  {
    id: '3',
    title: 'Daily Sunscreen Use',
    description: 'Apply SPF 30+ sunscreen every day, even when it\'s cloudy, to prevent premature aging, dark spots, and maintain even skin tone.',
    category: 'skincare',
    imageUrl: 'https://images.unsplash.com/photo-1526223873546-58972aba0ad6?q=80&w=1000',
  },
  {
    id: '4',
    title: 'Facial Exercises',
    description: 'Regular facial exercises can strengthen your facial muscles, improve definition, and reduce the appearance of sagging skin.',
    category: 'exercise',
    imageUrl: 'https://images.unsplash.com/photo-1540331732040-0625211f3adf?q=80&w=1000',
  },
  {
    id: '5',
    title: 'Posture Awareness',
    description: 'Maintaining good posture helps prevent double chin development and promotes proper alignment of facial features.',
    category: 'lifestyle',
    imageUrl: 'https://images.unsplash.com/photo-1517343985841-f8b2d66e010b?q=80&w=1000',
  },
  {
    id: '6',
    title: 'Avoid Excessive Sugar',
    description: 'High sugar consumption can lead to glycation, which damages collagen and elastin, causing premature aging and skin sagging.',
    category: 'nutrition',
    imageUrl: 'https://images.unsplash.com/photo-1525059337994-6f2a1311b4d4?q=80&w=1000',
  },
  {
    id: '7',
    title: 'Cold Water Face Rinse',
    description: 'Rinsing your face with cold water in the morning helps reduce puffiness and tighten pores for a more refreshed appearance.',
    category: 'skincare',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1000',
  },
  {
    id: '8',
    title: 'Proper Skincare Order',
    description: 'Apply products from thinnest to thickest: cleanse, tone, serums, moisturizer, and sunscreen for maximum effectiveness.',
    category: 'skincare',
    imageUrl: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?q=80&w=1000',
  },
  {
    id: '9',
    title: 'Face Massage Benefits',
    description: 'Regular facial massage stimulates blood flow, relieves tension, and helps products penetrate deeper into the skin.',
    category: 'skincare',
    imageUrl: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?q=80&w=1000',
  },
  {
    id: '10',
    title: 'Omega-3 Rich Foods',
    description: 'Include salmon, walnuts, and flaxseeds in your diet to provide essential fatty acids that help maintain skin suppleness.',
    category: 'nutrition',
    imageUrl: 'https://images.unsplash.com/photo-1599300789836-a5d0ec1d94aa?q=80&w=1000',
  },
];

// Mock saved tips storage
let mockSavedTips: Record<string, SavedTip[]> = {};

/**
 * Get random tips for a specific day
 * @param userId User ID
 * @param count Number of tips to return
 * @returns Array of tips
 */
export const getDailyTips = async (userId: string, count: number = 3): Promise<Tip[]> => {
  if (USE_MOCK_API) {
    // Get today's date in a format that can be used as a seed
    const today = new Date();
    const dateSeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    
    // Use the date as a seed to get consistent but changing tips each day
    const getRandomTips = (arr: Tip[], num: number, seed: number) => {
      const shuffled = [...arr].sort(() => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280 - 0.5;
      });
      return shuffled.slice(0, num);
    };
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Get random tips for today
    const dailyTips = getRandomTips(allTips, count, dateSeed);
    return dailyTips;
  }
  
  // In a real app, query Supabase for personalized tips
  const { data, error } = await supabase
    .from('tips')
    .select('*')
    .limit(count);
    
  if (error) {
    console.error('Error fetching tips:', error);
    throw error;
  }
  
  return data as Tip[];
};

/**
 * Save a tip for a user
 * @param userId User ID
 * @param tipId Tip ID to save
 * @returns The saved tip entry
 */
export const saveTip = async (userId: string, tipId: string): Promise<SavedTip> => {
  if (USE_MOCK_API) {
    // For mock mode, use the allTips array
    const tip = allTips.find(t => t.id === tipId);
    if (!tip) {
      throw new Error(`Tip with ID ${tipId} not found`);
    }
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if already saved
    if (mockSavedTips[userId] && mockSavedTips[userId].some(st => st.tip_id === tipId)) {
      throw new Error('Tip already saved');
    }
    
    // Create a new saved tip entry
    const savedTip: SavedTip = {
      id: `saved_tip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      user_id: userId,
      tip_id: tipId,
      created_at: new Date().toISOString(),
      tip: tip,
    };
    
    // Add to mock storage
    if (!mockSavedTips[userId]) {
      mockSavedTips[userId] = [];
    }
    mockSavedTips[userId].push(savedTip);
    
    return savedTip;
  }
  
  // In a real app, first check if the tip exists in the database
  const { data: tipData, error: tipError } = await supabase
    .from('tips')
    .select('*')
    .eq('id', tipId)
    .single();
    
  if (tipError) {
    console.error('Error finding tip:', tipError);
    throw new Error(`Tip with ID ${tipId} not found`);
  }
  
  // Format the tip
  const tip: Tip = {
    id: tipData.id,
    title: tipData.title,
    description: tipData.description,
    category: tipData.category,
    imageUrl: tipData.image_url,
    content: tipData.content,
    created_at: tipData.created_at
  };
  
  // Check if already saved
  const { data: existingData, error: existingError } = await supabase
    .from('saved_tips')
    .select('id')
    .eq('user_id', userId)
    .eq('tip_id', tipId)
    .maybeSingle();
    
  if (existingError) {
    console.error('Error checking if tip is already saved:', existingError);
  } else if (existingData) {
    throw new Error('Tip already saved');
  }
  
  // Insert into saved_tips table
  const { data, error } = await supabase
    .from('saved_tips')
    .insert([
      {
        user_id: userId,
        tip_id: tipId,
        created_at: new Date().toISOString(),
      }
    ])
    .select()
    .single();
    
  if (error) {
    console.error('Error saving tip:', error);
    throw error;
  }
  
  return {
    ...data,
    tip: tip
  } as SavedTip;
};

/**
 * Get all saved tips for a user
 * @param userId User ID
 * @returns Array of saved tips
 */
export const getSavedTips = async (userId: string): Promise<SavedTip[]> => {
  if (USE_MOCK_API) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Return mock saved tips
    return mockSavedTips[userId] || [];
  }
  
  // In a real app, query saved_tips and join with tips
  const { data, error } = await supabase
    .from('saved_tips')
    .select(`
      *,
      tip:tips(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching saved tips:', error);
    throw error;
  }
  
  return data as SavedTip[];
};

/**
 * Delete a saved tip
 * @param userId User ID
 * @param savedTipId Saved tip ID to delete
 */
export const deleteSavedTip = async (userId: string, savedTipId: string): Promise<void> => {
  if (USE_MOCK_API) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Filter out the saved tip with the given ID
    if (mockSavedTips[userId]) {
      mockSavedTips[userId] = mockSavedTips[userId].filter(
        tip => tip.id !== savedTipId
      );
    }
    return;
  }
  
  // In a real app, delete from saved_tips table
  const { error } = await supabase
    .from('saved_tips')
    .delete()
    .eq('id', savedTipId)
    .eq('user_id', userId);
    
  if (error) {
    console.error('Error deleting saved tip:', error);
    throw error;
  }
}; 