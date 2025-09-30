import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Users, Highlighter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRetroTheme } from '@/hooks/useRetroTheme';
import { RetroHighlightsSidebar } from './RetroHighlightsSidebar';
import { CollapsibleMemberList } from '@/components/CollapsibleMemberList';
import { usePresence } from '@/hooks/usePresence';

interface RetroHuddleLayoutProps {
  children: React.ReactNode;
  huddleId: string;
  teamName?: string;
  huddle?: any;
  messages?: any[];
  currentUserId?: string;
  className?: string;
}

export const RetroHuddleLayout: React.FC<RetroHuddleLayoutProps> = ({
  children,
  huddleId,
  teamName,
  huddle,
  messages = [],
  currentUserId,
  className
}) => {
  const [highlightsSidebarOpen, setHighlightsSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [highlights, setHighlights] = useState<any[]>([]);
  const theme = useRetroTheme(teamName);
  const { onlineMembers } = usePresence(huddleId);

  // Filter highlighted messages
  useEffect(() => {
    const highlightedMessages = messages.filter(msg => 
      msg.content?.includes('⭐') || 
      msg.is_highlighted ||
      msg.message_type === 'highlight'
    );
    setHighlights(highlightedMessages);
  }, [messages]);

  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-background via-background/95 to-team-primary/5",
      "font-arcade text-foreground relative overflow-hidden",
      className
    )}>
      {/* Retro Grid Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="retro-grid w-full h-full" />
      </div>
      
      {/* Scanlines Effect */}
      <div className="absolute inset-0 pointer-events-none retro-scanlines opacity-20" />
      
      {/* Main Layout */}
      <div className="relative z-10 flex h-screen">
        {/* Desktop Highlights Sidebar */}
        <AnimatePresence>
          {highlightsSidebarOpen && (
            <motion.div
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="hidden md:block w-80 border-r border-team-primary/30 bg-background/90 backdrop-blur-sm"
            >
              <RetroHighlightsSidebar
                highlights={highlights}
                onClose={() => setHighlightsSidebarOpen(false)}
                teamName={teamName}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="h-14 bg-team-primary/10 border-b border-team-primary/30 flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHighlightsSidebarOpen(!highlightsSidebarOpen)}
                className="hidden md:flex h-8 w-8 p-0 border border-team-primary/40 hover:bg-team-primary/20"
                title="Toggle Highlights"
              >
                <Highlighter className="w-4 h-4" />
              </Button>

              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden h-8 w-8 p-0 border border-team-primary/40 hover:bg-team-primary/20"
                  >
                    <Menu className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0 bg-background/95 backdrop-blur-sm">
                  <div className="h-full overflow-hidden">
                    <RetroHighlightsSidebar
                      highlights={highlights}
                      onClose={() => setMobileMenuOpen(false)}
                      teamName={teamName}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-team-secondary rounded-full animate-pulse" />
                <span className="font-orbitron font-bold text-team-primary">
                  {huddle?.name || 'Loading...'}
                </span>
                <span className="text-xs text-muted-foreground font-pixel">
                  {theme.mascot}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Online Members Count */}
              <div className="flex items-center gap-2 px-3 py-1 bg-team-primary/20 border border-team-primary/40 rounded-full">
                <Users className="w-4 h-4 text-team-primary" />
                <span className="text-sm font-pixel text-team-primary font-bold">
                  {onlineMembers.length}
                </span>
              </div>

              {/* Member List */}
              <CollapsibleMemberList huddleId={huddleId} />
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>

      {/* Mobile Highlights Sheet */}
      <Sheet>
        <SheetContent side="bottom" className="h-[80vh] bg-background/95 backdrop-blur-sm">
          <RetroHighlightsSidebar
            highlights={highlights}
            onClose={() => {}}
            teamName={teamName}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
};