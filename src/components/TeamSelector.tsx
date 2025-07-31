import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  logo_url?: string;
  city: string;
  conference: string;
}

interface TeamSelectorProps {
  onTeamsUpdated: (teamIds: string[]) => void;
  className?: string;
}

export const TeamSelector = ({ onTeamsUpdated, className }: TeamSelectorProps) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data: teams, error } = await supabase
        .from("teams")
        .select("*")
        .order("name");

      if (error) throw error;
      setTeams(teams || []);
    } catch (error) {
      console.error("Error fetching teams:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTeam = (teamId: string) => {
    const newSelection = selectedTeams.includes(teamId)
      ? selectedTeams.filter(id => id !== teamId)
      : [...selectedTeams, teamId];
    
    setSelectedTeams(newSelection);
    onTeamsUpdated(newSelection);
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading teams...</div>;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Follow Your Teams</h3>
        <p className="text-sm text-muted-foreground">Select teams to see their agent updates</p>
      </div>
      
      <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
        {teams.map((team) => (
          <Card
            key={team.id}
            className={cn(
              "p-3 cursor-pointer transition-colors border hover:border-primary/50",
              selectedTeams.includes(team.id) 
                ? "border-primary bg-primary/10" 
                : "border-border"
            )}
            onClick={() => toggleTeam(team.id)}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                {team.logo_url ? (
                  <img src={team.logo_url} alt={team.name} className="w-6 h-6 rounded-full" />
                ) : (
                  <span className="text-primary font-bold text-xs">
                    {team.name.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{team.city}</p>
                <p className="text-xs text-muted-foreground truncate">{team.name}</p>
              </div>
              {selectedTeams.includes(team.id) && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </div>
          </Card>
        ))}
      </div>

      {selectedTeams.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Following {selectedTeams.length} team{selectedTeams.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};