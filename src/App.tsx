import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import { Admin } from "./pages/Admin";
import { Auth } from "./pages/Auth";
import { Profile } from "./pages/Profile";
import { TeamDirectory } from "./pages/TeamDirectory";
import { Huddle } from "./pages/Huddle";
import { JoinHuddle } from "./pages/JoinHuddle";
import { SpotlightPost } from "./pages/SpotlightPost";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <div className="flex min-h-screen w-full bg-background">
            <AppSidebar />
            <main className="flex-1 flex flex-col min-w-0">
              <header className="h-12 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
                <SidebarTrigger className="ml-2" />
                <div className="ml-4 flex-1">
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="text-lg font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    Side Huddle
                  </button>
                </div>
              </header>
              <div className="flex-1 overflow-hidden">{/* Overflow container */}
              <Routes>
                <Route path="/" element={<Index />} />
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
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
