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

interface MediaUploadProps {
  onMediaSelected: (url: string, type: 'image' | 'video') => void;
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
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm'];
    
    if (file.size > maxSize) {
      return 'File size must be less than 50MB';
    }
    
    if (!imageTypes.includes(file.type) && !videoTypes.includes(file.type)) {
      return 'File must be an image (JPG, PNG, GIF, WebP) or video (MP4, MOV, AVI, WebM)';
    }
    
    return null;
  };

  const getFileType = (file: File): 'image' | 'video' => {
    return file.type.startsWith('video/') ? 'video' : 'image';
  };

  const handleFileSelect = (file: File) => {
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

      onMediaSelected(publicUrl, getFileType(fileToUpload));
      
      toast({
        title: "Upload successful",
        description: `${getFileType(fileToUpload)} uploaded successfully`,
      });

      // Reset state
      setSelectedFile(null);
      setPreviewUrl(null);
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
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
        accept="video/*"
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
                  className="max-w-full h-auto max-h-64 rounded object-cover"
                />
              ) : (
                <video
                  src={previewUrl}
                  controls
                  className="max-w-full h-auto max-h-64 rounded"
                />
              )}
            </div>
          )}
          
          <div className="flex justify-between items-center text-sm text-muted-foreground mb-3">
            <span>{selectedFile.name}</span>
            <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
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