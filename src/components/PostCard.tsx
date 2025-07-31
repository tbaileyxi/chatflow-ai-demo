import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heart, Flame, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PostCardProps {
  post: {
    id: string;
    content: string;
    media_url?: string;
    created_at: string;
    team: {
      id: string;
      name: string;
      logo_url?: string;
    };
    post_reactions: Array<{
      reaction_type: string;
    }>;
  };
  isSpotlight?: boolean;
}

export const PostCard = ({ post, isSpotlight = false }: PostCardProps) => {
  const [reactions, setReactions] = useState(post.post_reactions);

  const likeCount = reactions.filter(r => r.reaction_type === 'like').length;
  const fireCount = reactions.filter(r => r.reaction_type === 'fire').length;

  const handleReaction = async (type: 'like' | 'fire') => {
    // TODO: Implement reaction logic with user authentication
    console.log(`${type} reaction on post ${post.id}`);
  };

  return (
    <Card className={`p-4 border-0 border-b border-border rounded-none ${isSpotlight ? 'bg-gradient-to-r from-spotlight/10 to-transparent' : ''}`}>
      {/* Team Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          {post.team.logo_url ? (
            <img src={post.team.logo_url} alt={post.team.name} className="w-8 h-8 rounded-full" />
          ) : (
            <span className="text-primary font-bold text-sm">
              {post.team.name.substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{post.team.name}</h3>
            <span className="text-xs text-primary font-medium">AGENT</span>
            {isSpotlight && (
              <span className="text-xs bg-spotlight text-primary-foreground px-2 py-1 rounded-full font-medium">
                SPOTLIGHT
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Post Content */}
      <div className="mb-3">
        <p className="text-foreground leading-relaxed">{post.content}</p>
        {post.media_url && (
          <div className="mt-3 rounded-lg overflow-hidden">
            <img src={post.media_url} alt="Post media" className="w-full h-auto" />
          </div>
        )}
      </div>

      {/* Reaction Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleReaction('like')}
            className="flex items-center gap-2 text-like-button hover:text-like-button hover:bg-like-button/10"
          >
            <Heart className="w-4 h-4" />
            <span className="text-sm">{likeCount}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleReaction('fire')}
            className="flex items-center gap-2 text-fire-button hover:text-fire-button hover:bg-fire-button/10"
          >
            <Flame className="w-4 h-4" />
            <span className="text-sm">{fireCount}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm">Reply</span>
          </Button>
        </div>
      </div>
    </Card>
  );
};