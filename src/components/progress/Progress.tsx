import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getProgressEntries, addProgressEntry, deleteProgressEntry } from '../../api/progressService';
import { ProgressEntry } from '../../types/supabase';
import Webcam from 'react-webcam';
import AppLayout from '../layout/AppLayout';
import { validateImageFile } from '../../utils/imageCompression';

const Progress: React.FC = () => {
  const { user } = useAuth();
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showWebcam, setShowWebcam] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<Webcam>(null);

  // Memoize the fetch function to avoid recreating it on every render
  const fetchProgressEntries = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const entries = await getProgressEntries(user.id);
      setProgressEntries(entries);
    } catch (err: any) {
      console.error('Error fetching progress entries:', err);
      setError(err.message || 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProgressEntries();
    }
  }, [user, fetchProgressEntries]);

  // Simulate progress during processing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (processing) {
      setProcessingProgress(0);
      interval = setInterval(() => {
        setProcessingProgress(prev => {
          // Increase progress by 5-15% each time, slowing down as we approach 100%
          const increment = Math.max(5, Math.floor(20 * (1 - prev / 100)));
          // Cap at 95% - the final jump to 100% happens when processing is complete
          return Math.min(95, prev + increment);
        });
      }, 300);
    } else if (processingProgress > 0 && processingProgress < 100) {
      // When processing is complete, jump to 100%
      setProcessingProgress(100);
      // Reset progress after animation completes
      setTimeout(() => setProcessingProgress(0), 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size and type
      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      
      setError(''); // Clear any previous errors
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleCapturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setPreviewUrl(imageSrc);
        setSelectedFile(null);
        setShowWebcam(false);
        setError(''); // Clear any previous errors
      }
    }
  };

  const handleAddEntry = async () => {
    if (!user) return;
    
    if (!selectedFile && !previewUrl) {
      setError('Please select or capture an image');
      return;
    }

    setError('');
    setAdding(true);
    setProcessing(true);

    try {
      const image = selectedFile || previewUrl;
      const entry = await addProgressEntry(image, user.id, undefined, notes);
      
      // Add the new entry to the list and sort
      setProgressEntries([entry, ...progressEntries]);
      
      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setNotes('');
    } catch (err: any) {
      console.error('Error adding progress entry:', err);
      setError(err.message || 'Failed to add progress entry');
    } finally {
      setAdding(false);
      setProcessing(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    
    const confirmDelete = window.confirm('Are you sure you want to delete this progress entry?');
    if (!confirmDelete) return;

    try {
      await deleteProgressEntry(entryId, user.id);
      // Remove the deleted entry from the list
      setProgressEntries(progressEntries.filter(entry => entry.id !== entryId));
    } catch (err: any) {
      console.error('Error deleting progress entry:', err);
      setError(err.message || 'Failed to delete progress entry');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Render the processing animation
  const renderProcessingAnimation = () => {
    if (processingProgress <= 0) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm transition-opacity"
           style={{ opacity: processingProgress < 100 ? 1 : 0 }}>
        <div className="bg-surface p-8 rounded-xl shadow-2xl max-w-md w-full">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold mb-2">Processing Image</h3>
            <p className="text-muted text-sm">
              {processingProgress < 95 
                ? "Compressing and saving your image..."
                : "Almost done!"}
            </p>
          </div>
          
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-accent to-accent transition-all duration-300 ease-out"
              style={{ width: `${processingProgress}%` }}
            ></div>
          </div>
          
          <div className="mt-2 text-right text-sm text-muted">
            {processingProgress}%
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      {renderProcessingAnimation()}
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">Progress Tracking</h1>
        <p className="mt-2 text-text/70">
          Track your appearance improvements over time by adding regular progress photos.
        </p>

        {error && (
          <div className="mt-4 rounded-md bg-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Add new entry form */}
        <div className="mt-6 rounded-lg bg-surface p-6 shadow-lg">
          <h2 className="text-xl font-semibold">Add New Progress Entry</h2>
          
          {showWebcam ? (
            <div className="mt-4 flex flex-col items-center">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="rounded-lg overflow-hidden max-w-full h-auto"
              />
              <div className="mt-4 flex space-x-4">
                <button
                  onClick={handleCapturePhoto}
                  className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary/90"
                >
                  Capture Photo
                </button>
                <button
                  onClick={() => setShowWebcam(false)}
                  className="rounded-md bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md bg-surface border border-gray-700 px-4 py-2 text-text hover:bg-gray-800"
                >
                  Upload Photo
                </button>
                <button
                  onClick={() => setShowWebcam(true)}
                  className="rounded-md bg-surface border border-gray-700 px-4 py-2 text-text hover:bg-gray-800"
                >
                  Take Photo
                </button>
                <div className="text-xs text-muted self-center">
                  Max file size: 5MB
                </div>
              </div>
              
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
              />

              {previewUrl && (
                <div className="mt-4">
                  <div className="w-full max-w-md mx-auto">
                    <div className="aspect-square w-full max-w-md overflow-hidden bg-gray-900 rounded-lg">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-4">
                <label htmlFor="notes" className="block text-sm font-medium text-text/80">
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 px-3 py-2 text-text focus:border-primary focus:ring-primary sm:text-sm"
                  placeholder="Add any notes about changes or improvements you've noticed..."
                />
              </div>
              
              <div className="mt-4">
                <button
                  onClick={handleAddEntry}
                  disabled={adding || (!selectedFile && !previewUrl)}
                  className="rounded-md bg-primary px-6 py-2 text-white hover:bg-primary/90 disabled:opacity-70"
                >
                  {adding ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </div>
                  ) : 'Save Progress Entry'}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Progress timeline */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold">Your Progress Timeline</h2>
          
          {loading ? (
            <div className="mt-4 text-center text-text/70">Loading progress data...</div>
          ) : progressEntries.length === 0 ? (
            <div className="mt-4 text-center text-text/70">No progress entries yet. Add your first one above!</div>
          ) : (
            <div className="mt-4 space-y-6">
              {progressEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg bg-surface p-6 shadow-lg">
                  <div className="flex justify-between items-start">
                    <div className="text-lg font-medium">{formatDate(entry.date)}</div>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                  
                  {entry.image_url && (
                    <div className="mt-4 mx-auto">
                      <div className="aspect-square w-full max-w-md mx-auto overflow-hidden bg-gray-900 rounded-lg">
                        <img 
                          src={entry.image_url} 
                          alt={`Progress on ${formatDate(entry.date)}`} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Handle image loading errors
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://via.placeholder.com/400x400?text=Image+Not+Available';
                            target.onerror = null; // Prevent infinite error loop
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {entry.notes && (
                    <div className="mt-4 text-sm">
                      <h3 className="font-medium mb-1">Notes:</h3>
                      <p className="text-text/80">{entry.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Progress; 