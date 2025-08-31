import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Camera, 
  Image, 
  Video, 
  X, 
  PlayCircle,
  FileImage,
  FileVideo 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ImprovedMediaUploadProps {
  onMediaSelected: (url: string, type: 'image' | 'video') => Promise<void>;
  bucket: string;
  onClose?: () => void;
  className?: string;
}

export const ImprovedMediaUpload: React.FC<ImprovedMediaUploadProps> = ({
  onMediaSelected,
  bucket,
  onClose,
  className = ''
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Single file input for all media types
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (file.size > maxSize) {
      return 'File size must be less than 50MB';
    }
    
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      return 'File must be an image or video';
    }
    
    return null;
  };

  const getFileType = (file: File): 'image' | 'video' => {
    return file.type.startsWith('video/') ? 'video' : 'image';
  };

  const handleFileSelect = useCallback(async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast({
        title: "Invalid file",
        description: error,
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    // Auto-upload immediately
    await handleUpload(file);
  }, []);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = file.name.split('.').pop() || 'dat';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 15;
        });
      }, 200);

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      await onMediaSelected(publicUrl, getFileType(file));
      
      toast({
        title: "Upload successful",
        description: `${getFileType(file)} uploaded successfully`,
      });

      // Close after successful upload
      onClose?.();

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  // Direct input handlers - no double popup
  const handlePhotoLibrary = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*";
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  const handleCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*,video/*";
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

  const handleVideoLibrary = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = "video/*";
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  return (
    <div className={cn("p-4", className)}>
      {/* Single hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileSelect(file);
          }
          // Reset input value
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />

      {/* Preview and upload progress */}
      {selectedFile && (
        <Card className="p-4 mb-4">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-medium">Uploading...</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="p-1"
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {previewUrl && (
            <div className="mb-3">
              {getFileType(selectedFile) === 'image' ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full h-auto max-h-48 rounded object-contain bg-muted/50"
                />
              ) : (
                <div className="relative">
                  <video
                    src={previewUrl}
                    className="max-w-full h-auto max-h-48 rounded"
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <PlayCircle className="h-12 w-12 text-white opacity-80 drop-shadow-lg" />
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-between items-center text-sm text-muted-foreground mb-3">
            <span>{selectedFile.name}</span>
            <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>

          {isUploading && (
            <div>
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-1">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Upload options - only show when not uploading */}
      {!selectedFile && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleCamera}
              className="flex flex-col items-center gap-2 h-auto py-4"
              disabled={isUploading}
            >
              <Camera className="h-6 w-6" />
              <span className="text-sm font-medium">Camera</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={handlePhotoLibrary}
              className="flex flex-col items-center gap-2 h-auto py-4"
              disabled={isUploading}
            >
              <FileImage className="h-6 w-6" />
              <span className="text-sm font-medium">Photo Library</span>
            </Button>
          </div>
          
          <Button
            variant="outline"
            onClick={handleVideoLibrary}
            className="w-full flex items-center gap-2 h-auto py-4"
            disabled={isUploading}
          >
            <FileVideo className="h-6 w-6" />
            <span className="text-sm font-medium">Video Library</span>
          </Button>
        </div>
      )}
    </div>
  );
};