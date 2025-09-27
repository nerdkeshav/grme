import { supabase } from '../utils/supabaseClient';
import { Habit, HabitCompletion } from '../types/supabase';

/**
 * Fetches all habits for a user
 * @param userId User ID to fetch habits for
 * @returns Array of user habits
 */
export const getUserHabits = async (userId: string): Promise<Habit[]> => {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching habits:', error);
    throw error;
  }
  
  return data as Habit[];
};

/**
 * Creates a new habit for a user
 * @param habit Habit data to create
 * @returns The created habit
 */
export const createHabit = async (habit: Omit<Habit, 'id' | 'created_at'>): Promise<Habit> => {
  // Map name to title and target_frequency to frequency for compatibility
  const habitData = {
    ...habit,
    title: habit.name || habit.title, // Use name or fallback to title
    frequency: habit.target_frequency?.toLowerCase().includes('daily') ? 'daily' : 'weekly',
    is_active: true, // Default to active
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('habits')
    .insert([habitData])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating habit:', error);
    throw error;
  }
  
  return data as Habit;
};

/**
 * Updates an existing habit
 * @param habitId ID of the habit to update
 * @param userId User ID who owns the habit
 * @param updates Fields to update
 * @returns The updated habit
 */
export const updateHabit = async (
  habitId: string,
  userId: string,
  updates: Partial<Omit<Habit, 'id' | 'user_id' | 'created_at'>>
): Promise<Habit> => {
  const { data, error } = await supabase
    .from('habits')
    .update(updates)
    .eq('id', habitId)
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating habit:', error);
    throw error;
  }
  
  return data as Habit;
};

/**
 * Deletes a habit
 * @param habitId ID of the habit to delete
 * @param userId User ID who owns the habit
 */
export const deleteHabit = async (habitId: string, userId: string): Promise<void> => {
  // First delete all completions
  const { error: completionsError } = await supabase
    .from('habit_completions')
    .delete()
    .eq('habit_id', habitId)
    .eq('user_id', userId);
  
  if (completionsError) {
    console.error('Error deleting habit completions:', completionsError);
    // Continue with habit deletion even if completions deletion fails
  }
  
  // Delete the habit
  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', habitId)
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error deleting habit:', error);
    throw error;
  }
};

/**
 * Marks a habit as completed for today
 * @param habitId ID of the habit to mark as completed
 * @param userId User ID who owns the habit
 * @returns The created habit completion
 */
export const completeHabit = async (habitId: string, userId: string): Promise<HabitCompletion> => {
  // First check if the habit has already been completed today
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of day
  
  const { data: existingCompletions, error: checkError } = await supabase
    .from('habit_completions')
    .select('id, completed_at')
    .eq('habit_id', habitId)
    .eq('user_id', userId)
    .gte('completed_at', today.toISOString());
  
  if (checkError) {
    console.error('Error checking habit completion:', checkError);
    throw checkError;
  }
  
  // If habit has already been completed today, throw an error
  if (existingCompletions && existingCompletions.length > 0) {
    throw new Error('This habit has already been completed today');
  }
  
  // Create new completion record
  const { data, error } = await supabase
    .from('habit_completions')
    .insert([{
      habit_id: habitId,
      user_id: userId,
      completed_at: new Date().toISOString(),
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error completing habit:', error);
    throw error;
  }
  
  return data as HabitCompletion;
};

/**
 * Gets a user's habit completion streak
 * @param habitId ID of the habit to check
 * @param userId User ID who owns the habit
 * @returns Number of days in the current streak
 */
export const getHabitStreak = async (habitId: string, userId: string): Promise<number> => {
  // Get all completions for this habit, ordered by date
  const { data, error } = await supabase
    .from('habit_completions')
    .select('completed_at')
    .eq('habit_id', habitId)
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching habit completions:', error);
    throw error;
  }
  
  if (!data || data.length === 0) {
    return 0;
  }
  
  // Calculate streak
  let streak = 1;
  let currentDate = new Date(data[0].completed_at);
  currentDate.setHours(0, 0, 0, 0); // Normalize to start of day
  
  for (let i = 1; i < data.length; i++) {
    const completionDate = new Date(data[i].completed_at);
    completionDate.setHours(0, 0, 0, 0); // Normalize to start of day
    
    // Calculate the difference in days
    const diffTime = currentDate.getTime() - completionDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Consecutive day
      streak++;
      currentDate = completionDate;
    } else if (diffDays === 0) {
      // Same day, continue
      continue;
    } else {
      // Streak broken
      break;
    }
  }
  
  return streak;
};

/**
 * Gets default habits for new users
 * @param userId User ID to create habits for
 * @returns Array of created default habits
 */
export const createDefaultHabits = async (userId: string): Promise<Habit[]> => {
  const defaultHabits = [
    {
      user_id: userId,
      name: 'Skincare Routine',
      description: 'Daily skincare routine for better complexion',
      target_frequency: 'Daily',
      icon: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
      created_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      name: 'Mewing Practice',
      description: 'Proper tongue posture for jawline definition',
      target_frequency: 'Daily',
      icon: 'M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z',
      created_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      name: 'Jawline Exercises',
      description: 'Exercises to strengthen jawline muscles',
      target_frequency: '3x/week',
      icon: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z',
      created_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      name: 'Posture Training',
      description: 'Maintain good posture for better appearance',
      target_frequency: 'Daily',
      icon: 'M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3',
      created_at: new Date().toISOString(),
    },
  ];
  
  const { data, error } = await supabase
    .from('habits')
    .insert(defaultHabits)
    .select();
  
  if (error) {
    console.error('Error creating default habits:', error);
    throw error;
  }
  
  return data as Habit[];
};

/**
 * Fetch all habits completed today for a user
 * @param userId User ID to fetch completions for
 * @returns A record of habit IDs that have been completed today
 */
export const fetchTodayCompletions = async (userId: string): Promise<Record<string, boolean>> => {
  // Get today's date (start of day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data, error } = await supabase
    .from('habit_completions')
    .select('habit_id')
    .eq('user_id', userId)
    .gte('completed_at', today.toISOString());
  
  if (error) {
    console.error('Error fetching today\'s habit completions:', error);
    throw error;
  }
  
  // Convert array of completions to a record
  const completions: Record<string, boolean> = {};
  data.forEach((completion: { habit_id: string }) => {
    completions[completion.habit_id] = true;
  });
  
  return completions;
}; 