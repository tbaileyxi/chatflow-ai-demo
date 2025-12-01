import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Trophy, Upload, X } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  city: string;
  league: string;
  conference: string;
  division: string;
  description?: string;
  logo_url?: string;
  stats: any;
  status: string;
  sponsor?: string;
  sponsor_url?: string;
  created_at: string;
}

export const TeamManagement = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [waitlistCounts, setWaitlistCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    league: 'NFL',
    conference: '',
    division: '',
    description: '',
    logo_url: '',
    status: 'active',
    sponsor: '',
    sponsor_url: '',
    featured_order: 999
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchTeams();
    fetchWaitlistCounts();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('league', { ascending: true })
        .order('city', { ascending: true });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: "Error",
        description: "Failed to load teams",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWaitlistCounts = async () => {
    try {
      // Fetch waitlist counts
      const { data: waitlistData, error: waitlistError } = await supabase
        .from('team_waitlist')
        .select('team_id');

      if (waitlistError) throw waitlistError;
      
      // Fetch follower counts
      const { data: followerData, error: followerError } = await supabase
        .from('user_follows')
        .select('team_id');

      if (followerError) throw followerError;
      
      const counts: Record<string, number> = {};
      
      // Count waitlist entries for coming_soon teams
      waitlistData?.forEach(entry => {
        const team = teams.find(t => t.id === entry.team_id);
        if (team?.status === 'coming_soon') {
          counts[entry.team_id] = (counts[entry.team_id] || 0) + 1;
        }
      });
      
      // Count followers for active teams
      followerData?.forEach(entry => {
        const team = teams.find(t => t.id === entry.team_id);
        if (team?.status === 'active') {
          counts[entry.team_id] = (counts[entry.team_id] || 0) + 1;
        }
      });
      
      setWaitlistCounts(counts);
    } catch (error) {
      console.error('Error fetching counts:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form data being submitted:', formData);
    
    try {
      if (editingTeam) {
        console.log('Updating team with ID:', editingTeam.id);
        const { data, error } = await supabase
          .from('teams')
          .update(formData)
          .eq('id', editingTeam.id)
          .select();

        console.log('Update result:', { data, error });
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Team updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('teams')
          .insert(formData);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Team added successfully",
        });
      }

      setFormData({
        name: '',
        city: '',
        league: 'NFL',
        conference: '',
        division: '',
        description: '',
        logo_url: '',
        status: 'active',
        sponsor: '',
        sponsor_url: '',
        featured_order: 999
      });
      setIsAddDialogOpen(false);
      setEditingTeam(null);
      fetchTeams();
    } catch (error) {
      console.error('Error saving team:', error);
      toast({
        title: "Error",
        description: "Failed to save team",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      city: team.city,
      league: team.league,
      conference: team.conference,
      division: team.division,
      description: team.description || '',
      logo_url: team.logo_url || '',
      status: team.status || 'active',
      sponsor: team.sponsor || '',
      sponsor_url: team.sponsor_url || '',
      featured_order: (team as any).featured_order || 999
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Team deleted successfully",
      });
      
      fetchTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      city: '',
      league: 'NFL',
      conference: '',
      division: '',
      description: '',
      logo_url: '',
      status: 'active',
      sponsor: '',
      sponsor_url: '',
      featured_order: 999
    });
    setEditingTeam(null);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image must be less than 5MB",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `team-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('broadcast-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('broadcast-media')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, logo_url: data.publicUrl }));
      
      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    setFormData(prev => ({ ...prev, logo_url: '' }));
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">Loading teams...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-muted-foreground">Manage NFL and NCAA teams</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTeam ? 'Edit Team' : 'Add New Team'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                   <Label htmlFor="league">League</Label>
                   <Select value={formData.league} onValueChange={(value) => 
                     setFormData(prev => ({ ...prev, league: value }))
                   }>
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="NFL">NFL</SelectItem>
                       <SelectItem value="NCAA">NCAA</SelectItem>
                       <SelectItem value="NBA">NBA</SelectItem>
                       <SelectItem value="MLB">MLB</SelectItem>
                       <SelectItem value="NHL">NHL</SelectItem>
                       <SelectItem value="MLS">MLS</SelectItem>
                       <SelectItem value="WNBA">WNBA</SelectItem>
                       <SelectItem value="Premier League">Premier League</SelectItem>
                       <SelectItem value="Other">Other</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="coming_soon">Coming Soon</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="featured_order">Trending Priority</Label>
                  <Input
                    id="featured_order"
                    type="number"
                    min="1"
                    max="999"
                    value={formData.featured_order}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      featured_order: parseInt(e.target.value) || 999 
                    }))}
                    placeholder="1-999"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower = higher priority in Trending. Set 1-10 for featured teams. Default 999 = not featured.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conference">Conference</Label>
                  <Input
                    id="conference"
                    value={formData.conference}
                    onChange={(e) => setFormData(prev => ({ ...prev, conference: e.target.value }))}
                    placeholder={formData.league === 'NFL' ? 'AFC/NFC' : 'SEC/Big Ten/etc'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="division">Division</Label>
                  <Input
                    id="division"
                    value={formData.division}
                    onChange={(e) => setFormData(prev => ({ ...prev, division: e.target.value }))}
                    placeholder={formData.league === 'NFL' ? 'East/West/etc' : 'East/West/etc'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Team Logo</Label>
                <div className="space-y-3">
                  {formData.logo_url ? (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <img 
                        src={formData.logo_url} 
                        alt="Team logo preview" 
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Logo uploaded</p>
                        <p className="text-xs text-muted-foreground">Click remove to change</p>
                      </div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={removeLogo}
                      >
                        <X className="w-4 h-4" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload a team logo (JPG, PNG, max 5MB)
                      </p>
                      <label className="relative inline-block cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={uploading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button type="button" disabled={uploading} className="pointer-events-none">
                          {uploading ? 'Uploading...' : 'Choose File'}
                        </Button>
                      </label>
                    </div>
                  )}
                  
                  <div className="text-center text-xs text-muted-foreground">
                    OR
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="logo_url">Logo URL</Label>
                    <Input
                      id="logo_url"
                      value={formData.logo_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Team description..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sponsor">Sponsor (Optional)</Label>
                <Input
                  id="sponsor"
                  value={formData.sponsor}
                  onChange={(e) => setFormData(prev => ({ ...prev, sponsor: e.target.value }))}
                  placeholder="e.g., Johnnie O, Nike, etc."
                />
                <p className="text-xs text-muted-foreground">
                  Company name that will appear as "sponsored by: [company name]" on agent posts
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sponsor_url">Sponsor Hyperlink (Optional)</Label>
                <Input
                  id="sponsor_url"
                  value={formData.sponsor_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, sponsor_url: e.target.value }))}
                  placeholder="https://..."
                />
                <p className="text-xs text-muted-foreground">
                  URL to make the sponsor name clickable (requires sponsor name to be filled)
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTeam ? 'Update Team' : 'Add Team'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{team.city} {team.name}</CardTitle>
                     <div className="flex gap-2 mt-1">
                      <Badge variant="secondary">{team.league}</Badge>
                      {team.conference && (
                        <Badge variant="outline">{team.conference}</Badge>
                      )}
                      <Badge variant={team.status === 'active' ? 'default' : team.status === 'coming_soon' ? 'secondary' : 'destructive'}>
                        {team.status === 'active' ? 'Active' : team.status === 'coming_soon' ? 'Coming Soon' : 'Inactive'}
                      </Badge>
                      {(team as any).featured_order && (team as any).featured_order < 100 && (
                        <Badge variant="outline" className="border-orange-500 text-orange-500">
                          🔥 Featured #{(team as any).featured_order}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(team)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(team.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {team.division && (
                <p className="text-sm text-muted-foreground mb-2">
                  {team.conference} {team.division}
                </p>
              )}
              {team.description && (
                <p className="text-sm text-muted-foreground mb-2">{team.description}</p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {team.status === 'coming_soon' ? 'Waitlist:' : 'Followers:'}
                </span>
                <Badge variant="outline">
                  {waitlistCounts[team.id] || 0} users
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};