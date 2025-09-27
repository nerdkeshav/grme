export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  is_premium?: boolean;
}

export interface Profile {
  id: string;
  user_id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  is_admin?: boolean;
  is_premium?: boolean;
}

export interface FaceRatingEntry {
  id: string;
  user_id: string;
  date: string;
  categories: Record<string, number>;
  overall_score: number;
  front_image_url?: string;
  left_profile_image_url?: string;
  right_profile_image_url?: string;
  left_quarter_image_url?: string;
  right_quarter_image_url?: string;
  feedback?: string;
}

export interface FacialFeature {
  name: string;
  score: number;
  description: string;
  improvements: string[];
}

export interface FacialAnalysis {
  id: string;
  user_id: string;
  created_at: string;
  overall_score: number;
  features: FacialFeature[];
  images: string[];
  // Include any other properties used in the app
}

export interface ProgressEntry {
  id: string;
  user_id: string;
  date: string;
  score?: number | null;
  image_url: string | null;
  notes?: string | null;
}

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  name?: string;
  description: string;
  frequency: string;
  target_frequency?: string;
  is_active: boolean;
  category?: string;
  icon?: string;
  created_at: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  completed_at: string;
  notes?: string;
}

export interface Tip {
  id: string;
  title: string;
  description: string;
  content?: string;
  category: string;
  image_url?: string;
  imageUrl?: string;
  created_at?: string;
}

export interface SavedTip {
  id: string;
  user_id: string;
  tip_id: string;
  created_at: string;
  tip: Tip;
}

export interface PersonalRoutineItem {
  id: string;
  order: number;
  title: string;
  description: string;
  duration: string; // e.g., "5 minutes"
  category: string;
  completed?: boolean;
}

export interface PersonalRoutine {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  items: PersonalRoutineItem[];
}

export interface Subscription {
  id: string;
  user_id: string;
  status: 'active' | 'canceled' | 'past_due';
  tier: 'free' | 'premium';
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface BadgePreferences {
  id: string;
  user_id: string;
  badge_visible: boolean;
  badge_color: 'green' | 'red';
  created_at: string;
  updated_at: string;
} 
