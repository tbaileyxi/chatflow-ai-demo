import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MessageSquare, MessageSquareMore } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import { Landing } from "./pages/Landing";
import { Admin } from "./pages/Admin";
import { Auth } from "./pages/Auth";
import { Profile } from "./pages/Profile";
import { TeamDirectory } from "./pages/TeamDirectory";
import { TeamFeed } from "./pages/TeamFeed";
import { Huddle } from "./pages/Huddle";
import { JoinHuddle } from "./pages/JoinHuddle";
import { SpotlightPost } from "./pages/SpotlightPost";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { toggleSidebar } = useSidebar();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [onlineStatus, setOnlineStatus] = useState({ totalMembers: 0, onlineMembers: 0, hasUnread: false });

  useEffect(() => {
    if (!user) return;

    const fetchOnlineStatus = async () => {
      try {
        const { data: memberData } = await supabase
          .from('huddle_members')
          .select(`
            huddle:huddles(id, name, owner_id),
            last_read_at
          `)
          .eq('user_id', user.id);

        if (!memberData?.length) {
          setOnlineStatus({ totalMembers: 0, onlineMembers: 0, hasUnread: false });
          return;
        }

        let totalMembers = 0;
        let othersOnlineCount = 0;
        let hasUnread = false;

        for (const member of memberData) {
          const { data: huddleMembers } = await supabase
            .from('huddle_members')
            .select('user_id')
            .eq('huddle_id', member.huddle.id);

          const cutoffTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
          const { data: onlineProfiles } = await supabase
            .from('profiles')
            .select('user_id')
            .in('user_id', huddleMembers?.map(m => m.user_id) || [])
            .gte('last_login_at', cutoffTime);

          const { count: unreadCount } = await supabase
            .from('huddle_messages')
            .select('*', { count: 'exact', head: true })
            .eq('huddle_id', member.huddle.id)
            .gt('created_at', member.last_read_at || '1970-01-01');

          const huddleOnlineCount = onlineProfiles?.length || 0;
          const othersOnline = Math.max(0, huddleOnlineCount - (onlineProfiles?.some(p => p.user_id === user.id) ? 1 : 0));

          totalMembers += huddleMembers?.length || 0;
          othersOnlineCount += othersOnline;
          if ((unreadCount || 0) > 0) hasUnread = true;
        }

        setOnlineStatus({ totalMembers, onlineMembers: othersOnlineCount, hasUnread });
      } catch (error) {
        console.error('Error fetching online status:', error);
      }
    };

    // Listen for custom event when huddle is read
    const handleHuddleRead = () => {
      fetchOnlineStatus();
    };

    fetchOnlineStatus();
    const interval = setInterval(fetchOnlineStatus, 30000);
    window.addEventListener('huddleRead', handleHuddleRead);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('huddleRead', handleHuddleRead);
    };
  }, [user]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <SidebarTrigger className="ml-2" />
          <div className="ml-4 flex-1 flex items-center gap-3">
            <button 
              onClick={() => navigate('/app')}
              className="text-lg font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Side Huddle
            </button>
            <button
              onClick={toggleSidebar}
              className={`relative flex items-center gap-2 px-2 py-1 rounded-md border transition-colors
                ${onlineStatus.hasUnread 
                  ? 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/30' 
                  : onlineStatus.onlineMembers > 0
                  ? 'bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30'
                  : 'text-muted-foreground hover:text-foreground border-border'}
              `}
              title="Open Chat"
            >
              <MessageSquare className={`w-4 h-4 ${onlineStatus.hasUnread ? 'text-yellow-600' : onlineStatus.onlineMembers > 0 ? 'text-green-600' : ''}`} />
              <span className="hidden sm:inline">Chat</span>
              {onlineStatus.hasUnread && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-hidden">{/* Overflow container */}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<Index />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/teams" element={<TeamDirectory />} />
          <Route path="/teams/:teamId" element={<TeamFeed />} />
          <Route path="/huddle/:id" element={<Huddle />} />
          <Route path="/join-huddle/:huddleId" element={<JoinHuddle />} />
          <Route path="/spotlight/:id" element={<SpotlightPost />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
      </main>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SidebarProvider>
            <AppContent />
          </SidebarProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
