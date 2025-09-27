import { supabase, STORAGE_BUCKETS } from '../utils/supabaseClient';
import { compressImage, dataURLtoFile, generateUniqueFilename } from '../utils/imageCompression';
import { ProgressEntry } from '../types/supabase';

// Flag for using mock API in development
const USE_MOCK_API = false;

// Mock progress entries for development
let mockProgressEntries: Record<string, ProgressEntry[]> = {};

/**
 * Uploads a progress image and records a progress entry
 * @param image Image file or data URL
 * @param userId Current user's ID
 * @param score Progress score (optional)
 * @param notes Additional notes (optional)
 * @returns The created progress entry
 */
export const addProgressEntry = async (
  image: File | string | null,
  userId: string,
  score?: number,
  notes?: string
): Promise<ProgressEntry> => {
  if (USE_MOCK_API) {
    console.log('Using mock addProgressEntry');
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let imageUrl: string | null = null;
    if (image) {
      // Create a fake image URL
      imageUrl = `https://mock-storage.example.com/${userId}/progress_${Date.now()}.jpg`;
    }
    
    // Create a new progress entry with a random ID
    const newEntry: ProgressEntry = {
      id: `progress_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      user_id: userId,
      date: new Date().toISOString(),
      score: score ?? null,
      image_url: imageUrl,
      notes: notes ?? null,
    };
    
    // Add to mock storage
    if (!mockProgressEntries[userId]) {
      mockProgressEntries[userId] = [];
    }
    mockProgressEntries[userId] = [newEntry, ...mockProgressEntries[userId]];
    
    return newEntry;
  }
  
  let imageUrl: string | null = null;
  
  // Upload image if provided
  if (image) {
    try {
      let fileToUpload: File;
      
      // Convert to File if it's a base64 string (from webcam)
      if (typeof image === 'string') {
        fileToUpload = dataURLtoFile(
          image, 
          generateUniqueFilename(userId, 'progress_')
        );
      } else {
        fileToUpload = image;
      }
      
      // Compress the image
      const compressedFile = await compressImage(fileToUpload);
      
      // Generate unique filename
      const filename = generateUniqueFilename(userId, 'progress_');
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.PROGRESS_IMAGES)
        .upload(`${userId}/${filename}`, compressedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`Error uploading image: ${error.message}`);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKETS.PROGRESS_IMAGES)
        .getPublicUrl(`${userId}/${filename}`);

      imageUrl = publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }
  
  // Create progress entry
  const entry = {
    user_id: userId,
    date: new Date().toISOString(),
    score: score || null,
    image_url: imageUrl,
    notes: notes || null,
  };
  
  const { data, error } = await supabase
    .from('progress_entries')
    .insert([entry])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating progress entry:', error);
    throw error;
  }
  
  return data as ProgressEntry;
};

/**
 * Gets all progress entries for a user
 * @param userId User ID to fetch progress for
 * @returns Array of progress entries
 */
export const getProgressEntries = async (userId: string): Promise<ProgressEntry[]> => {
  if (USE_MOCK_API) {
    console.log('Using mock getProgressEntries');
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Return mock entries from storage
    return mockProgressEntries[userId] || [];
  }
  
  const { data, error } = await supabase
    .from('progress_entries')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Error fetching progress entries:', error);
    throw error;
  }
  
  return data as ProgressEntry[];
};

/**
 * Deletes a progress entry and its associated image
 * @param entryId Entry ID to delete
 * @param userId User ID who owns the entry
 */
export const deleteProgressEntry = async (entryId: string, userId: string): Promise<void> => {
  if (USE_MOCK_API) {
    console.log('Using mock deleteProgressEntry');
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Filter out the entry with the given ID
    if (mockProgressEntries[userId]) {
      mockProgressEntries[userId] = mockProgressEntries[userId].filter(
        entry => entry.id !== entryId
      );
    }
    return;
  }
  
  // First get the entry to find the image URL
  const { data, error } = await supabase
    .from('progress_entries')
    .select('image_url')
    .eq('id', entryId)
    .eq('user_id', userId)
    .single();
  
  if (error) {
    console.error('Error finding progress entry:', error);
    throw error;
  }
  
  // Delete the image if it exists
  if (data?.image_url) {
    // Extract the path from the URL
    const url = new URL(data.image_url);
    const path = url.pathname.split('/').slice(2).join('/'); // Remove first parts of path (/storage/v1/object)
    
    const { error: deleteError } = await supabase.storage
      .from(STORAGE_BUCKETS.PROGRESS_IMAGES)
      .remove([path]);
      
    if (deleteError) {
      console.error('Error deleting image:', deleteError);
      // Continue with entry deletion even if image deletion fails
    }
  }
  
  // Delete the entry
  const { error: entryError } = await supabase
    .from('progress_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId);
  
  if (entryError) {
    console.error('Error deleting progress entry:', entryError);
    throw entryError;
  }
}; 