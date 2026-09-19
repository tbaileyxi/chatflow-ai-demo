import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, User, Mail, Phone, FileText, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FoundingBadge, FoundingCheckmark } from '@/components/founding';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface UserProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  phone_number: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_founding_member?: boolean;
  founding_tier?: 'charter' | 'founding' | null;
  founding_spot_number?: number | null;
  verified_huddle_promo_code?: string | null;
}

export const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [verifyingPurchase, setVerifyingPurchase] = useState(false);

  // Check for founding=success URL param and poll for status
  useEffect(() => {
    const foundingSuccess = searchParams.get('founding');
    const sessionId = searchParams.get('session_id');
    
    if (foundingSuccess === 'success' && sessionId && user) {
      setVerifyingPurchase(true);
      let attempts = 0;
      const maxAttempts = 10; // 15 seconds total (1.5s * 10)
      
      const pollForFoundingStatus = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('is_founding_member, founding_tier, founding_spot_number, verified_huddle_promo_code')
          .eq('user_id', user.id)
          .single();
        
        if (data?.is_founding_member) {
          // Success! Update profile and show toast
          setProfile(prev => prev ? { ...prev, ...data, founding_tier: data.founding_tier as 'charter' | 'founding' | null } : null);
          setVerifyingPurchase(false);
          toast({
            title: "Welcome to the Founding 300! 🎉",
            description: `You're Spot #${data.founding_spot_number}. Check your email for your promo code!`,
          });
          // Clear URL params
          navigate('/profile', { replace: true });
          return true;
        }
        return false;
      };
      
      const interval = setInterval(async () => {
        attempts++;
        const found = await pollForFoundingStatus();
        
        if (found || attempts >= maxAttempts) {
          clearInterval(interval);
          if (!found) {
            setVerifyingPurchase(false);
            toast({
              title: "Still processing...",
              description: "Your purchase is being verified. Please refresh in a moment.",
            });
            navigate('/profile', { replace: true });
          }
        }
      }, 1500);
      
      // Initial check immediately
      pollForFoundingStatus();
      
      return () => clearInterval(interval);
    }
  }, [searchParams, user, navigate, toast]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, username, avatar_url, bio, status, created_at, updated_at, onboarding_completed, is_founding_member, founding_tier, founding_spot_number, has_lifetime_verified_huddle_code, verified_huddle_promo_code, is_premium, premium_since, premium_expires_at')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      // phone_number is not readable off profiles (the public key could read
      // the whole table); your own comes back from an auth-scoped function.
      const { data: priv } = await (supabase.rpc as any)('my_private_profile');
      const privRow = Array.isArray(priv) ? priv[0] : priv;
      if (data) {
        setProfile({
          ...data,
          phone_number: privRow?.phone_number ?? null,
          founding_tier: data.founding_tier as 'charter' | 'founding' | null
        });
      } else {
        // Create a default profile if none exists
        const defaultProfile = {
          user_id: user?.id || '',
          display_name: user?.email?.split('@')[0] || '',
          username: user?.email?.split('@')[0] || '',
          phone_number: null,
          bio: null,
          avatar_url: null
        };
        setProfile(defaultProfile);
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${user?.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      setProfile(prev => prev ? { ...prev, avatar_url: data.publicUrl } : null);

      toast({
        title: "Success",
        description: "Avatar uploaded successfully"
      });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Error",
        description: "Failed to upload avatar",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!profile || !user) return;

    setSaving(true);
    try {
      // Fetch current profile to check if username changed
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', user.id)
        .single();

      const usernameChanged = currentProfile?.username !== profile.username;

      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            display_name: profile.display_name,
            username: profile.username,
            phone_number: profile.phone_number,
            bio: profile.bio,
            avatar_url: profile.avatar_url
          },
          {
            onConflict: 'user_id'
          }
        );

      if (error) {
        if (usernameChanged && error.message?.includes('username') && error.message?.includes('unique')) {
          throw new Error('Username is already taken. Please choose a different one.');
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Profile updated successfully"
      });
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background crt-effect flex items-center justify-center">
        <div className="text-muted-foreground font-arcade">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background crt-effect flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertDescription>Profile not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background crt-effect p-4">
      {/* Verifying Purchase Overlay */}
      {verifyingPurchase && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-yellow-400 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Verifying your founding membership...</h2>
            <p className="text-muted-foreground">This usually takes just a few seconds</p>
          </div>
        </div>
      )}
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0 retro-grid"></div>
        <div className="absolute inset-0 retro-scanlines"></div>
      </div>
      <div className="relative">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Founding Member Banner */}
            {profile.is_founding_member && (
              <div className="mb-4 p-4 rounded-lg border-2 border-yellow-400 bg-gradient-to-r from-yellow-400/10 to-amber-500/10">
                <div className="flex items-center gap-2 text-yellow-400 font-bold">
                  <FoundingCheckmark size="md" />
                  <span>Founding Member 2025 – Spot #{profile.founding_spot_number} locked in forever</span>
                </div>
                {profile.verified_huddle_promo_code && (
                  <div className="mt-3 p-3 rounded-lg bg-background/80 border border-yellow-400/30">
                    <div className="text-xs text-muted-foreground mb-1">Your Lifetime Hosted Huddle Code:</div>
                    <div className="flex items-center gap-2">
                      <code className="text-yellow-400 font-mono text-lg">{profile.verified_huddle_promo_code}</code>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(profile.verified_huddle_promo_code || '');
                          toast({ title: "Copied!", description: "Promo code copied to clipboard" });
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Use when creating a Hosted Huddle • Never expires</p>
                  </div>
                )}
              </div>
            )}

            {/* Avatar Section */}
            <div className="flex items-center gap-4">
              <FoundingBadge tier={profile.founding_tier} size="lg">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback>
                    {profile.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </FoundingBadge>
              <div>
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <Button variant="outline" disabled={uploading} asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? 'Uploading...' : 'Upload Avatar'}
                    </span>
                  </Button>
                </Label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              </div>
            </div>

            {/* Profile Fields */}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={profile.display_name || ''}
                  onChange={(e) => setProfile(prev => prev ? { ...prev, display_name: e.target.value } : null)}
                  placeholder="Enter your display name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={profile.username || ''}
                  onChange={(e) => setProfile(prev => prev ? { ...prev, username: e.target.value } : null)}
                  placeholder="Enter your username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed here. Contact support if needed.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number</Label>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone_number"
                    value={profile.phone_number || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, phone_number: e.target.value } : null)}
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground mt-2" />
                  <Textarea
                    id="bio"
                    value={profile.bio || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, bio: e.target.value } : null)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
};