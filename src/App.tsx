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

const queryClient = new QueryClient();

const AppContent = () => (
  <div className="min-h-screen w-full bg-background">
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/h/:huddleId" element={<HuddleInvitePage />} />
      <Route path="/i/:code" element={<InviteCodePage />} />
      <Route path="/admin/events" element={<AdminEventsPage />} />
      <Route path="/picks/:betId" element={<PickSharePage />} />
      <Route path="/sponsors" element={<Sponsor />} />
      <Route path="/sponsors/admin" element={<SponsorAdmin />} />
      <Route path="/outreach" element={<Outreach />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </div>
);

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
