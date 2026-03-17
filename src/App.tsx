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
import AdminEventsPage from "./pages/AdminEventsPage";
import PickSharePage from "./pages/PickSharePage";

const queryClient = new QueryClient();

const AppContent = () => (
  <div className="min-h-screen w-full bg-background">
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/h/:huddleId" element={<HuddleInvitePage />} />
      <Route path="/admin/events" element={<AdminEventsPage />} />
      <Route path="/picks/:betId" element={<PickSharePage />} />
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
          <AppContent />
        </BrowserRouter>
      </HelmetProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
