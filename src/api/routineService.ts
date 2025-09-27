import { supabase } from '../utils/supabaseClient';
import { PersonalRoutine, PersonalRoutineItem } from '../types/supabase';

/**
 * Get all personal routines for a user
 */
export const getUserRoutines = async (userId: string): Promise<PersonalRoutine[]> => {
  try {
    const { data, error } = await supabase
      .from('personal_routines')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // For each routine, get the routine items
    const routinesWithItems = await Promise.all(
      data.map(async (routine: { id: string }) => {
        const { data: items, error: itemsError } = await supabase
          .from('personal_routine_items')
          .select('*')
          .eq('routine_id', routine.id)
          .order('order', { ascending: true });

        if (itemsError) {
          throw itemsError;
        }

        return {
          ...routine,
          items: items || []
        } as PersonalRoutine;
      })
    );

    return routinesWithItems;
  } catch (error) {
    console.error('Error getting user routines:', error);
    throw error;
  }
};

/**
 * Get a specific personal routine by id
 */
export const getRoutineById = async (routineId: string): Promise<PersonalRoutine> => {
  try {
    const { data, error } = await supabase
      .from('personal_routines')
      .select('*')
      .eq('id', routineId)
      .single();

    if (error) {
      throw error;
    }

    // Get the routine items
    const { data: items, error: itemsError } = await supabase
      .from('personal_routine_items')
      .select('*')
      .eq('routine_id', routineId)
      .order('order', { ascending: true });

    if (itemsError) {
      throw itemsError;
    }

    return {
      ...data,
      items: items || []
    } as PersonalRoutine;
  } catch (error) {
    console.error('Error getting routine:', error);
    throw error;
  }
};

/**
 * Create a new personal routine
 */
export const createRoutine = async (
  userId: string,
  routineData: { name: string; description: string },
  items: Omit<PersonalRoutineItem, 'id' | 'routine_id'>[]
): Promise<PersonalRoutine> => {
  try {
    // Create the routine
    const { data, error } = await supabase
      .from('personal_routines')
      .insert([
        {
          user_id: userId,
          name: routineData.name,
          description: routineData.description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Create the routine items
    const routineItems = items.map((item, index) => ({
      routine_id: data.id,
      order: index,
      title: item.title,
      description: item.description,
      duration: item.duration,
      category: item.category,
      completed: false
    }));

    const { data: itemsData, error: itemsError } = await supabase
      .from('personal_routine_items')
      .insert(routineItems)
      .select();

    if (itemsError) {
      throw itemsError;
    }

    return {
      ...data,
      items: itemsData || []
    } as PersonalRoutine;
  } catch (error) {
    console.error('Error creating routine:', error);
    throw error;
  }
};

/**
 * Update an existing personal routine
 */
export const updateRoutine = async (
  routineId: string,
  routineData: { name?: string; description?: string },
  items?: Partial<PersonalRoutineItem>[]
): Promise<PersonalRoutine> => {
  try {
    // Update the routine
    const { data, error } = await supabase
      .from('personal_routines')
      .update({
        ...routineData,
        updated_at: new Date().toISOString()
      })
      .eq('id', routineId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // If items are provided, update them
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.id) {
          // Update existing item
          const { error: itemError } = await supabase
            .from('personal_routine_items')
            .update({
              title: item.title,
              description: item.description,
              duration: item.duration,
              category: item.category,
              completed: item.completed,
              order: item.order
            })
            .eq('id', item.id);

          if (itemError) {
            throw itemError;
          }
        }
      }
    }

    // Get the updated routine with items
    return await getRoutineById(routineId);
  } catch (error) {
    console.error('Error updating routine:', error);
    throw error;
  }
};

/**
 * Delete a personal routine
 */
export const deleteRoutine = async (routineId: string): Promise<void> => {
  try {
    // Delete routine items first (due to foreign key constraints)
    const { error: itemsError } = await supabase
      .from('personal_routine_items')
      .delete()
      .eq('routine_id', routineId);

    if (itemsError) {
      throw itemsError;
    }

    // Delete the routine
    const { error } = await supabase
      .from('personal_routines')
      .delete()
      .eq('id', routineId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error deleting routine:', error);
    throw error;
  }
};

/**
 * Generate a personal routine based on AI analysis
 */
export const generateAIRoutine = async (
  userId: string,
  focusAreas: string[]
): Promise<{
  name: string;
  description: string;
  items: Omit<PersonalRoutineItem, 'id' | 'routine_id'>[];
}> => {
  // This would ideally call an AI service
  // For now, we'll generate a simple routine based on focus areas
  
  const routineName = `Custom ${focusAreas.join(' & ')} Routine`;
  
  // Generate a description based on the focus areas
  const description = `A personalized routine focusing on ${focusAreas.join(', ')}, created to help you achieve the best results based on your unique features.`;
  
  // Generate routine items based on focus areas
  const items: Omit<PersonalRoutineItem, 'id' | 'routine_id'>[] = [];
  
  // Add morning routine items
  items.push({
    order: 0,
    title: 'Morning Cleansing',
    description: 'Start your day with a gentle facial cleanser to remove overnight oil buildup.',
    duration: '2 minutes',
    category: 'Skincare',
    completed: false
  });
  
  // Add focus area specific items
  if (focusAreas.includes('Skincare')) {
    items.push({
      order: items.length,
      title: 'Vitamin C Serum',
      description: 'Apply vitamin C serum to brighten skin and protect from environmental damage.',
      duration: '1 minute',
      category: 'Skincare',
      completed: false
    });
    
    items.push({
      order: items.length,
      title: 'Moisturize',
      description: 'Apply a light moisturizer suitable for your skin type.',
      duration: '1 minute',
      category: 'Skincare',
      completed: false
    });
  }
  
  if (focusAreas.includes('Jawline')) {
    items.push({
      order: items.length,
      title: 'Jawline Exercises',
      description: 'Perform 10 jawline clenches and 10 neck rolls to strengthen muscles.',
      duration: '5 minutes',
      category: 'Facial Exercise',
      completed: false
    });
  }
  
  if (focusAreas.includes('Eyes')) {
    items.push({
      order: items.length,
      title: 'Eye Area Treatment',
      description: 'Apply eye cream with gentle tapping motions to reduce puffiness and dark circles.',
      duration: '2 minutes',
      category: 'Skincare',
      completed: false
    });
  }
  
  if (focusAreas.includes('Posture')) {
    items.push({
      order: items.length,
      title: 'Posture Correction',
      description: 'Stand against a wall with shoulders and head touching, hold for 1 minute.',
      duration: '3 minutes',
      category: 'Posture',
      completed: false
    });
  }
  
  // Add evening routine items
  items.push({
    order: items.length,
    title: 'Evening Cleansing',
    description: 'Thoroughly cleanse face to remove makeup, dirt, and pollution from the day.',
    duration: '3 minutes',
    category: 'Skincare',
    completed: false
  });
  
  // Add final items based on focus areas
  if (focusAreas.includes('Skincare')) {
    items.push({
      order: items.length,
      title: 'Night Treatment',
      description: 'Apply retinol or night repair cream to promote cell turnover while sleeping.',
      duration: '1 minute',
      category: 'Skincare',
      completed: false
    });
  }
  
  return {
    name: routineName,
    description,
    items
  };
}; 