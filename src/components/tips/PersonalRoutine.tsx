import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PersonalRoutine as PersonalRoutineType, PersonalRoutineItem } from '../../types/supabase';
import { 
  getUserRoutines, 
  createRoutine, 
  deleteRoutine,
  updateRoutine,
  generateAIRoutine
} from '../../api/routineService';

const PersonalRoutineComponent: React.FC = () => {
  const { user, profile } = useAuth();
  const [routines, setRoutines] = useState<PersonalRoutineType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // State for creating new routine
  const [isCreating, setIsCreating] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  
  // State for viewing routine details
  const [selectedRoutine, setSelectedRoutine] = useState<PersonalRoutineType | null>(null);
  
  // Focus areas that users can select for routine generation
  const focusAreas = [
    'Skincare',
    'Jawline',
    'Eyes',
    'Posture',
    'Haircare',
    'Facial Structure',
    'Fitness',
    'Nutrition',
    'Sleep'
  ];

  useEffect(() => {
    fetchRoutines();
  }, [user]);

  const fetchRoutines = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      const userRoutines = await getUserRoutines(user.id);
      setRoutines(userRoutines);
    } catch (err: any) {
      console.error('Error fetching routines:', err);
      setError(err.message || 'Failed to load routines');
    } finally {
      setLoading(false);
    }
  };

  const handleAreaToggle = (area: string) => {
    if (selectedAreas.includes(area)) {
      setSelectedAreas(selectedAreas.filter(a => a !== area));
    } else {
      setSelectedAreas([...selectedAreas, area]);
    }
  };

  const handleGenerateRoutine = async () => {
    if (!user || selectedAreas.length === 0) return;
    
    setGenerateLoading(true);
    setError('');
    
    try {
      // Generate a routine based on selected areas
      const generatedRoutine = await generateAIRoutine(user.id, selectedAreas);
      
      // Create the routine in the database
      await createRoutine(user.id, {
        name: generatedRoutine.name,
        description: generatedRoutine.description
      }, generatedRoutine.items);
      
      // Refresh routines
      await fetchRoutines();
      
      // Reset UI state
      setSuccess('Personal routine created successfully!');
      setIsCreating(false);
      setSelectedAreas([]);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error generating routine:', err);
      setError(err.message || 'Failed to generate routine');
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleDeleteRoutine = async (routineId: string) => {
    if (!window.confirm('Are you sure you want to delete this routine?')) {
      return;
    }
    
    setError('');
    
    try {
      await deleteRoutine(routineId);
      
      // Refresh routines
      await fetchRoutines();
      
      // Reset UI state
      setSelectedRoutine(null);
      setSuccess('Routine deleted successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error deleting routine:', err);
      setError(err.message || 'Failed to delete routine');
    }
  };

  const handleToggleItemComplete = async (item: PersonalRoutineItem) => {
    if (!selectedRoutine) return;
    
    try {
      // Update the item's completed status locally first
      const updatedItems = selectedRoutine.items.map(i => 
        i.id === item.id ? { ...i, completed: !i.completed } : i
      );
      
      // Update the routine in state
      setSelectedRoutine({
        ...selectedRoutine,
        items: updatedItems
      });
      
      // Update the item in the database
      await updateRoutine(selectedRoutine.id, {}, [
        { ...item, completed: !item.completed }
      ]);
    } catch (err: any) {
      console.error('Error updating item:', err);
      // Revert the local state change
      setSelectedRoutine(selectedRoutine);
    }
  };

  // Check if user is premium
  if (!profile?.is_premium) {
    return (
      <div className="bg-surface rounded-lg p-7 border border-accent/20 mb-8">
        <h2 className="text-xl font-semibold mb-4">Personal Routines</h2>
        <p className="text-muted mb-6">
          Create AI-generated personalized routines tailored to your specific needs.
          This feature is available exclusively for premium users.
        </p>
        <a 
          href="/subscription" 
          className="inline-block px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90"
        >
          Upgrade to Premium
        </a>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg p-7 border border-accent/20 mb-8">
      <h2 className="text-xl font-semibold mb-4">Personal Routines</h2>
      
      {error && (
        <div className="mb-4 rounded-md bg-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 rounded-md bg-green-500/20 px-4 py-3 text-sm text-green-400">
          {success}
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-pulse flex space-x-3">
            <div className="h-3 w-3 bg-muted rounded-full"></div>
            <div className="h-3 w-3 bg-muted rounded-full"></div>
            <div className="h-3 w-3 bg-muted rounded-full"></div>
          </div>
        </div>
      ) : (
        <>
          {/* Routine list view */}
          {!isCreating && !selectedRoutine && (
            <>
              <div className="flex justify-between items-center mb-6">
                <p className="text-muted">
                  Create personalized routines tailored to your specific needs.
                </p>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
                >
                  Create New Routine
                </button>
              </div>
              
              {routines.length === 0 ? (
                <div className="text-center py-8 bg-surface/50 rounded-lg border border-border">
                  <p className="text-muted mb-4">You haven't created any personal routines yet.</p>
                  <button
                    onClick={() => setIsCreating(true)}
                    className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90"
                  >
                    Create Your First Routine
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {routines.map(routine => (
                    <div 
                      key={routine.id} 
                      className="p-5 bg-surface/50 rounded-lg border border-border hover:border-accent/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedRoutine(routine)}
                    >
                      <h3 className="text-lg font-medium mb-2">{routine.name}</h3>
                      <p className="text-muted text-sm mb-4">{routine.description}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted">
                          {routine.items.length} steps
                        </span>
                        <span className="text-xs text-muted">
                          Created: {new Date(routine.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          
          {/* Create new routine view */}
          {isCreating && (
            <div className="bg-surface/50 rounded-lg border border-border p-5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium">Create New Routine</h3>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedAreas([]);
                  }}
                  className="text-muted hover:text-text"
                >
                  Cancel
                </button>
              </div>
              
              <p className="text-muted mb-4">
                Select the areas you want to focus on in your personal routine:
              </p>
              
              <div className="flex flex-wrap gap-3 mb-6">
                {focusAreas.map(area => (
                  <button
                    key={area}
                    onClick={() => handleAreaToggle(area)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedAreas.includes(area)
                        ? 'bg-accent text-white'
                        : 'bg-hover text-text hover:bg-hover/80'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
              
              <button
                onClick={handleGenerateRoutine}
                disabled={selectedAreas.length === 0 || generateLoading}
                className="w-full px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-60"
              >
                {generateLoading ? 'Generating...' : 'Generate Personal Routine'}
              </button>
            </div>
          )}
          
          {/* Routine details view */}
          {selectedRoutine && (
            <div className="bg-surface/50 rounded-lg border border-border p-5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium">{selectedRoutine.name}</h3>
                <button
                  onClick={() => setSelectedRoutine(null)}
                  className="text-muted hover:text-text"
                >
                  Back to List
                </button>
              </div>
              
              <p className="text-muted mb-6">{selectedRoutine.description}</p>
              
              <div className="space-y-4 mb-8">
                {selectedRoutine.items.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="p-4 bg-hover rounded-lg border border-border flex items-start gap-4"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <button
                        onClick={() => handleToggleItemComplete(item)}
                        className={`w-6 h-6 rounded-full border ${
                          item.completed
                            ? 'bg-accent border-accent text-white'
                            : 'border-muted'
                        } flex items-center justify-center`}
                      >
                        {item.completed && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h4 className={`font-medium ${item.completed ? 'line-through text-muted' : ''}`}>
                          {index + 1}. {item.title}
                        </h4>
                        <span className="text-xs text-muted bg-surface px-2 py-1 rounded">
                          {item.duration}
                        </span>
                      </div>
                      <p className={`text-sm mt-1 ${item.completed ? 'line-through text-muted' : 'text-text/70'}`}>
                        {item.description}
                      </p>
                      <div className="text-xs text-muted mt-2">
                        Category: {item.category}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Actions */}
              <div className="flex justify-end">
                <button
                  onClick={() => handleDeleteRoutine(selectedRoutine.id)}
                  className="px-4 py-2 text-red-400 hover:text-red-500"
                >
                  Delete Routine
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PersonalRoutineComponent; 