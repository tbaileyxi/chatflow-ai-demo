import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MessageSquareMore } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import { Landing } from "./pages/Landing";
import { Admin } from "./pages/Admin";
import { Auth } from "./pages/Auth";
import { Profile } from "./pages/Profile";
import { TeamDirectory } from "./pages/TeamDirectory";
import { Huddle } from "./pages/Huddle";
import { JoinHuddle } from "./pages/JoinHuddle";
import { SpotlightPost } from "./pages/SpotlightPost";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <SidebarTrigger className="ml-2" />
          <div className="ml-4 flex-1 flex items-center gap-3">
            <button 
              onClick={() => {
                const navigate = window.location.pathname === '/app' ? () => {} : () => window.location.href = '/app';
                navigate();
              }}
              className="text-lg font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Side Huddle
            </button>
          </div>
          <div className="mr-4">
            <button 
              onClick={toggleSidebar}
              className="w-8 h-8 p-1.5 bg-huddle/10 hover:bg-huddle/20 text-huddle border border-huddle/20 rounded-md transition-colors flex items-center justify-center"
              title="Toggle Huddles Sidebar"
            >
              <MessageSquareMore className="w-4 h-4" />
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
