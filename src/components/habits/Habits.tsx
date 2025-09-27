import React, { useState, useEffect } from 'react';
import AppLayout from '../layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { getUserHabits, createHabit, completeHabit, deleteHabit } from '../../api/habitService';
import { Habit as HabitType, HabitCompletion } from '../../types/supabase';
import { supabase } from '../../utils/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

interface HabitWithStreak extends HabitType {
  streak: number;
  completedToday: boolean;
}

const Habits: React.FC = () => {
  const { user } = useAuth();
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHabit, setNewHabit] = useState({
    name: '',
    description: '',
    frequency: 'daily',
    category: 'skincare'
  });
  
  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  useEffect(() => {
    if (!user) return;
    
    const fetchHabitsData = async () => {
      setLoading(true);
      try {
        // Fetch habits from Supabase
        const habitsData = await getUserHabits(user.id);
        
        // Fetch today's completions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: completions, error: completionsError } = await supabase
          .from('habit_completions')
          .select('habit_id, completed_at')
          .eq('user_id', user.id)
          .gte('completed_at', today.toISOString());
          
        if (completionsError) throw completionsError;
        
        // Create a map of habit IDs to completion status
        const completedHabits = (completions || []).reduce((map: Record<string, boolean>, item: { habit_id: string }) => {
          map[item.habit_id] = true;
          return map;
        }, {});
        
        // Calculate streaks
        const { data: streaksData, error: streaksError } = await supabase
          .from('habit_completions')
          .select('habit_id, completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false });
          
        if (streaksError) throw streaksError;
        
        // Calculate streak for each habit
        const streaks: Record<string, number> = {};
        habitsData.forEach(habit => {
          streaks[habit.id] = calculateStreak(habit.id, streaksData || []);
        });
        
        // Combine data
        const formattedHabits: HabitWithStreak[] = habitsData.map(habit => ({
          ...habit,
          streak: streaks[habit.id] || 0,
          completedToday: !!completedHabits[habit.id],
          name: habit.title || '', // Map title to name for compatibility
          category: habit.category || 'skincare'
        }));
        
        setHabits(formattedHabits);
      } catch (error) {
        console.error("Error fetching habits:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHabitsData();
    
    // Set up realtime subscription with improved error handling
    let habitSubscription: RealtimeChannel | null = null;
    try {
      habitSubscription = supabase
        .channel('habits-changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${user.id}` },
          () => {
            console.log('Habit change detected, refreshing data...');
            fetchHabitsData();
          }
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'habit_completions', filter: `user_id=eq.${user.id}` },
          () => {
            console.log('Habit completion change detected, refreshing data...');
            fetchHabitsData();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to habits changes');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Error subscribing to habits changes');
          }
        });
    } catch (err) {
      console.error('Error setting up realtime subscription:', err);
      // Continue without realtime updates if subscription fails
    }
      
    return () => {
      // Clean up subscription
      if (habitSubscription) {
        try {
          supabase.removeChannel(habitSubscription);
        } catch (err) {
          console.error('Error removing channel:', err);
        }
      }
    };
  }, [user]);
  
  // Helper function to calculate streak for a habit
  const calculateStreak = (habitId: string, completions: any[]): number => {
    const habitCompletions = completions
      .filter(c => c.habit_id === habitId)
      .map(c => {
        const date = new Date(c.completed_at);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
      .sort((a, b) => b - a); // Sort descending
    
    if (habitCompletions.length === 0) return 0;
    
    let streak = 1;
    let currentDate = habitCompletions[0];
    
    for (let i = 1; i < habitCompletions.length; i++) {
      const prevDate = currentDate;
      currentDate = habitCompletions[i];
      
      // Check if dates are consecutive
      if (prevDate - currentDate === 86400000) { // 24 hours in milliseconds
        streak++;
      } else if (prevDate !== currentDate) {
        // Break streak if not consecutive and not the same day
        break;
      }
    }
    
    return streak;
  };
  
  const toggleHabitCompletion = async (habitId: string) => {
    if (!user) return;
    
    try {
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return;
      
      if (habit.completedToday) {
        // Unmark completion (delete today's completion record)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('user_id', user.id)
          .gte('completed_at', today.toISOString());
          
        // Update local state
        setHabits(prevHabits => 
          prevHabits.map(h => 
            h.id === habitId 
              ? {...h, completedToday: false, streak: Math.max(0, h.streak - 1)}
              : h
          )
        );
      } else {
        // Mark as completed
        await completeHabit(habitId, user.id);
        
        // Update local state
    setHabits(prevHabits => 
          prevHabits.map(h => 
            h.id === habitId 
              ? {...h, completedToday: true, streak: h.streak + 1}
              : h
          )
        );
      }
    } catch (error) {
      console.error("Error toggling habit completion:", error);
    }
  };
  
  const handleAddHabit = async () => {
    if (!user) return;
    
    try {
      const habitData = {
        user_id: user.id,
        title: newHabit.name,
      name: newHabit.name,
      description: newHabit.description,
        frequency: newHabit.frequency,
        target_frequency: newHabit.frequency === 'daily' ? 'Daily' : 'Weekly',
        category: newHabit.category,
        is_active: true
      };
      
      const createdHabit = await createHabit(habitData);
      
      // Add to local state
      setHabits(prev => [{
        ...createdHabit, 
        streak: 0,
        completedToday: false,
        name: createdHabit.title || '',
        category: createdHabit.category || 'skincare'
      }, ...prev]);
    
    // Reset form
    setNewHabit({
      name: '',
      description: '',
      frequency: 'daily',
      category: 'skincare'
    });
    setShowAddForm(false);
    } catch (error) {
      console.error("Error adding habit:", error);
    }
  };
  
  // Filter habits by category
  const filteredHabits = filterCategory === 'all' 
    ? habits 
    : habits.filter(habit => habit.category === filterCategory);
  
  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Habits Tracker</h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors duration-300"
          >
            Add New Habit
          </button>
        </div>
        
        {/* Category filter */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1 rounded-full text-sm transition-colors duration-300 ${
                filterCategory === 'all' 
                  ? 'bg-accent text-white' 
                  : 'bg-surface hover:bg-hover text-muted'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterCategory('skincare')}
              className={`px-3 py-1 rounded-full text-sm transition-colors duration-300 ${
                filterCategory === 'skincare' 
                  ? 'bg-accent text-white' 
                  : 'bg-surface hover:bg-hover text-muted'
              }`}
            >
              Skincare
            </button>
            <button
              onClick={() => setFilterCategory('exercise')}
              className={`px-3 py-1 rounded-full text-sm transition-colors duration-300 ${
                filterCategory === 'exercise' 
                  ? 'bg-accent text-white' 
                  : 'bg-surface hover:bg-hover text-muted'
              }`}
            >
              Exercise
            </button>
            <button
              onClick={() => setFilterCategory('nutrition')}
              className={`px-3 py-1 rounded-full text-sm transition-colors duration-300 ${
                filterCategory === 'nutrition' 
                  ? 'bg-accent text-white' 
                  : 'bg-surface hover:bg-hover text-muted'
              }`}
            >
              Nutrition
            </button>
            <button
              onClick={() => setFilterCategory('lifestyle')}
              className={`px-3 py-1 rounded-full text-sm transition-colors duration-300 ${
                filterCategory === 'lifestyle' 
                  ? 'bg-accent text-white' 
                  : 'bg-surface hover:bg-hover text-muted'
              }`}
            >
              Lifestyle
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-60">
            <div className="relative flex flex-col items-center">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-accent"></div>
              <p className="mt-3 text-accent animate-pulse">Loading habits...</p>
            </div>
          </div>
        ) : filteredHabits.length === 0 ? (
          <div className="text-center py-10 bg-surface rounded-lg">
            <p className="text-muted mb-4">No habits found in this category.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="text-accent hover:underline"
            >
              Add your first habit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHabits.map(habit => (
              <div 
                key={habit.id}
                className={`border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
                  habit.completedToday 
                    ? 'border-green-500 bg-green-900/10'
                    : 'border-border bg-surface'
                }`}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">{habit.name}</h3>
                      <p className="text-sm text-muted">{habit.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded capitalize ${
                      habit.category === 'skincare' ? 'bg-blue-900/20 text-blue-400' :
                      habit.category === 'exercise' ? 'bg-amber-900/20 text-amber-400' :
                      habit.category === 'nutrition' ? 'bg-green-900/20 text-green-400' :
                      'bg-purple-900/20 text-purple-400'
                    }`}>
                      {habit.category}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-6">
                    <div>
                      <div className="flex items-center space-x-1">
                        <span className="text-accent text-lg font-bold">{habit.streak}</span>
                        <span className="text-xs text-muted">day streak</span>
                      </div>
                      <div className="text-xs text-muted">
                        {habit.frequency === 'daily' ? 'Daily' : 'Weekly'} habit
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleHabitCompletion(habit.id)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        habit.completedToday
                          ? 'bg-green-500 text-white'
                          : 'bg-surface border border-accent text-accent hover:bg-hover'
                      } transition-all duration-300`}
                    >
                      {habit.completedToday ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Add Habit Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-lg shadow-xl w-full max-w-md p-6">
              <h2 className="text-xl font-bold mb-4">Add New Habit</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">
                    Habit Name
                  </label>
                  <input
                    type="text"
                    value={newHabit.name}
                    onChange={(e) => setNewHabit({...newHabit, name: e.target.value})}
                    className="w-full px-4 py-2 bg-surface border border-border rounded-md focus:outline-none focus:border-accent"
                    placeholder="e.g. Morning Facial Exercises"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">
                    Description
                  </label>
                  <textarea
                    value={newHabit.description}
                    onChange={(e) => setNewHabit({...newHabit, description: e.target.value})}
                    className="w-full px-4 py-2 bg-surface border border-border rounded-md focus:outline-none focus:border-accent"
                    placeholder="Describe your habit..."
                    rows={3}
                  ></textarea>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">
                      Frequency
                    </label>
                    <select
                      value={newHabit.frequency}
                      onChange={(e) => setNewHabit({...newHabit, frequency: e.target.value})}
                      className="w-full px-4 py-2 bg-surface border border-border rounded-md focus:outline-none focus:border-accent"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">
                      Category
                    </label>
                    <select
                      value={newHabit.category}
                      onChange={(e) => setNewHabit({...newHabit, category: e.target.value})}
                      className="w-full px-4 py-2 bg-surface border border-border rounded-md focus:outline-none focus:border-accent"
                    >
                      <option value="skincare">Skincare</option>
                      <option value="exercise">Exercise</option>
                      <option value="nutrition">Nutrition</option>
                      <option value="lifestyle">Lifestyle</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-border rounded-md hover:bg-hover transition-colors duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddHabit}
                  disabled={!newHabit.name}
                  className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors duration-300 disabled:opacity-50"
                >
                  Add Habit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Habits; 