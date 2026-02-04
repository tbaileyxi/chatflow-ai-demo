import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { HelmetProvider } from "react-helmet-async";
import { useJoinRequestNotifications } from "@/hooks/useJoinRequestNotifications";
import { DevBanner } from "@/components/debug/DevBanner";
import Index from "./pages/Index";
import Home from "./pages/Home";
import { Admin } from "./pages/Admin";
import { Auth } from "./pages/Auth";
import { BillsChatDemo } from "./components/BillsChatDemo";
import { MobileProfile } from "./pages/MobileProfile";
import { TeamFeed } from "./pages/TeamFeed";
import { Huddle } from "./pages/Huddle";
import { JoinHuddle } from "./pages/JoinHuddle";
import { HuddleSearch } from "./pages/HuddleSearch";
import NotFound from "./pages/NotFound";
import { MobileHome } from "./pages/MobileHome";
import { MobileChat } from "./pages/MobileChat";
import { HuddleSettings } from "./pages/HuddleSettings";
import { HuddleCoachSettings } from "./pages/HuddleCoachSettings";
import FAQ from "./pages/FAQ";
import { RetroDemo } from "./pages/RetroDemo";
import Room from "./pages/Room";
import Ledger from "./pages/Ledger";
import Sponsor from "./pages/Sponsor";
import { SpotlightPost } from "./pages/SpotlightPost";

const queryClient = new QueryClient();

// Redirect old /join/ URLs to /join-huddle/
const JoinHuddleRedirect = () => {
  const { huddleId } = useParams();
  return <Navigate to={`/join-huddle/${huddleId}`} replace />;
};

const AppContent = () => {
  // Initialize global join request notifications
  useJoinRequestNotifications();

  return (
    <div className="min-h-screen w-full bg-background">
      {/* DEV BANNER - Remove after debugging */}
      <DevBanner />
      
      <div className="relative flex-1 overflow-hidden pt-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/bills-demo" element={<BillsChatDemo />} />
          <Route path="/retro-demo" element={<RetroDemo />} />
          <Route path="/onboard" element={<Home />} />
          <Route path="/app" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<MobileProfile />} />
          <Route path="/teams/:teamId" element={<TeamFeed />} />
          <Route path="/huddle/:huddleId" element={<Huddle />} />
          <Route path="/huddle/:huddleId/settings" element={<HuddleSettings />} />
          <Route path="/huddle/:huddleId/coach-settings" element={<HuddleCoachSettings />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/join-huddle/:huddleId" element={<JoinHuddle />} />
          <Route path="/join/:huddleId" element={<JoinHuddleRedirect />} />
          <Route path="/huddle-search" element={<HuddleSearch />} />
          <Route path="/room/:eventId" element={<Room />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/sponsor" element={<Sponsor />} />
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
