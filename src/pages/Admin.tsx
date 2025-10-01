import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { BroadcastCenter } from '@/components/admin/BroadcastCenter';
import { TeamManagement } from '@/components/admin/TeamManagement';
import { UserManagement } from '@/components/admin/UserManagement';
import { FirstAdminSetup } from '@/components/admin/FirstAdminSetup';
import { ModerationPanel } from '@/components/admin/ModerationPanel';
import { BearsTrendingManager } from '@/components/admin/BearsTrendingManager';
import { SocialSourceManager } from '@/components/admin/SocialSourceManager';
import { CurationQueue } from '@/components/admin/CurationQueue';
import { BarChart3, Radio, Users, Shield, Flag, TrendingUp, Rss, Filter } from 'lucide-react';

export const Admin = () => {
  const { isAdmin, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Loading admin panel...</div>
      </div>
    );
  }

  // Allow access if user is logged in (for first admin setup)
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background crt-effect">
      {/* Retro background effects */}
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0 retro-grid"></div>
        <div className="absolute inset-0 retro-scanlines"></div>
      </div>

      <div className="relative border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-foreground font-arcade">ADMIN CONTROL CENTER</h1>
          <p className="text-muted-foreground font-mono">System Management Interface</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 relative">
        {!isAdmin ? (
          <FirstAdminSetup />
        ) : (
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="grid grid-cols-8 w-full max-w-6xl bg-card/80 backdrop-blur-sm border border-primary/20">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="broadcast" className="flex items-center gap-2">
                <Radio className="w-4 h-4" />
                Broadcast
              </TabsTrigger>
              <TabsTrigger value="teams" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Teams
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="moderation" className="flex items-center gap-2">
                <Flag className="w-4 h-4" />
                Moderation
              </TabsTrigger>
              <TabsTrigger value="trending" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="sources" className="flex items-center gap-2">
                <Rss className="w-4 h-4" />
                Sources
              </TabsTrigger>
              <TabsTrigger value="curation" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Curation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <AdminDashboard />
            </TabsContent>

            <TabsContent value="broadcast">
              <BroadcastCenter />
            </TabsContent>

            <TabsContent value="teams">
              <TeamManagement />
            </TabsContent>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>

            <TabsContent value="moderation">
              <ModerationPanel />
            </TabsContent>

            <TabsContent value="trending">
              <BearsTrendingManager />
            </TabsContent>

            <TabsContent value="sources">
              <SocialSourceManager />
            </TabsContent>

            <TabsContent value="curation">
              <CurationQueue />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};