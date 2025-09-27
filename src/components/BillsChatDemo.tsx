import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BillsBotCard } from './BillsBotCard';
import { ThreadView } from './ThreadView';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot' | 'you';
  user: {
    name: string;
    avatar?: string;
    jerseyNumber?: string;
  };
  content?: string;
  timestamp: string;
  botCard?: {
    type: 'highlight' | 'stat' | 'poll' | 'score';
    title: string;
    content: string;
    metadata?: any;
  };
  embeds?: any[];
}

const sampleMessages: ChatMessage[] = [
  {
    id: '1',
    type: 'user',
    user: { name: 'Chris', jerseyNumber: '#3', avatar: '/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png' },
    content: "Allen's arm is a cannon—over 300 easy! Who's with me? 🔥",
    timestamp: 'Q3 - 2:45'
  },
  {
    id: '2',
    type: 'you',
    user: { name: 'You' },
    content: "Bet, but watch for that Jets blitz. My parlay's riding on this! 💪",
    timestamp: 'Q3 - 2:43'
  },
  {
    id: '3',
    type: 'bot',
    user: { name: 'Bills Bot' },
    timestamp: 'Q3 - 2:40',
    botCard: {
      type: 'highlight',
      title: 'Touchdown! Josh scrambles 15yds',
      content: 'Full replay from @Bills',
      metadata: {
        reactions: 50,
        thumbnail: '/lovable-uploads/89d98004-873f-423c-983e-8f49264b77cf.png'
      }
    }
  },
  {
    id: '4',
    type: 'user',
    user: { name: 'Sarah', jerseyNumber: '#17' },
    content: "YESSSSS! That scramble was INSANE! Josh is literally unstoppable! 🦬⚡️",
    timestamp: 'Q3 - 2:38'
  },
  {
    id: '5',
    type: 'bot',
    user: { name: 'Bills Bot' },
    timestamp: 'Q3 - 2:35',
    botCard: {
      type: 'stat',
      title: 'Bills D holds Jets to 3pts',
      content: 'Incredible defensive performance this quarter. Poll: Next drive—punt or push?',
      metadata: {
        stats: [
          { label: 'Total Yards', value: '347' },
          { label: 'Turnovers', value: '2' }
        ]
      }
    }
  },
  {
    id: '6',
    type: 'user',
    user: { name: 'Mike', jerseyNumber: '#25' },
    content: "Defense looking ELITE today! This is our year, Bills Mafia! 🏆",
    timestamp: 'Q3 - 2:32'
  },
  {
    id: '7',
    type: 'bot',
    user: { name: 'Bills Bot' },
    timestamp: 'Q3 - 2:30',
    botCard: {
      type: 'poll',
      title: 'Quick Poll: MVP Performance',
      content: 'Who\'s having the biggest impact this game?',
      metadata: {
        poll: {
          question: 'Who\'s your game MVP so far?',
          options: ['Josh Allen', 'Von Miller', 'Stefon Diggs', 'Matt Milano']
        }
      }
    }
  }
];

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.type === 'user';
  const isYou = message.type === 'you';
  const isBot = message.type === 'bot';

  if (isBot && message.botCard) {
    return (
      <div className="w-full flex justify-center mb-6">
        <div className="max-w-md w-full">
          <BillsBotCard
            type={message.botCard.type}
            title={message.botCard.title}
            content={message.botCard.content}
            metadata={message.botCard.metadata}
          />
          <div className="text-center mt-2">
            <span className="text-xs text-muted-foreground font-mono">
              {message.timestamp}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const bubbleClasses = isYou 
    ? 'bg-primary text-primary-foreground rounded-br-sm' 
    : 'bg-accent text-accent-foreground rounded-bl-sm';

  return (
    <div className={`flex gap-3 mb-4 ${isYou ? 'flex-row-reverse' : ''}`}>
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarImage src={message.user.avatar} alt={message.user.name} />
        <AvatarFallback className={`${isYou ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}`}>
          {message.user.name.charAt(0)}
        </AvatarFallback>
      </Avatar>
      
      <div className={`flex flex-col ${isYou ? 'items-end' : 'items-start'} max-w-xs`}>
        <div className="flex items-center gap-2 mb-1">
          {!isYou && message.user.jerseyNumber && (
            <span className="text-xs text-accent font-mono font-bold">
              {message.user.jerseyNumber}
            </span>
          )}
          <span className="text-xs font-semibold">
            {message.user.name}
          </span>
        </div>
        
        <div className={`px-4 py-2 rounded-2xl max-w-full break-words ${bubbleClasses}`}>
          {message.content && (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </div>
          )}
          
          {message.embeds && message.embeds.length > 0 && (
            <ThreadView 
              content={message.content || ''} 
              embeds={message.embeds}
              className="mt-2"
            />
          )}
        </div>
        
        <span className="text-xs text-muted-foreground font-mono mt-1">
          {message.timestamp}
        </span>
      </div>
    </div>
  );
};

export const BillsChatDemo: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Bills Mafia Huddle</h1>
            <p className="text-sm text-muted-foreground">Live: Bills vs Jets • Q3 8:45</p>
          </div>
          <div className="bg-secondary/20 px-3 py-1 rounded-full">
            <span className="text-sm font-bold text-secondary">24-14</span>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {sampleMessages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {/* Chat Input */}
      <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center space-x-3 bg-muted/30 rounded-full px-4 py-3">
          <input 
            type="text" 
            placeholder="Drop your take on the game..." 
            className="flex-1 bg-transparent border-0 focus:outline-none text-sm placeholder:text-muted-foreground"
          />
          <button className="bg-primary text-primary-foreground rounded-full p-2 hover:bg-primary/90 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m22 2-7 20-4-9-9-4Z"/>
              <path d="M22 2 11 13"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};