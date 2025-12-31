import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit2, Radio, Clock, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Team {
  id: string;
  name: string;
  city: string;
  logo_url: string | null;
}

interface LiveEvent {
  id: string;
  name: string;
  subtitle: string | null;
  start_time: string;
  network: string | null;
  status: 'upcoming' | 'live' | 'completed';
  is_pinned: boolean;
  score_team1: number | null;
  score_team2: number | null;
  team1_id: string | null;
  team2_id: string | null;
  created_at: string;
}

export const LiveEventsManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LiveEvent | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    subtitle: '',
    start_time: '',
    network: '',
    status: 'upcoming' as 'upcoming' | 'live' | 'completed',
    is_pinned: true,
    score_team1: '',
    score_team2: '',
    team1_id: '',
    team2_id: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: eventsData } = await supabase
        .from('live_events')
        .select('*')
        .order('start_time', { ascending: false });

      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name, city, logo_url')
        .eq('status', 'active')
        .order('name');

      setEvents((eventsData as unknown as LiveEvent[]) || []);
      setTeams(teamsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      name: '',
      subtitle: '',
      start_time: '',
      network: '',
      status: 'upcoming',
      is_pinned: true,
      score_team1: '',
      score_team2: '',
      team1_id: '',
      team2_id: '',
    });
    setEditingEvent(null);
  };

  const handleEdit = (event: LiveEvent) => {
    setEditingEvent(event);
    setFormData({
      name: event.name,
      subtitle: event.subtitle || '',
      start_time: new Date(event.start_time).toISOString().slice(0, 16),
      network: event.network || '',
      status: event.status,
      is_pinned: event.is_pinned,
      score_team1: event.score_team1?.toString() || '',
      score_team2: event.score_team2?.toString() || '',
      team1_id: event.team1_id || '',
      team2_id: event.team2_id || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const eventData = {
        name: formData.name,
        subtitle: formData.subtitle || null,
        start_time: new Date(formData.start_time).toISOString(),
        network: formData.network || null,
        status: formData.status,
        is_pinned: formData.is_pinned,
        score_team1: formData.score_team1 ? parseInt(formData.score_team1) : null,
        score_team2: formData.score_team2 ? parseInt(formData.score_team2) : null,
        team1_id: formData.team1_id || null,
        team2_id: formData.team2_id || null,
        created_by: user.id,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('live_events')
          .update(eventData)
          .eq('id', editingEvent.id);

        if (error) throw error;
        toast({ title: 'Event updated successfully' });
      } else {
        const { error } = await supabase
          .from('live_events')
          .insert(eventData);

        if (error) throw error;
        toast({ title: 'Event created successfully' });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({ title: 'Error saving event', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase
        .from('live_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Event deleted' });
      fetchData();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({ title: 'Error deleting event', variant: 'destructive' });
    }
  };

  const toggleStatus = async (event: LiveEvent, newStatus: 'upcoming' | 'live' | 'completed') => {
    try {
      const { error } = await supabase
        .from('live_events')
        .update({ status: newStatus })
        .eq('id', event.id);

      if (error) throw error;
      toast({ title: `Event marked as ${newStatus}` });
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live': return <Radio className="h-4 w-4 text-red-500 animate-pulse" />;
      case 'upcoming': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live': return <Badge variant="destructive">LIVE</Badge>;
      case 'upcoming': return <Badge variant="secondary">Upcoming</Badge>;
      case 'completed': return <Badge variant="outline">Completed</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Live Events</h2>
          <p className="text-muted-foreground">Manage featured live events on the home screen</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Event Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="#2 Ohio State vs. #10 Miami (Fla.)"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="subtitle">Subtitle / Bowl Name</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Cotton Bowl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="network">Network</Label>
                  <Input
                    id="network"
                    value={formData.network}
                    onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                    placeholder="ESPN"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="team1">Team 1 (optional)</Label>
                  <Select value={formData.team1_id} onValueChange={(v) => setFormData({ ...formData, team1_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.city} {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="team2">Team 2 (optional)</Label>
                  <Select value={formData.team2_id} onValueChange={(v) => setFormData({ ...formData, team2_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.city} {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v: 'upcoming' | 'live' | 'completed') => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.status === 'live' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="score_team1">Score Team 1</Label>
                    <Input
                      id="score_team1"
                      type="number"
                      value={formData.score_team1}
                      onChange={(e) => setFormData({ ...formData, score_team1: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="score_team2">Score Team 2</Label>
                    <Input
                      id="score_team2"
                      type="number"
                      value={formData.score_team2}
                      onChange={(e) => setFormData({ ...formData, score_team2: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  id="is_pinned"
                  checked={formData.is_pinned}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_pinned: checked })}
                />
                <Label htmlFor="is_pinned">Pin to Home Screen</Label>
              </div>

              <Button type="submit" className="w-full">
                {editingEvent ? 'Update Event' : 'Create Event'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading events...</div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No live events yet. Create one to feature it on the home screen.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(event.status)}
                      {getStatusBadge(event.status)}
                      {event.is_pinned && <Badge variant="outline" className="text-xs">Pinned</Badge>}
                      {event.network && <span className="text-xs text-muted-foreground">{event.network}</span>}
                    </div>
                    <h3 className="font-semibold text-lg">{event.name}</h3>
                    {event.subtitle && <p className="text-sm text-muted-foreground">{event.subtitle}</p>}
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(event.start_time).toLocaleString()}
                    </p>
                    {event.status === 'live' && event.score_team1 !== null && (
                      <p className="text-xl font-bold text-primary mt-2">
                        {event.score_team1} - {event.score_team2}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(event)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(event.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {event.status !== 'live' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatus(event, 'live')}
                        className="text-red-500 border-red-500 hover:bg-red-500/10"
                      >
                        <Radio className="h-3 w-3 mr-1" />
                        Go Live
                      </Button>
                    )}
                    {event.status === 'live' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatus(event, 'completed')}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        End
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
