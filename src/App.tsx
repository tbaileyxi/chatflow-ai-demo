import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { HelmetProvider } from "react-helmet-async";
import { useJoinRequestNotifications } from "@/hooks/useJoinRequestNotifications";
import Index from "./pages/Index";
import Home from "./pages/Home";
import { Admin } from "./pages/Admin";
import { Auth } from "./pages/Auth";
import { BillsChatDemo } from "./components/BillsChatDemo";
import { MobileProfile } from "./pages/MobileProfile";
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
import { HuddleSettings } from "./pages/HuddleSettings";
import { HuddleCoachSettings } from "./pages/HuddleCoachSettings";
import FAQ from "./pages/FAQ";
import { RetroDemo } from "./pages/RetroDemo";

const queryClient = new QueryClient();

const AppContent = () => {
  // Initialize global join request notifications
  useJoinRequestNotifications();

  // Use mobile-first layout for all routes now with retro theme
  return (
    <div className="min-h-screen w-full bg-background crt-effect">
      {/* Global retro background effects */}
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0 retro-grid"></div>
        <div className="absolute inset-0 retro-scanlines"></div>
      </div>
      
      <div className="relative flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/bills-demo" element={<BillsChatDemo />} />
          <Route path="/retro-demo" element={<RetroDemo />} />
          <Route path="/onboard" element={<MobileHome />} />
          <Route path="/app" element={<MobileHome />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<MobileProfile />} />
          <Route path="/teams" element={<TeamDirectory />} />
          <Route path="/teams/:teamId" element={<TeamFeed />} />
          <Route path="/huddle/:huddleId" element={<Huddle />} />
          <Route path="/huddle/:huddleId/settings" element={<HuddleSettings />} />
          <Route path="/huddle/:huddleId/coach-settings" element={<HuddleCoachSettings />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/join-huddle/:huddleId" element={<JoinHuddle />} />
          <Route path="/huddle-search" element={<HuddleSearch />} />
          <Route path="/spotlight" element={<MobileSpotlight />} />
          <Route path="/spotlight/:id" element={<SpotlightPost />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
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
              <AppContent />
            </BrowserRouter>
          </HelmetProvider>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
