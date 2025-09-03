import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface StartPickEmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  huddleId: string;
  onPickEmCreated: (instanceId: string) => void;
}

interface Week {
  id: string;
  league: 'nfl' | 'ncaaf';
  season_year: number;
  week_number: number;
  start_at: string;
  end_at: string;
}

interface Game {
  id: string;
  espn_game_id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  status: string;
}

export const StartPickEmDialog = ({ open, onOpenChange, huddleId, onPickEmCreated }: StartPickEmDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchWeeks();
    }
  }, [open]);

  useEffect(() => {
    if (selectedWeek) {
      fetchGames(selectedWeek);
    }
  }, [selectedWeek]);

  const fetchWeeks = async () => {
    try {
      const { data, error } = await supabase
        .from('pickem_weeks')
        .select('*')
        .gte('end_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(10);

      if (error) throw error;
      setWeeks(data || []);
      
      if (!data || data.length === 0) {
        toast({
          title: "No Weeks Available",
          description: "No game weeks found. Try syncing games from ESPN first in Pick 'Em settings.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching weeks:', error);
      toast({
        title: "Error",
        description: "Failed to load available weeks",
        variant: "destructive"
      });
    }
  };

  const fetchGames = async (weekId: string) => {
    try {
      const { data, error } = await supabase
        .from('pickem_games')
        .select('*')
        .eq('week_id', weekId)
        .eq('status', 'scheduled')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setGames(data || []);
      setSelectedGames([]);
    } catch (error) {
      console.error('Error fetching games:', error);
      toast({
        title: "Error", 
        description: "Failed to load games for selected week",
        variant: "destructive"
      });
    }
  };

  const handleGameToggle = (gameId: string) => {
    setSelectedGames(prev => 
      prev.includes(gameId) 
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    );
  };

  const handleSubmit = async () => {
    if (!selectedWeek || selectedGames.length === 0 || !title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a week, games, and provide a title",
        variant: "destructive"
      });
      return;
    }

    if (selectedGames.length < 3 || selectedGames.length > 15) {
      toast({
        title: "Invalid Selection",
        description: "Please select between 3 and 15 games",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Create pick'em instance
      const { data: instance, error: instanceError } = await supabase
        .from('pickem_instances')
        .insert({
          huddle_id: huddleId,
          week_id: selectedWeek,
          title: title.trim(),
          created_by: user?.id,
          status: 'open'
        })
        .select()
        .single();

      if (instanceError) throw instanceError;

      // Add selected games to instance
      const gameInserts = selectedGames.map(gameId => ({
        instance_id: instance.id,
        game_id: gameId
      }));

      const { error: gamesError } = await supabase
        .from('pickem_instance_games')
        .insert(gameInserts);

      if (gamesError) throw gamesError;

      // Post message to huddle with pick'em info
      const { error: messageError } = await supabase
        .from('huddle_messages')
        .insert({
          huddle_id: huddleId,
          user_id: user?.id,
          content: `🏈 ${title}`,
          message_type: 'pickem',
          poll_data: {
            type: 'pickem',
            instance_id: instance.id,
            title,
            game_count: selectedGames.length
          }
        });

      if (messageError) throw messageError;

      toast({
        title: "Pick 'Em Created!",
        description: `Successfully created "${title}" with ${selectedGames.length} games`,
      });

      onPickEmCreated(instance.id);
      onOpenChange(false);
      
      // Reset form
      setSelectedWeek("");
      setSelectedGames([]);
      setTitle("");
      
    } catch (error) {
      console.error('Error creating pick em:', error);
      toast({
        title: "Error",
        description: "Failed to create Pick 'Em",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedWeekData = weeks.find(w => w.id === selectedWeek);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Start Huddle Pick 'Em
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Pick 'Em Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Week 10 NFL Picks"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>Select Week</Label>
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a week" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((week) => (
                  <SelectItem key={week.id} value={week.id}>
                    {week.league.toUpperCase()} {week.season_year} - Week {week.week_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedWeekData && (
            <div className="text-sm text-muted-foreground">
              Week runs from {new Date(selectedWeekData.start_at).toLocaleDateString()} to {new Date(selectedWeekData.end_at).toLocaleDateString()}
            </div>
          )}

          {games.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Select Games (3-15 games)</Label>
                <span className="text-sm text-muted-foreground">
                  {selectedGames.length} selected
                </span>
              </div>
              
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {games.map((game) => (
                  <div key={game.id} className="flex items-center space-x-2 p-2 border rounded">
                    <Checkbox
                      id={game.id}
                      checked={selectedGames.includes(game.id)}
                      onCheckedChange={() => handleGameToggle(game.id)}
                    />
                    <label
                      htmlFor={game.id}
                      className="flex-1 text-sm cursor-pointer"
                    >
                      <div className="font-medium">
                        {game.away_team} @ {game.home_team}
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(game.start_time).toLocaleDateString()} at {new Date(game.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !selectedWeek || selectedGames.length === 0 || !title.trim()}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Pick 'Em
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};