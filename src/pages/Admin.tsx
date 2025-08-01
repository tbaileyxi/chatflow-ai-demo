import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { BroadcastCenter } from '@/components/admin/BroadcastCenter';
import { TeamManagement } from '@/components/admin/TeamManagement';
import { UserManagement } from '@/components/admin/UserManagement';
import { FirstAdminSetup } from '@/components/admin/FirstAdminSetup';
import { ModerationPanel } from '@/components/admin/ModerationPanel';
import { BarChart3, Radio, Users, Shield, Flag } from 'lucide-react';

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
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground">Manage your sports platform</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {!isAdmin ? (
          <FirstAdminSetup />
        ) : (
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="grid grid-cols-5 w-full max-w-3xl">
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
          </Tabs>
        )}
      </div>
    </div>
  );
};