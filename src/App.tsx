import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MessageSquare, MessageSquareMore } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useHuddleStatus } from "@/hooks/useHuddleStatus";
import { HelmetProvider } from "react-helmet-async";
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
import { HuddleSearch } from "./pages/HuddleSearch";
import NotFound from "./pages/NotFound";
import { MobileHome } from "./pages/MobileHome";
import { MobileSpotlight } from "./pages/MobileSpotlight";
import { MobileChat } from "./pages/MobileChat";

const queryClient = new QueryClient();

const AppContent = () => {
  const { toggleSidebar } = useSidebar();
  const { user } = useAuth();
  const navigate = useNavigate();
  const onlineStatus = useHuddleStatus();

  // Check if we're on a mobile route
  const location = window.location.pathname;
  const isMobileRoute = ['/app', '/spotlight', '/huddle/', '/onboard'].some(route => 
    location.startsWith(route)
  );

  // For mobile routes, show without sidebar
  if (isMobileRoute) {
    return (
      <div className="min-h-screen w-full bg-mobile-background">
        <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/onboard" element={<Index />} />
          <Route path="/app" element={<MobileHome />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/teams" element={<TeamDirectory />} />
          <Route path="/teams/:teamId" element={<TeamFeed />} />
          <Route path="/huddle/:huddleId" element={<MobileChat />} />
          <Route path="/join-huddle/:huddleId" element={<JoinHuddle />} />
          <Route path="/huddle-search" element={<HuddleSearch />} />
          <Route path="/spotlight" element={<MobileSpotlight />} />
          <Route path="/spotlight/:id" element={<SpotlightPost />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
      </div>
    );
  }

  // Desktop sidebar layout for other routes
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
        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/onboard" element={<Index />} />
            <Route path="/app" element={<MobileHome />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/teams" element={<TeamDirectory />} />
            <Route path="/teams/:teamId" element={<TeamFeed />} />
            <Route path="/huddle/:huddleId" element={<MobileChat />} />
            <Route path="/join-huddle/:huddleId" element={<JoinHuddle />} />
            <Route path="/huddle-search" element={<HuddleSearch />} />
            <Route path="/spotlight" element={<MobileSpotlight />} />
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
    <AuthProvider>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <TooltipProvider>
          <HelmetProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <SidebarProvider>
                <AppContent />
              </SidebarProvider>
            </BrowserRouter>
          </HelmetProvider>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
