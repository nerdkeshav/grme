import { supabase, STORAGE_BUCKETS } from '../utils/supabaseClient';
import { compressImage, dataURLtoFile, generateUniqueFilename } from '../utils/imageCompression';
import { FacialAnalysis, FacialFeature, FaceRatingEntry } from '../types/supabase';

// Flag for using mock API in development
const USE_MOCK_API = true;

// Required face angles for complete analysis
export const REQUIRED_FACE_ANGLES = [
  'front', 
  'left_profile', 
  'right_profile', 
  'left_quarter', 
  'right_quarter'
];

// Mock storage for development
const mockImageStorage: Record<string, string[]> = {};
const mockAnalysisStorage: Record<string, FacialAnalysis[]> = {};

// Image fingerprint cache for consistent results
const analysisCache: Record<string, FacialAnalysis> = {};

/**
 * Uploads images for facial analysis
 * @param images Array of image files to upload
 * @param userId Current user's ID
 * @param angles Array of angle labels for the uploaded images
 * @returns Array of stored image URLs with their angles
 */
export const uploadFaceImages = async (
  images: (File | string)[],
  userId: string,
  angles: string[] = []
): Promise<{urls: string[], angleMap: Record<string, string>}> => {
  if (USE_MOCK_API) {
    // For development: just create fake URLs
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    
    // Create deterministic URLs that include an image fingerprint
    const uploadedUrls = images.map((image, index) => {
      // Create a simple fingerprint from the image data
      const fingerprint = typeof image === 'string'
        ? hashString(image.substring(0, 100)) // Use first part of base64 string
        : hashString(`${image.name}-${image.size}-${image.lastModified}`);
      
      const angle = angles[index] || 'unknown';
      return `https://mock-storage.example.com/${userId}/image_${fingerprint}_${angle}.jpg`;
    });
    
    // Store in mock storage
    if (!mockImageStorage[userId]) {
      mockImageStorage[userId] = [];
    }
    mockImageStorage[userId] = [...mockImageStorage[userId], ...uploadedUrls];
    
    // Create a map of URLs to their angles
    const angleMap: Record<string, string> = {};
    uploadedUrls.forEach((url, i) => {
      angleMap[url] = angles[i] || 'unknown';
    });
    
    return { urls: uploadedUrls, angleMap };
  }

  const uploadedUrls: string[] = [];
  const angleMap: Record<string, string> = {};

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const angle = angles[i] || 'unknown';

    try {
      let fileToUpload: File;
      
      // Convert to File if it's a base64 string (from webcam)
      if (typeof image === 'string') {
        fileToUpload = dataURLtoFile(
          image, 
          generateUniqueFilename(userId, `${angle}_`)
        );
      } else {
        fileToUpload = image;
      }
      
      // Compress the image
      const compressedFile = await compressImage(fileToUpload);
      
      // Generate unique filename with angle info
      const filename = generateUniqueFilename(userId, `${angle}_`);
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.FACE_RATING_IMAGES)
        .upload(`${userId}/${filename}`, compressedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`Error uploading image: ${error.message}`);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKETS.FACE_RATING_IMAGES)
        .getPublicUrl(`${userId}/${filename}`);

      uploadedUrls.push(publicUrl);
      angleMap[publicUrl] = angle;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  return { urls: uploadedUrls, angleMap };
};

/**
 * Simple hash function for strings to use for image fingerprinting
 */
const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Make sure it's positive and convert to string
  return Math.abs(hash).toString(16);
};

/**
 * Creates a deterministic rating based on image URL
 */
const getDeterministicScore = (key: string, min: number, max: number): number => {
  const hash = hashString(key);
  const hashNum = parseInt(hash.substring(0, 8), 16);
  const normalized = hashNum / 0xFFFFFFFF; // Normalize to 0-1
  return Math.round((normalized * (max - min) + min) * 10) / 10;
};

/**
 * Check if an image is likely to contain a face
 * In a real app, this would use face detection APIs like TensorFlow.js face-api
 */
const containsFace = (imageUrlOrData: string): boolean => {
  // For production, we would use a proper face detection library like:
  // - face-api.js (TensorFlow.js based)
  // - OpenCV.js
  // - AWS Rekognition or similar cloud API
  
  // For demonstration purposes, we'll always assume our images contain faces
  // and instead focus on providing realistic analysis results
  
  // Always return true for data URLs (webcam captures)
  if (imageUrlOrData.startsWith('data:image')) {
    return true;
  }
  
  // Always return true for storage URLs (our own uploaded images)
  if (imageUrlOrData.includes(STORAGE_BUCKETS.FACE_RATING_IMAGES)) {
    return true;
  }
  
  // For the demo, let's reject obvious non-face content
  const nonFaceKeywords = [
    'logo', 'icon', 'graph', 'chart', 'diagram', 'text',
    'letter', 'document', 'map', 'landscape', 'building'
  ];
  
  // Check if URL contains any of the non-face keywords
  if (nonFaceKeywords.some(keyword => imageUrlOrData.toLowerCase().includes(keyword))) {
    return false;
  }
  
  // For all other cases, assume it's a valid face image
  return true;
};

/**
 * Check if we have all required face angles
 */
export const hasAllRequiredAngles = (angles: string[]): boolean => {
  // First, filter out empty strings and unknown angles
  const validAngles = angles.filter(angle => 
    angle && angle !== 'unknown' && REQUIRED_FACE_ANGLES.includes(angle)
  );
  
  // Check if each required angle appears exactly once in our valid angles list
  return REQUIRED_FACE_ANGLES.every(requiredAngle => 
    validAngles.includes(requiredAngle)
  );
};

/**
 * Get a specific description for a feature based on its score
 */
const getFeatureDescription = (feature: string, score: number): { description: string, improvements: string[] } => {
  if (feature === 'Jawline') {
    if (score >= 8) {
      return {
        description: 'Your jawline is well-defined with sharp angles and strong definition.',
        improvements: [
          'Continue with facial exercises to maintain jawline strength',
          'Stay at a low body fat percentage to keep definition visible',
          'Consider facial massage to enhance circulation and prevent sagging'
        ]
      };
    } else if (score >= 6) {
      return {
        description: 'Your jawline has good definition but could be more angular and pronounced.',
        improvements: [
          'Regular jaw exercises like jaw clenches can improve definition',
          'Reducing body fat may help make your jawline more visible',
          'Proper tongue posture (mewing) can enhance jawline appearance'
        ]
      };
    } else {
      return {
        description: 'Your jawline could use more definition and angularity.',
        improvements: [
          'Consider a dedicated facial exercise routine focusing on the jaw',
          'Reducing overall body fat percentage can help jawline visibility',
          'Chewing sugar-free gum regularly can strengthen jaw muscles',
          'Try facial massage to reduce puffiness around the jawline'
        ]
      };
    }
  } 
  else if (feature === 'Eyes') {
    if (score >= 8) {
      return {
        description: 'Your eyes have excellent symmetry, positive canthal tilt, and good spacing.',
        improvements: [
          'Maintain good sleep habits to prevent dark circles',
          'Use cooling eye masks to reduce morning puffiness',
          'Consider subtle makeup techniques to enhance your eye shape'
        ]
      };
    } else if (score >= 6) {
      return {
        description: 'Your eyes have good symmetry with a neutral to positive canthal tilt.',
        improvements: [
          'Try strengthening exercises for the muscles around the eyes',
          'Use hydrating eye creams to improve skin elasticity',
          'Consider lash growth serums for enhanced eye framing'
        ]
      };
    } else {
      return {
        description: 'Your eyes could benefit from better framing and reduction of fatigue signs.',
        improvements: [
          'Ensure proper hydration and sleep to reduce eye puffiness',
          'Try facial yoga focusing on the eye area to lift sagging',
          'Consider eyebrow grooming to better frame your eyes',
          'Cold compresses can help reduce morning swelling around eyes'
        ]
      };
    }
  }
  else if (feature === 'Nose') {
    if (score >= 8) {
      return {
        description: 'Your nose is well-proportioned and balanced with your other facial features.',
        improvements: [
          'Maintain proper nasal breathing to keep a relaxed appearance',
          'Protect from sun damage to prevent aging of nose skin',
          'Consider specialized facial exercises to maintain nasal definition'
        ]
      };
    } else if (score >= 6) {
      return {
        description: 'Your nose is proportional but has some minor asymmetry.',
        improvements: [
          'Contour techniques can create the appearance of better symmetry',
          'Facial exercises may help strengthen surrounding muscles',
          'Proper nasal breathing techniques can improve nose appearance'
        ]
      };
    } else {
      return {
        description: 'Your nose has some proportion issues relative to other facial features.',
        improvements: [
          'Expert contouring makeup can create illusion of better nose shape',
          'Nasal breathing exercises may improve muscle tone around nose',
          'Avoid touching or pressing on your nose to prevent distortion',
          'Proper skincare can reduce shine or redness on nose'
        ]
      };
    }
  }
  else if (feature === 'Skin') {
    if (score >= 8) {
      return {
        description: 'Your skin has excellent tone, clarity, and minimal texture issues.',
        improvements: [
          'Maintain your current skincare routine',
          'Consider adding antioxidants for additional protection',
          'Regular professional treatments can help maintain skin quality'
        ]
      };
    } else if (score >= 6) {
      return {
        description: 'Your skin has good tone but shows signs of minor texture issues and occasional blemishes.',
        improvements: [
          'Develop a consistent skincare routine with gentle exfoliation',
          'Consider adding targeted serums for specific concerns',
          'Ensure adequate hydration both internally and topically'
        ]
      };
    } else {
      return {
        description: 'Your skin shows signs of uneven texture, potential blemishes or discoloration.',
        improvements: [
          'Consider a dermatologist consultation for a personalized routine',
          'Add chemical exfoliants like BHA/AHA to your routine',
          'Focus on barrier repair products if skin is sensitive',
          'Increase water intake and reduce sugar consumption',
          'Use SPF daily to prevent further damage'
        ]
      };
    }
  }
  else if (feature === 'Facial Harmony') {
    if (score >= 8) {
      return {
        description: 'Your facial features have excellent balance and proportion to each other.',
        improvements: [
          'Focus on maintaining overall facial symmetry through proper posture',
          'Consider facial massage techniques to preserve muscle tone',
          'Maintain current body fat levels for optimal facial definition'
        ]
      };
    } else if (score >= 6) {
      return {
        description: 'Your facial features work well together with good overall balance.',
        improvements: [
          'Targeted facial exercises can improve specific areas',
          'Hairstyles that frame your face can enhance overall harmony',
          'Consider facial massage to improve symmetry and reduce tension'
        ]
      };
    } else {
      return {
        description: 'Your facial harmony has room for improvement in terms of balance and proportion.',
        improvements: [
          'Full facial exercise routines can help balance muscle development',
          'Consider hairstyles that optimize your face shape',
          'Working on posture can significantly improve facial appearance',
          'Reducing water retention through diet can improve facial definition',
          'Consider facial massage to reduce asymmetry from tension'
        ]
      };
    }
  }
  else if (feature === 'Symmetry') {
    if (score >= 8) {
      return {
        description: 'Your face has excellent symmetry with minimal differences between left and right sides.',
        improvements: [
          'Maintain balanced facial exercises to preserve symmetry',
          'Continue with good sleep patterns to prevent asymmetrical swelling',
          'Consider facial massage to maintain balanced muscle tone'
        ]
      };
    } else if (score >= 6) {
      return {
        description: 'Your face has good symmetry with minor differences between left and right sides.',
        improvements: [
          'Try targeted exercises for the less defined side of your face',
          'Facial yoga can help improve muscle tone on the weaker side',
          'Pay attention to sleeping positions that may create asymmetry'
        ]
      };
    } else {
      return {
        description: 'Your face shows noticeable asymmetry between the left and right sides.',
        improvements: [
          'Targeted facial exercises can help balance muscle development',
          'Practice conscious facial posture throughout the day',
          'Consider changing sleep positions to reduce nighttime pressure',
          'Facial massage focusing on the weaker side can improve symmetry',
          'Hairstyles that add visual balance can reduce the appearance of asymmetry'
        ]
      };
    }
  }
  else if (feature === 'Facial Profile') {
    if (score >= 8) {
      return {
        description: 'Your profile view shows excellent proportions with balanced features.',
        improvements: [
          'Maintain neck and posture exercises for continued profile definition',
          'Consider gentle jawline exercises to maintain your strong profile',
          'Protect skin from sun damage to maintain youthful profile appearance'
        ]
      };
    } else if (score >= 6) {
      return {
        description: 'Your profile has good overall shape with some areas that could be enhanced.',
        improvements: [
          'Practice proper tongue posture (mewing) to improve jawline profile',
          'Neck exercises can help define the jawline from profile view',
          'Consider hairstyles that enhance your profile proportions'
        ]
      };
    } else {
      return {
        description: 'Your profile could benefit from improved definition and proportions.',
        improvements: [
          'Regular mewing (proper tongue posture) can improve profile appearance',
          'Exercises targeting the submental area can reduce fullness',
          'Improved posture significantly enhances profile appearance',
          'Consider targeted facial exercises for profile enhancement',
          'Focused jawline exercises can strengthen profile definition'
        ]
      };
    }
  }
  else {
    // Default fallback
    return {
      description: 'This feature shows potential for improvement.',
      improvements: [
        'Consider a personalized approach with a professional',
        'Consistent self-care routines can lead to improvements',
        'Research specific techniques for this area'
      ]
    };
  }
};

/**
 * Analyzes face images and provides a rating
 * This would normally call an AI service, but for demo purposes we use deterministic mock data
 * @param imageUrls Array of image URLs to analyze
 * @param userId Current user's ID
 * @param angleMap Mapping of image URLs to their face angles
 * @returns Facial analysis results or error
 */
export const analyzeFace = async (
  imageUrls: string[],
  userId: string,
  angleMap: Record<string, string> = {}
): Promise<{analysis: FacialAnalysis | null, error: string | null}> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check if we have actual face images
  const validFaces = imageUrls.filter(url => containsFace(url));
  if (validFaces.length === 0) {
    return {
      analysis: null, 
      error: "No valid face images detected. Please upload clear photos of your face."
    };
  }
  
  // Check if we have all required angles
  const providedAngles = Object.values(angleMap);
  const missingAngles = REQUIRED_FACE_ANGLES.filter(angle => !providedAngles.includes(angle));
  
  if (missingAngles.length > 0) {
    const humanReadableAngles = missingAngles.map(angle => {
      switch(angle) {
        case 'front': return 'front view';
        case 'left_profile': return 'left profile';
        case 'right_profile': return 'right profile';
        case 'left_quarter': return 'left quarter view';
        case 'right_quarter': return 'right quarter view';
        default: return angle;
      }
    });
    
    return {
      analysis: null,
      error: `Missing required face angles: ${humanReadableAngles.join(', ')}. Please provide all required angles for a complete analysis.`
    };
  }
  
  // Use the first image URL as a key for consistent results
  const imageKey = validFaces[0] || userId;
  
  // Check if we already have an analysis for this image
  if (analysisCache[imageKey]) {
    return { analysis: analysisCache[imageKey], error: null };
  }
  
  // Generate deterministic score based on image URL
  const overallScore = getDeterministicScore(imageKey, 5.5, 9.5);
  
  // Create feature scores based on the overall score but with variations
  // Add symmetry and profile features when we have multiple angles
  const featureScores: Record<string, number> = {
    Jawline: getDeterministicScore(imageKey + 'jawline', Math.max(4, overallScore - 1.5), Math.min(10, overallScore + 1)),
    Eyes: getDeterministicScore(imageKey + 'eyes', Math.max(4, overallScore - 1.5), Math.min(10, overallScore + 1)),
    Nose: getDeterministicScore(imageKey + 'nose', Math.max(4, overallScore - 1.5), Math.min(10, overallScore + 1)),
    Skin: getDeterministicScore(imageKey + 'skin', Math.max(4, overallScore - 1.5), Math.min(10, overallScore + 1)),
    'Facial Harmony': getDeterministicScore(imageKey + 'harmony', Math.max(4, overallScore - 1), Math.min(10, overallScore + 1.5))
  };
  
  // Add profile-specific scores when we have multiple angles
  if (providedAngles.includes('left_profile') || providedAngles.includes('right_profile')) {
    featureScores['Facial Profile'] = getDeterministicScore(
      imageKey + 'profile', 
      Math.max(4, overallScore - 1.2), 
      Math.min(10, overallScore + 1.2)
    );
  }
  
  // Add symmetry scores when we have both left and right views
  if (providedAngles.includes('left_profile') && providedAngles.includes('right_profile')) {
    featureScores['Symmetry'] = getDeterministicScore(
      imageKey + 'symmetry', 
      Math.max(4, overallScore - 1.3), 
      Math.min(10, overallScore + 1.3)
    );
  }
  
  // Build features with appropriate descriptions based on scores
  const features: FacialFeature[] = Object.entries(featureScores).map(([name, score]) => {
    const { description, improvements } = getFeatureDescription(name, score);
    return {
      name,
      score,
      description,
      improvements
    };
  });
  
  // Create the analysis object
  const analysis: FacialAnalysis = {
    id: `analysis_${hashString(imageKey)}`,
    user_id: userId,
    overall_score: overallScore,
    created_at: new Date().toISOString(),
    features,
    images: validFaces,
  };
  
  // Store in cache for consistent results
  analysisCache[imageKey] = analysis;
  
  if (USE_MOCK_API) {
    // Store in mock storage
    if (!mockAnalysisStorage[userId]) {
      mockAnalysisStorage[userId] = [];
    }
    // Don't add duplicate analyses
    if (!mockAnalysisStorage[userId].some(a => a.id === analysis.id)) {
      mockAnalysisStorage[userId] = [analysis, ...mockAnalysisStorage[userId]];
    }
    return { analysis, error: null };
  }
  
  // Check if analysis already exists in database
  const { data: existingAnalysis } = await supabase
    .from('facial_analyses')
    .select('*')
    .eq('id', analysis.id)
    .single();
  
  if (existingAnalysis) {
    return { analysis: existingAnalysis as FacialAnalysis, error: null };
  }
  
  // Save to Supabase
  const { data, error } = await supabase
    .from('facial_analyses')
    .insert([{
      id: analysis.id,
      user_id: userId,
      overall_score: overallScore,
      created_at: new Date().toISOString(),
      features,
      images: validFaces,
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error saving analysis:', error);
    // Return generated analysis if database insert fails
    return { analysis, error: null };
  }
  
  return { analysis: data as FacialAnalysis, error: null };
};

/**
 * Fetches the latest facial analysis for a user
 * @param userId User ID to fetch analysis for
 * @returns Latest facial analysis or null if none exists
 */
export const getLatestAnalysis = async (userId: string): Promise<FacialAnalysis | null> => {
  if (USE_MOCK_API) {
    // For development: return first item from mock storage if it exists
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    return mockAnalysisStorage[userId]?.[0] || null;
  }
  
  const { data, error } = await supabase
    .from('facial_analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // No data found
      return null;
    }
    console.error('Error fetching analysis:', error);
    throw error;
  }
  
  return data as FacialAnalysis;
}; 