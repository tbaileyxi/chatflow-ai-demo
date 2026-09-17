import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { HelmetProvider } from "react-helmet-async";
import LandingPage from "./pages/LandingPage";
import HuddleInvitePage from "./pages/HuddleInvitePage";
import InviteCodePage from "./pages/InviteCodePage";
import AdminEventsPage from "./pages/AdminEventsPage";
import PickSharePage from "./pages/PickSharePage";
import Sponsor from "./pages/Sponsor";
import SponsorAdmin from "./pages/SponsorAdmin";
import Outreach from "./pages/Outreach";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import FAQ from "./pages/FAQ";
import Contact from "./pages/Contact";
import TeamLanding from "./pages/TeamLanding";
import TeamsIndex from "./pages/TeamsIndex";
import Arena from "./pages/Arena";
import ArenaProfile from "./pages/ArenaProfile";
import { OutreachErrorBoundary } from "@/components/OutreachErrorBoundary";

const queryClient = new QueryClient();

// VITE_ARENA_ONLY=1 -> this deployment is ProphetDome, a standalone product
// with zero Side Huddle surface. Unset -> the Side Huddle site, with NO arena.
const ARENA_ONLY = import.meta.env.VITE_ARENA_ONLY === "1";
if (ARENA_ONLY) {
  document.title = "ProphetDome";
  document.querySelector('meta[name="description"]')
    ?.setAttribute("content", "Pick a side. Throw your chips. The live arena for the moments everyone's arguing about.");
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", "ProphetDome");
  document.querySelector('meta[property="og:description"]')
    ?.setAttribute("content", "Pick a side. Throw your chips. The live arena for the moments everyone's arguing about.");
}

const AppContent = () => {
  const path = window.location.pathname.toLowerCase();

  if (ARENA_ONLY) {
    return (
      <div className="min-h-screen w-full bg-background">
        <Routes>
          <Route path="/" element={<Arena />} />
          <Route path="/arena" element={<Navigate to="/" replace />} />
          <Route path="/arena/p/:clientId" element={<ArenaProfile />} />
          <Route path="/arena/:gameId" element={<Arena />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    );
  }

  if (path === "/outreach" || path === "/oureach") {
    return (
      <div className="min-h-screen w-full bg-background">
        <OutreachErrorBoundary>
          <Outreach />
        </OutreachErrorBoundary>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/h/:huddleId" element={<HuddleInvitePage />} />
        <Route path="/i/:code" element={<InviteCodePage />} />
        <Route path="/admin/events" element={<AdminEventsPage />} />
        <Route path="/picks/:betId" element={<PickSharePage />} />
        {/* ONE sponsor page, at the singular URL the emails link to. It was
            the other way round — /sponsor redirected to /sponsors — so every
            link with ?team= lost its query on the bounce and the page could
            not tell which team it was selling. */}
        <Route path="/sponsor" element={<Sponsor />} />
        <Route path="/sponsors" element={<Navigate to="/sponsor" replace />} />
        <Route path="/sponsors/admin" element={<SponsorAdmin />} />
        <Route path="/teams" element={<TeamsIndex />} />
        <Route path="/t/:slug" element={<TeamLanding />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <HelmetProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
