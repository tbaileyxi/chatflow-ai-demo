import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { 
  Camera, 
  Video, 
  Upload, 
  Image, 
  X, 
  PlayCircle,
  FileVideo,
  FileImage 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateVideoThumbnail } from '@/utils/videoThumbnail';

interface MediaUploadProps {
  onMediaSelected: (url: string, type: 'image' | 'video', commentary?: string) => void;
  bucket: string;
  className?: string;
  showPreview?: boolean;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({
  onMediaSelected,
  bucket,
  className = '',
  showPreview = true
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [commentary, setCommentary] = useState('');
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    const videoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime'];
    
    if (file.size > maxSize) {
      return 'File size must be less than 50MB';
    }
    
    // More lenient validation for mobile uploads
    const isImage = file.type.startsWith('image/') || imageTypes.includes(file.type);
    const isVideo = file.type.startsWith('video/') || videoTypes.includes(file.type);
    
    if (!isImage && !isVideo) {
      return 'File must be an image or video';
    }
    
    return null;
  };

  const getFileType = (file: File): 'image' | 'video' => {
    return file.type.startsWith('video/') ? 'video' : 'image';
  };

  const handleFileSelect = async (file: File) => {
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
    
    if (showPreview) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Generate thumbnail for videos
      if (getFileType(file) === 'video') {
        try {
          const thumbnail = await generateVideoThumbnail(file);
          setVideoThumbnail(thumbnail);
        } catch (error) {
          console.warn('Failed to generate video thumbnail:', error);
        }
      }
    } else {
      handleUpload(file);
    }
  };

  const handleUpload = async (file?: File) => {
    const fileToUpload = file || selectedFile;
    if (!fileToUpload) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 100);

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileToUpload);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      onMediaSelected(publicUrl, getFileType(fileToUpload), commentary.trim() || undefined);
      
      toast({
        title: "Upload successful",
        description: `${getFileType(fileToUpload)} uploaded successfully`,
      });

      // Reset state
      setSelectedFile(null);
      setPreviewUrl(null);
      setCommentary('');
      setUploadProgress(0);

    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setCommentary('');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (videoThumbnail) {
      URL.revokeObjectURL(videoThumbnail);
      setVideoThumbnail(null);
    }
  };

  const triggerFileInput = (inputRef: React.RefObject<HTMLInputElement>) => {
    inputRef.current?.click();
  };

  return (
    <div className={className}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        style={{ display: 'none' }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/mov,video/avi,video/webm"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        style={{ display: 'none' }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        style={{ display: 'none' }}
      />
      <input
        ref={videoCameraInputRef}
        type="file"
        accept="video/*,video/mp4,video/mov,video/quicktime"
        capture="environment"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        style={{ display: 'none' }}
      />

      {/* Preview area */}
      {selectedFile && showPreview && (
        <Card className="p-4 mb-4">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-medium">Preview</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="p-1"
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
                  className="max-w-full h-auto max-h-64 rounded object-contain bg-muted/50"
                  style={{ aspectRatio: 'auto' }}
                />
               ) : (
                <div className="relative">
                  <video
                    src={previewUrl}
                    poster={videoThumbnail || undefined}
                    controls
                    className="max-w-full h-auto max-h-64 rounded"
                  />
                  {videoThumbnail && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <PlayCircle className="h-12 w-12 text-white opacity-80 drop-shadow-lg" />
                    </div>
                  )}
                </div>
               )}
            </div>
          )}
          
          <div className="flex justify-between items-center text-sm text-muted-foreground mb-3">
            <span>{selectedFile.name}</span>
            <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>

          {/* Commentary Input */}
          <div className="mb-3">
            <label className="text-sm font-medium text-foreground">Message (Optional)</label>
            <input
              type="text"
              value={commentary}
              onChange={(e) => setCommentary(e.target.value)}
              placeholder="Add a message to go with your upload..."
              className="w-full px-3 py-2 mt-1 text-sm border border-border rounded-md bg-background"
            />
          </div>

          {isUploading && (
            <div className="mb-3">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-1">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          <Button
            onClick={() => handleUpload()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? 'Uploading...' : 'Upload & Send'}
          </Button>
        </Card>
      )}

      {/* Upload options */}
      {!selectedFile && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => triggerFileInput(cameraInputRef)}
            className="flex flex-col items-center gap-2 h-auto py-3"
          >
            <Camera className="h-5 w-5" />
            <span className="text-xs">Take Photo</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={() => triggerFileInput(videoCameraInputRef)}
            className="flex flex-col items-center gap-2 h-auto py-3"
          >
            <Video className="h-5 w-5" />
            <span className="text-xs">Take Video</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={() => triggerFileInput(fileInputRef)}
            className="flex flex-col items-center gap-2 h-auto py-3"
          >
            <FileImage className="h-5 w-5" />
            <span className="text-xs">Upload Photo</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={() => triggerFileInput(videoInputRef)}
            className="flex flex-col items-center gap-2 h-auto py-3"
          >
            <FileVideo className="h-5 w-5" />
            <span className="text-xs">Upload Video</span>
          </Button>
        </div>
      )}
    </div>
  );
};