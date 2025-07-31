import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Users, Shield, Crown } from 'lucide-react';

interface User {
  id: string;
  user_id: string;
  display_name?: string;
  phone_number?: string;
  avatar_url?: string;
  role: string;
  created_at: string;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    display_name: '',
    phone_number: '',
    role: 'member'
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // First get all users from auth.users via the profiles table
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Then get roles for these users
      const userIds = profiles?.map(p => p.user_id) || [];
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Combine the data
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingUser) {
        // Update profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            display_name: formData.display_name,
            phone_number: formData.phone_number
          })
          .eq('user_id', editingUser.user_id);

        if (profileError) throw profileError;

        // Update role
        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert({
            user_id: editingUser.user_id,
            role: formData.role as any
          });

        if (roleError) throw roleError;
        
        toast({
          title: "Success",
          description: "User updated successfully",
        });
      }

      setFormData({
        display_name: '',
        phone_number: '',
        role: 'member'
      });
      setIsAddDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast({
        title: "Error",
        description: "Failed to save user",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      display_name: user.display_name || '',
      phone_number: user.phone_number || '',
      role: user.role
    });
    setIsAddDialogOpen(true);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: newRole as any
        });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
      
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive"
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'huddle_owner':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <Users className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'huddle_owner':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const resetForm = () => {
    setFormData({
      display_name: '',
      phone_number: '',
      role: 'member'
    });
    setEditingUser(null);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage user roles and permissions</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Crown className="w-3 h-3" />
            Admins: {users.filter(u => u.role === 'admin').length}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Huddle Owners: {users.filter(u => u.role === 'huddle_owner').length}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            Members: {users.filter(u => u.role === 'member').length}
          </Badge>
        </div>
      </div>

      {editingUser && (
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  value={formData.phone_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, role: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="huddle_owner">Huddle Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Update User
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>
                      {user.display_name ? user.display_name.substring(0, 2).toUpperCase() : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">
                      {user.display_name || 'Unnamed User'}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center gap-1">
                        {getRoleIcon(user.role)}
                        {user.role}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {user.phone_number && (
                <p className="text-sm text-muted-foreground mb-2">
                  📱 {user.phone_number}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Joined: {new Date(user.created_at).toLocaleDateString()}
              </p>
              
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Quick Role Change:</Label>
                <div className="flex gap-1 mt-1">
                  {['member', 'huddle_owner', 'admin'].map(role => (
                    <Button
                      key={role}
                      variant={user.role === role ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleRoleChange(user.user_id, role)}
                      disabled={user.role === role}
                    >
                      {role === 'huddle_owner' ? 'Owner' : role}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {users.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No users found</h3>
            <p className="text-muted-foreground">Users will appear here when they sign up</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};