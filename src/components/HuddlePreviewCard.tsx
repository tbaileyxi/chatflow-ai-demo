import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HuddlePreviewCardProps {
  huddle: {
    id: string;
    name: string;
    member_count: number;
    is_verified: boolean;
    is_official_team_huddle: boolean;
    team?: {
      logo_url: string | null;
      name: string;
    };
  };
}

export const HuddlePreviewCard = ({ huddle }: HuddlePreviewCardProps) => {
  const navigate = useNavigate();

  return (
    <Card 
      className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/40 bg-card"
      onClick={() => navigate(`/huddle/${huddle.id}`)}
    >
      <div className="flex flex-col items-center space-y-4">
        {/* Team Logo */}
        <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center">
          {huddle.team?.logo_url ? (
            <img 
              src={huddle.team.logo_url} 
              alt={huddle.team.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Users className="w-8 h-8 text-muted-foreground" />
          )}
        </div>

        {/* Huddle Name */}
        <div className="text-center space-y-1">
          <h3 className="font-bold text-foreground line-clamp-1">{huddle.name}</h3>
          
          {/* Badge */}
          <div className="flex justify-center">
            {huddle.is_verified || huddle.is_official_team_huddle ? (
              <Badge variant="default" className="gap-1">
                <BadgeCheck className="w-3 h-3" />
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary">Public</Badge>
            )}
          </div>
        </div>

        {/* Member Count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{huddle.member_count || 0} {huddle.member_count === 1 ? 'fan' : 'fans'}</span>
        </div>

        {/* View Button */}
        <Button 
          variant="outline" 
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/huddle/${huddle.id}`);
          }}
        >
          View
        </Button>
      </div>
    </Card>
  );
};
