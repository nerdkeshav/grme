import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  uploadFaceImages, 
  analyzeFace, 
  getLatestAnalysis, 
  REQUIRED_FACE_ANGLES, 
  hasAllRequiredAngles 
} from '../../api/faceRatingService';
import { FacialAnalysis } from '../../types/supabase';
import Webcam from 'react-webcam';
import AppLayout from '../layout/AppLayout';
import { validateImageFile } from '../../utils/imageCompression';
import { Navigate } from 'react-router-dom';
import html2canvas from 'html2canvas';

// Function to capture button click to download card
const handleDownloadCard = (element: HTMLElement | null, errorHandler: (message: string) => void) => {
  if (!element) {
    errorHandler("Error generating image for download");
    return;
  }

  html2canvas(element).then((canvas: HTMLCanvasElement) => {
    const imageData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imageData;
    link.download = "my-face-analysis.png";
    link.click();
  }).catch((error: unknown) => {
    console.error("Error generating image:", error);
    errorHandler("Failed to generate downloadable image");
  });
};

// Face angle helper functions
const getAngleLabel = (angle: string): string => {
  switch(angle) {
    case 'front': return 'Front view';
    case 'left_profile': return 'Left profile';
    case 'right_profile': return 'Right profile';
    case 'left_quarter': return 'Left quarter view';
    case 'right_quarter': return 'Right quarter view';
    default: return angle;
  }
};

const getAngleInstructions = (angle: string): string => {
  switch(angle) {
    case 'front':
      return 'Look directly at the camera with your face centered in the frame.';
    case 'left_profile':
      return 'Turn your head 90 degrees to the right, showing your left side.';
    case 'right_profile':
      return 'Turn your head 90 degrees to the left, showing your right side.';
    case 'left_quarter':
      return 'Turn your head 45 degrees to the right, showing part of your left side.';
    case 'right_quarter':
      return 'Turn your head 45 degrees to the left, showing part of your right side.';
    default:
      return 'Position your face according to the guide.';
  }
};

const FaceRating: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [fileAngles, setFileAngles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [analysis, setAnalysis] = useState<FacialAnalysis | null>(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<Webcam>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Webcam face capture state
  const [currentAngle, setCurrentAngle] = useState<string>('front');
  const [capturedAngles, setCapturedAngles] = useState<Record<string, string>>({});
  
  const [isPremium, setIsPremium] = useState<boolean>(false); // Track premium status
  const [showPremiumPopup, setShowPremiumPopup] = useState<boolean>(false); // Premium upgrade popup
  
  // Carousel state for mobile view
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // Touch handlers for swipe
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);
  
  // Mobile carousel slider
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  
  // Analysis sections for carousel
  const analysisSections = [
    { id: 'facial-traits', title: 'Facial Traits' },
    { id: 'feature-breakdown', title: 'Feature Breakdown' },
    { id: 'custom-routine', title: 'Custom Routine' },
    { id: 'shareable-card', title: 'Your Card' }
  ];
  
  // Check if the device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  useEffect(() => {
    let isMounted = true;
    
    // Set a timeout to prevent getting stuck in loading state
    loadingTimeoutRef.current = setTimeout(() => {
      if (isMounted && initialLoading) {
        console.warn('Loading timeout reached, forcing component to render');
        setInitialLoading(false);
      }
    }, 5000); // 5 second timeout for loading
    
    const fetchLatestAnalysis = async () => {
      if (!user || !isMounted) return;
      
      try {
        const latestAnalysis = await getLatestAnalysis(user.id);
        if (latestAnalysis && isMounted) {
          setAnalysis(latestAnalysis);
        }

        // For demo purposes, check if user has premium (in a real app this would come from Supabase)
        // Mock implementation - in a real app, this would be part of the user's subscription data
        setIsPremium(user.email?.includes('premium') || false);
      } catch (err) {
        console.error("Error fetching latest analysis:", err);
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    };
    
    if (!authLoading) {
      if (!user) {
        setInitialLoading(false);
      } else {
        // Add another timeout specifically for the API call
        const apiTimeout = setTimeout(() => {
          if (isMounted && initialLoading) {
            console.warn('API fetch timeout reached, continuing without data');
            setInitialLoading(false);
          }
        }, 3000); // 3 second timeout for API call
        
        fetchLatestAnalysis().finally(() => clearTimeout(apiTimeout));
      }
    }
    
    return () => {
      isMounted = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [user, authLoading, initialLoading]);

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

  // Reset webcam state
  const resetWebcamState = () => {
    setCurrentAngle('front');
    setCapturedAngles({});
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      // Validate file size and type
      for (const file of files) {
        const validationError = validateImageFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
      }
      
      setError(''); // Clear any previous errors
      setSelectedFiles(prevFiles => [...prevFiles, ...files]);
      
      // Create preview URLs
      const urls = files.map(file => URL.createObjectURL(file));
      setPreviewUrls(prevUrls => [...prevUrls, ...urls]);
      
      // Auto-assign angles if possible
      if (urls.length === REQUIRED_FACE_ANGLES.length && previewUrls.length === 0) {
        // If exactly 5 images uploaded at once and no existing images, 
        // auto-assign all angles
        const newAngles: Record<string, string> = {};
        urls.forEach((url, index) => {
          newAngles[url] = REQUIRED_FACE_ANGLES[index];
        });
        
        setFileAngles(newAngles);
      } else if (urls.length <= REQUIRED_FACE_ANGLES.length) {
        // Otherwise, try to assign available angles intelligently
        const currentAngles = Object.values(fileAngles);
        const availableAngles = REQUIRED_FACE_ANGLES.filter(angle => !currentAngles.includes(angle));
        
        // Create new angles map
        const newAngles: Record<string, string> = {};
        urls.forEach((url, index) => {
          if (index < availableAngles.length) {
            newAngles[url] = availableAngles[index];
          }
        });
        
        // Merge with existing angles
        setFileAngles(prev => ({...prev, ...newAngles}));
      }
      
      // Reset any existing analysis
      setAnalysis(null);
    }
  };

  // Set angle for a specific image
  const setImageAngle = (imageUrl: string, angle: string) => {
    setFileAngles(prev => ({
      ...prev,
      [imageUrl]: angle
    }));
  };

  // Handle webcam photo capture
  const handleCapturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // Add to captured angles
        setCapturedAngles(prev => ({
          ...prev,
          [currentAngle]: imageSrc
        }));
        
        // Move to next angle if there are more angles needed
        const remainingAngles = REQUIRED_FACE_ANGLES.filter(angle => 
          !Object.keys(capturedAngles).includes(angle) && angle !== currentAngle
        );
        
        if (remainingAngles.length > 0) {
          setCurrentAngle(remainingAngles[0]);
        } else if (currentAngle === REQUIRED_FACE_ANGLES[REQUIRED_FACE_ANGLES.length - 1]) {
          // We've captured all required angles, exit webcam mode
        setShowWebcam(false);
          
          // Add captured images to preview
          const capturedUrls = Object.values(capturedAngles);
          setPreviewUrls(capturedUrls);
          setFileAngles(capturedAngles);
          
          // Reset webcam state
          resetWebcamState();
        }
      }
    }
  };

  // Handle the submit action
  const handleSubmit = async () => {
    if ((previewUrls.length === 0) || !user) {
      setError('Please select or capture at least one image');
      return;
    }
    
    // Validate that all images have angles assigned
    const unassignedImages = previewUrls.filter(url => !fileAngles[url] || fileAngles[url] === '');
    if (unassignedImages.length > 0) {
      setError(`Please assign angles to ${unassignedImages.length} image${unassignedImages.length > 1 ? 's' : ''} before analyzing.`);
      return;
    }
    
    // Check if all required angles are provided
    const providedAngles = Object.values(fileAngles);
    
    // Count how many times each required angle appears
    const angleCounts: Record<string, number> = {};
    REQUIRED_FACE_ANGLES.forEach(angle => { angleCounts[angle] = 0 });
    providedAngles.forEach(angle => {
      if (angleCounts[angle] !== undefined) {
        angleCounts[angle]++;
      }
    });
    
    // Check for missing angles
    const missingAngles = REQUIRED_FACE_ANGLES.filter(angle => angleCounts[angle] === 0);
    if (missingAngles.length > 0) {
      setError(`Missing required face angles: ${missingAngles.map(getAngleLabel).join(', ')}.`);
      return;
    }
    
    // Check for duplicate angles
    const duplicateAngles = Object.entries(angleCounts)
      .filter(([_, count]) => count > 1)
      .map(([angle]) => angle);
    
    if (duplicateAngles.length > 0) {
      setError(`You've assigned the same angle (${duplicateAngles.map(getAngleLabel).join(', ')}) multiple times. Each angle should be assigned exactly once.`);
      return;
    }

    setError('');
    setLoading(true);
    setProcessing(true);

    // Set a timeout to ensure the process completes
    const processingTimeout = setTimeout(() => {
      if (loading || processing) {
        setLoading(false);
        setProcessing(false);
        setError('Processing timed out. Please try again.');
      }
    }, 15000); // 15 seconds timeout

    try {
      // Create a mapping from image URLs to their angles
      const angleMap: Record<string, string> = {};
      for (const [url, angle] of Object.entries(fileAngles)) {
        angleMap[url] = angle;
      }
      
      // Create a combined array of files and base64 strings (from webcam)
      const imagesToUpload = previewUrls;
      const anglesList = previewUrls.map(url => fileAngles[url] || 'unknown');

      // Upload images to storage
      const uploadResult = await uploadFaceImages(imagesToUpload, user.id, anglesList);
      
      // Analyze face
      const { analysis: result, error: analysisError } = await analyzeFace(
        uploadResult.urls, 
        user.id,
        uploadResult.angleMap
      );
      
      if (analysisError) {
        setError(analysisError);
      } else if (result) {
      setAnalysis(result);
      }
    } catch (err: any) {
      console.error('Error processing face rating:', err);
      setError(err.message || 'Failed to process images');
    } finally {
      clearTimeout(processingTimeout);
      setLoading(false);
      setProcessing(false);
    }
  };

  // Clear uploaded photos
  const clearUploads = () => {
    // Release object URLs to avoid memory leaks
    previewUrls.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    
    setPreviewUrls([]);
    setSelectedFiles([]);
    setFileAngles({});
    setAnalysis(null);
  };

  // Function to generate a shareable card with analysis results
  const generateShareableCard = () => {
    if (!analysis || !analysis.images || analysis.images.length === 0) return null;
    
    // Find the front-facing image - should be the first one
    // Make sure to use a proper front-facing image if available
    const frontImage = analysis.images.find(img => img.includes('front')) || analysis.images[0];
    
    // Calculate potential score deterministically - add 2-3 points to the overall score
    const potentialScore = Math.min(10, analysis.overall_score + 2 + (hashString(analysis.id).charCodeAt(0) % 2));

    return (
      <div id="shareable-card-content" className="p-6 bg-surface rounded-xl shadow-lg overflow-hidden max-w-md mx-auto border border-accent/20">
        <div className="flex justify-center">
          <div className="rounded-full overflow-hidden mx-auto w-40 h-40 mb-4 border-2 border-accent shadow-lg">
            {frontImage && (
              <img 
                src={frontImage} 
                alt="Face" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Handle image loading error by setting a default placeholder
                  (e.target as HTMLImageElement).src = '/images/face-placeholder.png';
                }}
              />
            )}
          </div>
        </div>
        
        <div className="text-center mb-4">
          <h3 className="text-xl font-bold">Face Analysis</h3>
          <p className="text-sm text-muted">Generated by GRME</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-sm text-muted mb-1">Overall</div>
            <div className="text-5xl font-bold">{analysis.overall_score.toFixed(1)}</div>
            <div className="w-full h-2 bg-gray-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-500 to-green-400" style={{ width: `${analysis.overall_score * 10}%` }}></div>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-muted mb-1">Potential</div>
            <div className="text-5xl font-bold">{potentialScore.toFixed(1)}</div>
            <div className="w-full h-2 bg-gray-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-500 to-green-400" style={{ width: `${potentialScore * 10}%` }}></div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-4">
          {analysis.features.slice(0, 4).map((feature, index) => (
            <div key={index}>
              <div className="text-sm text-muted mb-1">{feature.name}</div>
              <div className="text-3xl font-bold">{feature.score.toFixed(1)}</div>
              <div className="w-full h-2 bg-gray-800 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-green-400" style={{ 
                  width: `${feature.score * 10}%`
                }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Generate face attributes for the detailed analysis
  const generateFaceAttributes = () => {
    if (!analysis) return [];
    
    // Deterministically generate attributes based on the analysis ID
    const seed = hashString(analysis.id);
    
    // Canthal tilt options: positive, neutral, negative
    const canthalTilts = ['Positive', 'Neutral', 'Negative'];
    const canthalTiltIndex = parseInt(seed.substring(0, 2), 16) % canthalTilts.length;
    
    // Eye shape options: almond, round, hooded, deep-set, monolid
    const eyeShapes = ['Almond Eyes', 'Round Eyes', 'Hooded Eyes', 'Deep-Set Eyes', 'Monolid'];
    const eyeShapeIndex = parseInt(seed.substring(2, 4), 16) % eyeShapes.length;
    
    // Eye type options: hunter, prey, neutral
    const eyeTypes = ['Hunter', 'Prey', 'Neutral'];
    const eyeTypeIndex = parseInt(seed.substring(4, 6), 16) % eyeTypes.length;
    
    // Face shape options: oval, round, square, heart, diamond, rectangular
    const faceShapes = ['Oval', 'Round', 'Square', 'Heart', 'Diamond', 'Rectangular'];
    const faceShapeIndex = parseInt(seed.substring(6, 8), 16) % faceShapes.length;
    
    // Maxilla development options: forward growth, neutral, recessed
    const maxillaDevelopments = ['Strong', 'Neutral', 'Underdeveloped'];
    const maxillaIndex = parseInt(seed.substring(8, 10), 16) % maxillaDevelopments.length;
    
    // Nose shape options
    const noseShapes = ['Roman Nose', 'Button Nose', 'Aquiline Nose', 'Straight Nose', 'Roman or Aquiline Nose', 'Upturned Nose'];
    const noseShapeIndex = parseInt(seed.substring(10, 12), 16) % noseShapes.length;
    
    return [
      { trait: 'Canthal Tilt', value: canthalTilts[canthalTiltIndex] },
      { trait: 'Eye Shape', value: eyeShapes[eyeShapeIndex] },
      { trait: 'Eye Type', value: eyeTypes[eyeTypeIndex] },
      { trait: 'Face Shape', value: faceShapes[faceShapeIndex] },
      { trait: 'Maxilla Development', value: maxillaDevelopments[maxillaIndex] },
      { trait: 'Nose Shape', value: noseShapes[noseShapeIndex] }
    ];
  };

  // Function to create a simple hash for deterministic generation
  const hashString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Make sure it's positive and convert to string with leading zeros
    return Math.abs(hash).toString(16).padStart(12, '0');
  };

  // Function to navigate carousel
  const navigateCarousel = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setActiveSlide(prev => (prev + 1) % analysisSections.length);
    } else {
      setActiveSlide(prev => (prev - 1 + analysisSections.length) % analysisSections.length);
    }
  };

  // Touch handlers for mobile swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.targetTouches[0].clientX;
    setIsDragging(true);
    setDragOffset(0);
  };

  // Touch move handler
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !isDragging) return;
    
    touchEndRef.current = e.targetTouches[0].clientX;
    const currentOffset = touchEndRef.current - touchStartRef.current;
    
    // Limit dragging to one slide width with resistance
    const maxOffset = window.innerWidth * 0.8;
    const limitedOffset = Math.sign(currentOffset) * Math.min(Math.abs(currentOffset), maxOffset);
    
    setDragOffset(limitedOffset);
  };
  
  // Touch end handler (swipe)
  const handleSwipe = () => {
    setIsDragging(false);
    
    if (!touchStartRef.current || !touchEndRef.current) {
      setDragOffset(0);
      return;
    }
    
    const distance = touchStartRef.current - touchEndRef.current;
    const threshold = window.innerWidth * 0.2; // 20% of screen width
    
    const isLeftSwipe = distance > threshold;
    const isRightSwipe = distance < -threshold;
    
    if (isLeftSwipe) {
      navigateCarousel('next');
    } else if (isRightSwipe) {
      navigateCarousel('prev');
    }

    // Reset drag position and touch coordinates
    setDragOffset(0);
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  // Enhanced analysis results rendering
  const renderAnalysisResults = () => {
    if (!analysis) return null;
    
    // Generate face attributes
    const faceAttributes = generateFaceAttributes();

    // Render section content based on index
    const renderSectionContent = (sectionIndex: number) => {
      switch(analysisSections[sectionIndex].id) {
        case 'facial-traits':
          return (
            <div className="rounded-lg bg-surface p-6 shadow-lg h-full">
              <h3 className="text-lg font-semibold mb-3">Your Facial Traits</h3>
              <div className="rounded-lg overflow-hidden">
                {faceAttributes.map((attr, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-4 border-b border-gray-800 last:border-b-0"
                    style={{ backgroundColor: index % 2 === 0 ? 'rgba(0,0,0,0.2)' : 'transparent' }}
                  >
                    <div className="text-muted">{attr.trait}</div>
                    <div className="font-medium">{attr.value}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        case 'feature-breakdown':
          return (
            <div className="rounded-lg bg-surface p-6 shadow-lg h-full overflow-y-auto">
              <h3 className="text-lg font-semibold mb-3">Feature Breakdown</h3>
              <div className="space-y-4">
                {analysis.features.map((feature) => (
                  <div key={feature.name} className="rounded-md bg-hover p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{feature.name}</span>
                      <div className="flex items-center">
                        <span className="font-bold">{feature.score.toFixed(1)}</span>
                        <span className="text-muted text-sm ml-1">/10</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full mb-3 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-accent to-accent/80" style={{ width: `${feature.score * 10}%` }}></div>
                    </div>
                    <p className="text-sm text-muted mb-3">{feature.description}</p>
              
              {feature.improvements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Improvements</h4>
                        <ul className="ml-4 list-disc space-y-1 text-sm text-muted">
                    {feature.improvements.map((improvement, idx) => (
                      <li key={idx}>{improvement}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
              </div>
            </div>
          );
        case 'custom-routine':
          return (
            <div className="rounded-lg bg-surface p-6 shadow-lg h-full">
              <h3 className="text-lg font-semibold mb-3">Custom Routine</h3>
              <div className={`relative rounded-lg bg-hover p-4 ${!isPremium ? 'overflow-hidden' : ''}`}>
                {/* Premium restriction overlay */}
                {!isPremium && (
                  <div className="absolute inset-0 backdrop-blur-md flex flex-col items-center justify-center z-10 bg-black/60">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="font-medium text-white mb-2">Premium Feature</p>
                    <button 
                      onClick={() => setError("Please upgrade to premium to access custom routines.")}
                      className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-md font-medium"
                    >
                      Upgrade Now
                    </button>
                  </div>
                )}
                
                {/* Custom routine content (blurred for non-premium) */}
                <div className="flex items-center mb-3">
                  <div className="text-lg font-medium">Glow up routine</div>
                  <div className="ml-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-yellow-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <span>1 day streak</span>
                </div>
                
                <ul className="space-y-2">
                  {[
                    "Groom your eyebrows",
                    "Heart face styling",
                    "Start a skincare routine",
                    "Improve your hair"
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-3 p-3 rounded-lg bg-purple-900/50">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs">
                        {index + 1}
                      </div>
                      <span>{item}</span>
                      <div className="ml-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">Progress picture</div>
                  <div className="h-16 rounded-lg bg-gray-800 flex items-center justify-center">
                    <span className="text-xs text-gray-400">Upload your progress pics</span>
                  </div>
                </div>
              </div>
            </div>
          );
        case 'shareable-card':
          return (
            <div className="rounded-lg bg-surface p-6 shadow-lg h-full flex flex-col">
              <h3 className="text-lg font-semibold mb-3">Your Shareable Card</h3>
              <div className="flex-grow flex items-center justify-center">
                {generateShareableCard()}
              </div>
              
              {/* Download & Sharing Section */}
              <div className="mt-4 rounded-lg bg-surface p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-semibold">Download Options</h3>
                  
                  {isPremium ? (
                    <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded-full">Premium</span>
                  ) : (
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">Free</span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-1 gap-3 mt-3">
                  {isPremium ? (
                    <button 
                      onClick={() => handleDownloadCard(
                        document.getElementById('shareable-card-content') as HTMLElement, 
                        setError
                      )}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent hover:bg-accent/90 text-white transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download Card</span>
                    </button>
                  ) : (
                    <div className="relative">
                      <button 
                        onClick={() => setShowPremiumPopup(true)}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white/50 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download Card</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </button>
                      <div className="absolute top-full left-0 right-0 mt-1 text-xs text-center text-yellow-500">
                        Premium feature - Upgrade to download
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        default:
          return null;
      }
    };

    return (
      <div>
        <div className="mt-8 rounded-lg bg-surface p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-baseline">
              <div className="text-5xl font-bold">{analysis.overall_score.toFixed(1)}</div>
              <div className="ml-2 text-muted">/10</div>
            </div>
            
            {!isMobile && (
              <div className="flex gap-2">
                {analysisSections.map((section, index) => (
                  <button 
                    key={section.id}
                    onClick={() => {
                      const element = document.getElementById(section.id);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className={`px-3 py-1 rounded-md text-sm ${
                      false ? 'bg-accent text-white' : 'bg-hover hover:bg-hover/80'
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {isMobile ? (
            // Mobile Carousel View
            <div className="relative">
              {/* Carousel Navigation */}
              <div className="absolute top-1/2 left-2 -translate-y-1/2 z-10">
                <button
                  onClick={() => navigateCarousel('prev')}
                  className="rounded-full bg-black/30 p-2 text-white hover:bg-black/50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              <div className="carousel-container overflow-hidden">
                <div 
                  className={`carousel-inner flex transition-all ${isDragging ? 'duration-0' : 'duration-300 ease-in-out'}`}
                  style={{ 
                    transform: `translateX(calc(-${activeSlide * 100}% + ${dragOffset}px))` 
                  }}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleSwipe}
                >
                  {analysisSections.map((section, index) => (
                    <div key={section.id} className="w-full flex-shrink-0 px-2">
                      {renderSectionContent(index)}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="absolute top-1/2 right-2 -translate-y-1/2 z-10">
                <button
                  onClick={() => navigateCarousel('next')}
                  className="rounded-full bg-black/30 p-2 text-white hover:bg-black/50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              {/* Carousel Dots */}
              <div className="flex justify-center mt-4 gap-2">
                {analysisSections.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveSlide(index)}
                    className={`w-2 h-2 rounded-full ${
                      activeSlide === index ? 'bg-white' : 'bg-gray-500'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            // Desktop Layout - Full Width Grid
            <div className="grid grid-cols-3 gap-6">
              <div id="facial-traits" className="col-span-1">
                {renderSectionContent(0)}
              </div>
              <div id="feature-breakdown" className="col-span-2">
                {renderSectionContent(1)}
              </div>
              <div id="custom-routine" className="col-span-1">
                {renderSectionContent(2)}
              </div>
              <div id="shareable-card" className="col-span-2">
                {renderSectionContent(3)}
              </div>
            </div>
          )}
          
          <div className="mt-6 pt-5 border-t border-accent/10">
            <p className="text-sm text-muted">
              Analysis created on {new Date(analysis.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>
    );
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
                ? "Compressing and analyzing your image..."
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

  // Render the face guide overlay for webcam
  const renderFaceGuide = () => {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative border-2 border-dashed border-white/50 w-3/4 h-3/4 rounded-full">
          {/* Guide Points */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/50"></div>
          
          {/* Guide Text */}
          <div className="absolute bottom-0 left-0 right-0 translate-y-full mt-4 text-center">
            <p className="text-white bg-black/50 p-2 rounded-lg">
              {getAngleInstructions(currentAngle)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render angle selector for uploaded images
  const renderAngleSelector = (imageUrl: string) => {
    const currentAngle = fileAngles[imageUrl] || '';
    
    return (
      <div className="mt-2">
        <select
          value={currentAngle}
          onChange={(e) => setImageAngle(imageUrl, e.target.value)}
          className={`w-full rounded-md border ${!currentAngle ? 'border-yellow-500 animate-pulse' : 'border-gray-700'} bg-gray-800 px-3 py-1 text-text text-sm`}
        >
          <option value="">Select angle - Required</option>
          {REQUIRED_FACE_ANGLES.map(angle => (
            <option key={angle} value={angle} disabled={Object.values(fileAngles).includes(angle) && fileAngles[imageUrl] !== angle}>
              {getAngleLabel(angle)} {Object.values(fileAngles).includes(angle) && fileAngles[imageUrl] !== angle ? '(already assigned)' : ''}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // Render helper text for missing angles
  const renderMissingAnglesHelper = () => {
    const currentAngles = Object.values(fileAngles);
    const missingAngles = REQUIRED_FACE_ANGLES.filter(angle => !currentAngles.includes(angle));
    const unassignedImages = previewUrls.filter(url => !fileAngles[url]);
    
    if (missingAngles.length === 0) return null;
    
    return (
      <div className="mt-4 p-3 rounded-md bg-yellow-900/20 border border-yellow-900/30 text-yellow-200 text-sm">
        <p className="font-semibold mb-1">Missing required angles:</p>
        <ul className="list-disc list-inside mb-2">
          {missingAngles.map(angle => (
            <li key={angle}>{getAngleLabel(angle)}</li>
          ))}
        </ul>
        {unassignedImages.length > 0 && (
          <p className="text-yellow-100 font-semibold mt-2 border-t border-yellow-900/30 pt-2">
            Please assign angles to {unassignedImages.length} image{unassignedImages.length > 1 ? 's' : ''} using the dropdown selectors below each image.
          </p>
        )}
      </div>
    );
  };

  // Premium popup
  const renderPremiumPopup = () => {
    if (!showPremiumPopup) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50 backdrop-blur-sm">
        <div className="bg-surface p-6 rounded-xl shadow-2xl max-w-md w-full relative">
          <button 
            onClick={() => setShowPremiumPopup(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="text-center mb-6">
            <div className="bg-yellow-500 inline-block p-3 rounded-full mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Upgrade to Premium</h3>
            <p className="text-muted text-sm">
              Get full access to all premium features including original image downloads, custom routines, and detailed analytics.
            </p>
          </div>
          
          <div className="bg-hover rounded-lg p-4 mb-6">
            <div className="flex justify-between mb-2">
              <span className="font-medium">Monthly Premium</span>
              <span className="font-bold">$9.99/mo</span>
            </div>
            <ul className="space-y-2 text-sm text-muted mb-4">
              <li className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Download high-res original images
              </li>
              <li className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Custom routines & improvement plans
              </li>
              <li className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Detailed analytics & progress tracking
              </li>
              <li className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                No ads & priority support
              </li>
            </ul>
            <button 
              onClick={() => {
                // In a real app, this would redirect to payment
                setError("This would redirect to payment in a real app");
                setShowPremiumPopup(false);
              }}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-medium py-2 rounded-md transition-colors"
            >
              Subscribe Now
            </button>
          </div>
          
          <div className="text-center text-xs text-muted">
            You can cancel your subscription at any time
          </div>
        </div>
      </div>
    );
  };

  // Redirect to login if not authenticated and not loading
  if (!authLoading && !user) {
    return <Navigate to="/login" />;
  }

  // Show a comprehensive loading state while authentication is loading or the component is initializing
  if (authLoading || initialLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-pulse flex space-x-2 justify-center mb-4">
              <div className="h-3 w-3 bg-muted rounded-full"></div>
              <div className="h-3 w-3 bg-muted rounded-full"></div>
              <div className="h-3 w-3 bg-muted rounded-full"></div>
            </div>
            <p className="text-muted">Loading your data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout onPremiumClick={() => setShowPremiumPopup(true)}>
      {renderProcessingAnimation()}
      {renderPremiumPopup()}
      <div className="max-w-full mx-auto">
        <h1 className="text-2xl font-bold mb-2 page-title">Face Rating & Analysis</h1>
        <p className="text-muted mb-8" style={{ fontSize: 'calc(1rem * 1.02)', lineHeight: '1.6' }}>
          Upload a photo or take one with your camera to get an AI-powered analysis of your facial features.
          For accurate results, please provide photos from all required angles.
        </p>

        {error && (
          <div className="mb-8 rounded-md bg-red-900/20 px-5 py-4 text-sm text-red-400 border border-red-900/30">
            {error}
          </div>
        )}

        <div className="rounded-lg bg-surface p-7 shadow-lg section-container">
          {showWebcam ? (
            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-md">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="rounded-lg overflow-hidden max-w-full h-auto"
              />
                {renderFaceGuide()}
              </div>
              
              <div className="mt-3 w-full max-w-md bg-black/30 p-3 rounded-md text-center">
                <div className="text-white text-lg font-semibold mb-2">
                  {getAngleLabel(currentAngle)}
                </div>
                <div className="progress grid grid-cols-5 gap-1 mb-3">
                  {REQUIRED_FACE_ANGLES.map((angle) => (
                    <div 
                      key={angle} 
                      className={`h-1 rounded-full ${
                        Object.keys(capturedAngles).includes(angle) 
                          ? 'bg-green-500' 
                          : angle === currentAngle 
                            ? 'bg-yellow-500' 
                            : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="mt-4 flex space-x-4">
                <button
                  onClick={handleCapturePhoto}
                  className="rounded-md bg-text px-4 py-2 text-background hover:bg-accent transition-colors"
                >
                  Capture Photo
                </button>
                <button
                  onClick={() => {
                    setShowWebcam(false);
                    resetWebcamState();
                  }}
                  className="rounded-md bg-hover px-4 py-2 text-text hover:bg-accent/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-5 mb-7">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md border border-accent/30 px-5 py-2.5 text-text hover:bg-hover transition-colors"
                  style={{ fontSize: 'calc(1rem * 1.02)' }}
                >
                  Upload Photos
                </button>
                <button
                  onClick={() => {
                    setShowWebcam(true);
                    resetWebcamState();
                  }}
                  className="rounded-md border border-accent/30 px-5 py-2.5 text-text hover:bg-hover transition-colors"
                  style={{ fontSize: 'calc(1rem * 1.02)' }}
                >
                  Take Photos
                </button>
                {previewUrls.length > 0 && (
                  <button
                    onClick={clearUploads}
                    className="rounded-md border border-red-500/30 px-5 py-2.5 text-red-400 hover:bg-red-900/20 transition-colors"
                    style={{ fontSize: 'calc(1rem * 1.02)' }}
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <div className="p-4 rounded-md bg-surface/80 mb-5">
                <h3 className="font-medium mb-3" style={{ fontSize: 'calc(1.1rem * 1.02)' }}>Required face angles:</h3>
                <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {REQUIRED_FACE_ANGLES.map(angle => (
                    <li key={angle} className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-3 ${
                        Object.values(fileAngles).includes(angle) ? 'bg-green-500' : 'bg-gray-500'
                      }`}></span>
                      {getAngleLabel(angle)}
                    </li>
                  ))}
                </ul>
              </div>
              
              {previewUrls.length > 0 && !hasAllRequiredAngles(Object.values(fileAngles)) && (
                <div className="mb-4 p-3 rounded-md bg-blue-900/20 border border-blue-800/30 text-blue-200 text-sm">
                  <p className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Important:</span>
                  </p>
                  <ul className="ml-7 mt-1 list-disc space-y-1">
                    <li>You must assign a face angle to each uploaded photo using the dropdown below each image</li>
                    <li>Each required angle must be assigned exactly once</li>
                    <li>The "Analyze Face" button will be enabled once all required angles are assigned</li>
                  </ul>
                </div>
              )}
              
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
              />

              {previewUrls.length > 0 && (
                <div className="mt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {previewUrls.map((url, index) => (
                      <div key={index} className="rounded-md overflow-hidden shadow-lg bg-hover">
                        <div className="relative">
                        <img 
                          src={url} 
                          alt={`Preview ${index}`} 
                            className="w-full h-44 object-cover"
                          />
                          <button 
                            onClick={() => {
                              // Remove from preview and angles
                              setPreviewUrls(prev => prev.filter((_, i) => i !== index));
                              
                              // Remove from angles if it exists
                              setFileAngles(prev => {
                                const newAngles = { ...prev };
                                delete newAngles[url];
                                return newAngles;
                              });
                            }}
                            className="absolute top-2 right-2 bg-surface/70 hover:bg-surface p-1 rounded-full"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                        {renderAngleSelector(url)}
                      </div>
                    ))}
                  </div>
                  
                  {renderMissingAnglesHelper()}
                  
                  <div className="mt-5 flex items-center">
                    <button
                      onClick={handleSubmit}
                      disabled={loading || !hasAllRequiredAngles(Object.values(fileAngles))}
                      className="rounded-md bg-text px-6 py-2 text-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-background" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Analyzing...
                        </div>
                      ) : (
                        'Analyze Face'
                      )}
                    </button>
                    <div className="ml-4 text-xs text-muted">
                      Max file size: 5MB
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {analysis && renderAnalysisResults()}
      </div>
    </AppLayout>
  );
};

export default FaceRating; 