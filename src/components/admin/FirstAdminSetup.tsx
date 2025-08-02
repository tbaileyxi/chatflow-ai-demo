import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Crown, Shield, Users, UserCheck, Zap } from 'lucide-react';

interface User {
  user_id: string;
  display_name?: string;
  phone_number?: string;
  created_at: string;
  role?: string;
}

export const FirstAdminSetup = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [promoting, setPromoting] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [creatingDevAdmin, setCreatingDevAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Check if any admin exists
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin');

      if (adminRoles && adminRoles.length > 0) {
        setHasAdmin(true);
        setLoading(false);
        return;
      }

      // Get all users if no admin exists
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, phone_number, created_at')
        .order('created_at', { ascending: true });

      if (profilesError) throw profilesError;

      // Get existing roles
      const userIds = profiles?.map(p => p.user_id) || [];
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const usersWithRoles = profiles?.map(user => ({
        ...user,
        role: roles?.find(r => r.user_id === user.user_id)?.role || 'member'
      })) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const promoteToAdmin = async () => {
    if (!selectedUserId) return;

    setPromoting(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: selectedUserId,
          role: 'admin'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "First admin has been set up successfully!",
      });

      setHasAdmin(true);
    } catch (error) {
      console.error('Error promoting user:', error);
      toast({
        title: "Error",
        description: "Failed to promote user to admin",
        variant: "destructive"
      });
    } finally {
      setPromoting(false);
    }
  };

  const createDevAdmin = async () => {
    if (!devEmail || !devPassword) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive"
      });
      return;
    }

    setCreatingDevAdmin(true);
    try {
      // Create user with email/password
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: devEmail,
        password: devPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Immediately promote to admin
        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert({
            user_id: authData.user.id,
            role: 'admin'
          });

        if (roleError) throw roleError;

        toast({
          title: "Success",
          description: "Development admin created! You can now sign in with these credentials.",
        });

        setHasAdmin(true);
        setShowDevMode(false);
      }
    } catch (error) {
      console.error('Error creating dev admin:', error);
      toast({
        title: "Error",
        description: "Failed to create development admin",
        variant: "destructive"
      });
    } finally {
      setCreatingDevAdmin(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">Checking admin setup...</div>
      </div>
    );
  }

  if (hasAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            Admin Setup Complete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Admin access has already been configured. Use the User Management section to manage roles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-500" />
          First Admin Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          No admin users found. Choose a method to create your first admin.
        </p>

        {/* Development Mode Option */}
        <div className="border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-orange-500" />
            <span className="font-medium text-orange-700 dark:text-orange-300">Development Mode</span>
          </div>
          <p className="text-sm text-orange-600 dark:text-orange-400 mb-3">
            Quick setup for development - creates admin with email/password (bypasses SMS)
          </p>
          
          {!showDevMode ? (
            <Button 
              variant="outline" 
              onClick={() => setShowDevMode(true)}
              className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300"
            >
              Use Development Mode
            </Button>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="dev-email">Admin Email</Label>
                <Input
                  id="dev-email"
                  type="email"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <Label htmlFor="dev-password">Admin Password</Label>
                <Input
                  id="dev-password"
                  type="password"
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  placeholder="Strong password"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={createDevAdmin}
                  disabled={creatingDevAdmin || !devEmail || !devPassword}
                  className="flex-1"
                >
                  {creatingDevAdmin ? 'Creating...' : 'Create Dev Admin'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowDevMode(false)}
                  disabled={creatingDevAdmin}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Existing User Promotion */}
        {users.length === 0 ? (
          <div className="text-center py-4">
            <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No existing users found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Or promote existing user:</h3>
              <div>
                <label className="text-sm font-medium">Select User to Promote</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">
                              {user.display_name || 'Unnamed User'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {user.phone_number} • Joined {new Date(user.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={promoteToAdmin} 
                disabled={!selectedUserId || promoting}
                className="w-full mt-3"
                variant="outline"
              >
                {promoting ? 'Promoting...' : 'Promote to Admin'}
              </Button>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
          <strong>Note:</strong> This is a one-time setup. After the first admin is created, 
          use the User Management section to manage additional roles and permissions.
        </div>
      </CardContent>
    </Card>
  );
};