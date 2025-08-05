import { useState } from "react";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfileSetupProps {
  onComplete: () => void;
}

// Default avatar options
const defaultAvatars = [
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1535268647677-300dbf307b8d?w=100&h=100&fit=crop&crop=face", 
  "https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1441057206919-63d19fac2369?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1501286353178-1ec881214838?w=100&h=100&fit=crop&crop=face"
];

export const ProfileSetup = ({ onComplete }: ProfileSetupProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(defaultAvatars[0]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setSelectedAvatar(data.publicUrl);
      
      toast({
        title: "Avatar uploaded successfully!",
        description: "Your new avatar has been set.",
      });
    } catch (error: any) {
      toast({
        title: "Error uploading avatar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast({
        title: "Display name required",
        description: "Please enter a display name to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user?.id,
          display_name: displayName.trim(),
          avatar_url: selectedAvatar,
        });

      if (error) throw error;

      toast({
        title: "Profile created!",
        description: "Welcome to Side Huddle Sports!",
      });

      onComplete();
    } catch (error: any) {
      toast({
        title: "Error creating profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Side Huddle!</CardTitle>
          <CardDescription>
            Let's set up your profile to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Selection */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Choose Your Avatar</Label>
            <div className="flex items-center justify-center">
              <Avatar className="h-20 w-20">
                <AvatarImage src={selectedAvatar} alt="Selected avatar" />
                <AvatarFallback>{displayName ? displayName[0]?.toUpperCase() : "?"}</AvatarFallback>
              </Avatar>
            </div>
            
            {/* Default avatar options */}
            <div className="grid grid-cols-5 gap-2">
              {defaultAvatars.map((avatar, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`rounded-full p-1 transition-all ${
                    selectedAvatar === avatar 
                      ? "ring-2 ring-primary ring-offset-2" 
                      : "hover:ring-2 hover:ring-muted ring-offset-2"
                  }`}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={avatar} alt={`Avatar option ${index + 1}`} />
                    <AvatarFallback>A{index + 1}</AvatarFallback>
                  </Avatar>
                </button>
              ))}
            </div>

            {/* Upload custom avatar */}
            <div className="flex justify-center">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button variant="outline" size="sm" disabled={uploading} asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Uploading..." : "Upload Custom"}
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="Enter your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>

          <Button 
            onClick={handleSave} 
            disabled={loading || !displayName.trim()}
            className="w-full"
          >
            {loading ? "Creating Profile..." : "Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};