import imageCompression from 'browser-image-compression';
import { MAX_FILE_SIZE, TARGET_FILE_SIZE } from '../utils/supabaseClient';

/**
 * Validates if a file meets the size requirements
 * @param file File to validate
 * @returns Error message if validation fails, null otherwise
 */
export const validateImageFile = (file: File): string | null => {
  const maxSizeInBytes = MAX_FILE_SIZE; // Use the constant
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  
  if (file.size > maxSizeInBytes) {
    return "File is too large. Maximum size is 5MB.";
  }
  
  if (!acceptedTypes.includes(file.type)) {
    return "Invalid file type. Only JPEG and PNG images are accepted.";
  }
  
  return null;
};

/**
 * Calculates optimal compression parameters based on image dimensions and size
 * @param image Image element with loaded source
 * @param fileSize Original file size in bytes
 * @returns Object with optimal quality and dimensions
 */
const calculateOptimalCompression = (image: HTMLImageElement, fileSize: number): { 
  quality: number, 
  maxWidth: number 
} => {
  const { width, height } = image;
  const isLarge = width > 1200 || height > 1200;
  const isMedium = width > 800 || height > 800;
  const isVeryLarge = width > 2000 || height > 2000;
  
  // Size ratio compared to target (how much we need to compress)
  const sizeRatio = fileSize / TARGET_FILE_SIZE;
  
  // Base quality on both image dimensions and file size
  let quality = 0.7; // Default quality
  let maxWidth = 800; // Default max width
  
  if (isVeryLarge) {
    maxWidth = 1000;
    quality = sizeRatio > 20 ? 0.4 : 0.5;
  } else if (isLarge) {
    maxWidth = 800;
    quality = sizeRatio > 10 ? 0.5 : 0.6;
  } else if (isMedium) {
    maxWidth = 600;
    quality = sizeRatio > 5 ? 0.6 : 0.7;
  } else {
    // Small image
    maxWidth = 500;
    quality = sizeRatio > 3 ? 0.7 : 0.8;
  }
  
  // Ensure quality doesn't go too low for small images
  if (width <= 400 && height <= 400) {
    quality = Math.max(quality, 0.7);
  }
  
  return { quality, maxWidth };
};

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Compresses an image file to meet size constraints with KB-level targeting
 * @param imageFile Original file from input or camera
 * @returns Promise containing the compressed file
 */
export const compressImage = (
  file: File, 
  options?: CompressionOptions
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const maxWidth = options?.maxWidth || 800;
    const maxHeight = options?.maxHeight || 800;
    const quality = options?.quality || 0.8;
    const onProgress = options?.onProgress;
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      if (!event.target?.result) {
        reject(new Error('Failed to read file'));
        return;
      }
      
      const img = new Image();
      img.src = event.target.result as string;
      
      // Report 10% progress after loading the file
      if (onProgress) onProgress(10);
      
      img.onload = () => {
        // Report 30% progress after loading the image
        if (onProgress) onProgress(30);
        
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * maxWidth / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * maxHeight / height);
            height = maxHeight;
          }
        }
        
        // Report 50% progress after calculating dimensions
        if (onProgress) onProgress(50);
        
        // Create canvas and resize
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Report 70% progress after resizing the image
        if (onProgress) onProgress(70);
        
        // Convert to blob with quality setting
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            // Report 100% progress when compression is complete
            if (onProgress) onProgress(100);
            resolve(blob);
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
};

/**
 * Gets image dimensions by loading it into an Image element
 */
const getImageInfo = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image for analysis'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
  });
};

/**
 * Manual image resizing using canvas with better quality control
 * @param file Original file
 * @param maxSize Maximum dimension size
 * @param quality JPEG quality (0-1)
 */
const manualImageResize = (file: File, maxSize: number = 400, quality: number = 0.5): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with specified quality
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newFile = new File([blob], file.name, { type: 'image/jpeg' });
              console.log(`Manual resize result: ${Math.round(newFile.size/1024)}KB`);
              resolve(newFile);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image for resizing'));
    };
    
    reader.onerror = () => reject(new Error('Failed to read image file'));
  });
};

/**
 * Converts a base64 data URL to a File object
 * @param dataUrl Base64 data URL (e.g. from webcam)
 * @param filename Name for the file
 * @returns File object
 */
export const dataURLtoFile = (dataUrl: string, filename: string): File => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
};

/**
 * Generates a unique filename for uploaded images
 * @param userId User's ID
 * @param prefix Optional prefix for the filename
 * @returns Unique filename
 */
export const generateUniqueFilename = (userId: string, prefix: string = ''): string => {
  const timestamp = new Date().getTime();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${prefix}${userId}_${timestamp}_${randomString}.jpg`;
}; 