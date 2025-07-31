import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Crown, Shield, Users, UserCheck } from 'lucide-react';

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
          No admin users found. Select a user to promote to admin to get started.
        </p>

        {users.length === 0 ? (
          <div className="text-center py-4">
            <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No users found. Have someone sign up first.</p>
          </div>
        ) : (
          <div className="space-y-4">
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
              className="w-full"
            >
              {promoting ? 'Promoting...' : 'Promote to Admin'}
            </Button>

            <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
              <strong>Note:</strong> This is a one-time setup. After the first admin is created, 
              use the User Management section to manage additional roles and permissions.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};