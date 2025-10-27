import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Users, Shield, Crown, Ban, Search, Calendar, Phone, Mail, UserX, UserCheck, AlertTriangle, Radio } from 'lucide-react';
import { FirstAdminSetup } from './FirstAdminSetup';

interface User {
  id: string;
  user_id: string;
  display_name?: string;
  phone_number?: string;
  email?: string;
  avatar_url?: string;
  role: string;
  status: string;
  created_at: string;
  last_login_at?: string;
  signup_method?: string;
  blocked_at?: string;
  banned_at?: string;
  banned_reason?: string;
}

interface Team {
  id: string;
  name: string;
  city: string;
  league: string;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [banReason, setBanReason] = useState('');
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantTeamId, setGrantTeamId] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [formData, setFormData] = useState({
    display_name: '',
    phone_number: '',
    role: 'member',
    status: 'active'
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, statusFilter]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, city, league')
        .order('league', { ascending: true })
        .order('city', { ascending: true });
      
      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      // Check if any admin exists
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin');

      setHasAdmin(adminRoles && adminRoles.length > 0);

      // Get all users from auth.users to access email
      const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) throw authError;

      // Get all users from profiles table with new columns
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get roles for these users
      const userIds = profiles?.map(p => p.user_id) || [];
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Combine all data including email from auth.users
      const usersWithRoles = profiles?.map(profile => {
        const authUser = authUsers?.find((u: any) => u.id === profile.user_id);
        return {
          ...profile,
          email: authUser?.email || null,
          role: roles?.find(r => r.user_id === profile.user_id)?.role || 'member'
        };
      }) || [];
      
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

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone_number?.includes(searchTerm) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    setFilteredUsers(filtered);
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
            phone_number: formData.phone_number,
            status: formData.status,
            blocked_at: formData.status === 'blocked' ? new Date().toISOString() : null,
            banned_at: formData.status === 'banned' ? new Date().toISOString() : null
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

      resetForm();
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
      role: user.role,
      status: user.status || 'active'
    });
    setIsEditDialogOpen(true);
  };

  const handleStatusChange = async (userId: string, newStatus: string, reason?: string) => {
    try {
      const updateData: any = {
        status: newStatus
      };

      if (newStatus === 'blocked') {
        updateData.blocked_at = new Date().toISOString();
      } else if (newStatus === 'banned') {
        updateData.banned_at = new Date().toISOString();
        updateData.banned_reason = reason;
      } else if (newStatus === 'active') {
        updateData.blocked_at = null;
        updateData.banned_at = null;
        updateData.banned_reason = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', userId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `User ${newStatus === 'active' ? 'activated' : newStatus} successfully`,
      });
      
      fetchUsers();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive"
      });
    }
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

  const handleGrantContentAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Find user by email (search in auth.users via profile lookup)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .or(`phone_number.eq.${grantEmail}`);
      
      if (profileError) throw profileError;
      
      if (!profiles || profiles.length === 0) {
        toast({
          title: "Error",
          description: "User not found with that email/phone",
          variant: "destructive"
        });
        return;
      }
      
      const userId = profiles[0].user_id;
      
      // Grant content_admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: 'content_admin'
        });
      
      if (roleError) throw roleError;
      
      // Assign team
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { error: teamError } = await supabase
        .from('content_admin_teams')
        .insert({
          user_id: userId,
          team_id: grantTeamId,
          created_by: currentUser?.id
        });
      
      if (teamError) throw teamError;
      
      toast({
        title: "Success",
        description: "Content admin access granted successfully",
      });
      
      setGrantDialogOpen(false);
      setGrantEmail('');
      setGrantTeamId('');
      fetchUsers();
      
    } catch (error) {
      console.error('Error granting access:', error);
      toast({
        title: "Error",
        description: "Failed to grant content admin access",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <UserCheck className="w-4 h-4 text-green-500" />;
      case 'blocked':
        return <UserX className="w-4 h-4 text-orange-500" />;
      case 'banned':
        return <Ban className="w-4 h-4 text-red-500" />;
      default:
        return <UserCheck className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'blocked':
        return 'secondary';
      case 'banned':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'content_admin':
        return <Radio className="w-4 h-4 text-purple-500" />;
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
      case 'content_admin':
        return 'secondary';
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
      role: 'member',
      status: 'active'
    });
    setEditingUser(null);
    setIsEditDialogOpen(false);
    setBanReason('');
  };

  const formatDate = (dateString?: string) => {
    return dateString ? new Date(dateString).toLocaleDateString() : 'Never';
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  // Show first admin setup if no admin exists
  if (!hasAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Set up your first admin to get started</p>
        </div>
        <FirstAdminSetup />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Manage user roles, status and permissions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="flex items-center gap-1">
            <Crown className="w-3 h-3" />
            Admins: {users.filter(u => u.role === 'admin').length}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <UserCheck className="w-3 h-3" />
            Active: {users.filter(u => u.status === 'active').length}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <UserX className="w-3 h-3" />
            Blocked: {users.filter(u => u.status === 'blocked').length}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Ban className="w-3 h-3" />
            Banned: {users.filter(u => u.status === 'banned').length}
          </Badge>
        </div>
      </div>

      {/* Grant Content Admin Access Card */}
      <Card className="mb-6 bg-card/50 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-purple-500" />
            Grant Content Admin Access
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Give users access to the Broadcast section and assign them to a team
          </p>
        </CardHeader>
        <CardContent>
          <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
            <Button onClick={() => setGrantDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Content Admin
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant Content Admin Access</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleGrantContentAdmin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">User Email/Phone</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="user@example.com or phone number"
                    value={grantEmail}
                    onChange={(e) => setGrantEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="team">Assign Team</Label>
                  <Select value={grantTeamId} onValueChange={setGrantTeamId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.city} {team.name} ({team.league.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setGrantDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Grant Access
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search users by name, phone, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Edit User Dialog */}
      {editingUser && (
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
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
                    <SelectItem value="content_admin">Content Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, status: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
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
        {filteredUsers.map((user) => (
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
                      <Badge variant={getStatusBadgeVariant(user.status)} className="flex items-center gap-1">
                        {getStatusIcon(user.status)}
                        {user.status}
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
              <div className="space-y-2 text-sm">
                {user.phone_number && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    {user.phone_number}
                  </div>
                )}
                {user.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    {user.email}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Joined: {formatDate(user.created_at)}
                </div>
                {user.last_login_at && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    Last login: {formatDate(user.last_login_at)}
                  </div>
                )}
                {user.signup_method && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {user.signup_method === 'phone' ? <Phone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    Via {user.signup_method}
                  </div>
                )}
                {user.banned_reason && (
                  <div className="text-red-600 text-xs">
                    Reason: {user.banned_reason}
                  </div>
                )}
              </div>
              
              <div className="mt-4 space-y-2">
                <Label className="text-xs text-muted-foreground">Quick Actions:</Label>
                
                {/* Status Actions */}
                <div className="flex gap-1">
                  {user.status !== 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(user.user_id, 'active')}
                      className="text-green-600"
                    >
                      Activate
                    </Button>
                  )}
                  {user.status !== 'blocked' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(user.user_id, 'blocked')}
                      className="text-orange-600"
                    >
                      Block
                    </Button>
                  )}
                  {user.status !== 'banned' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                        >
                          Ban
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ban User</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to ban this user? They will be permanently blocked from accessing the platform.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-2">
                          <Label htmlFor="ban-reason">Reason (optional)</Label>
                          <Textarea
                            id="ban-reason"
                            placeholder="Enter reason for banning..."
                            value={banReason}
                            onChange={(e) => setBanReason(e.target.value)}
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setBanReason('')}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              handleStatusChange(user.user_id, 'banned', banReason);
                              setBanReason('');
                            }}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Ban User
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                {/* Role Actions */}
                <div>
                  <Label className="text-xs text-muted-foreground">Change Role:</Label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {['member', 'huddle_owner', 'content_admin', 'admin'].map(role => (
                      <Button
                        key={role}
                        variant={user.role === role ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleRoleChange(user.user_id, role)}
                        disabled={user.role === role}
                        className="text-xs"
                      >
                        {role === 'huddle_owner' ? 'Owner' : role === 'content_admin' ? 'Content Admin' : role}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No users found</h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Users will appear here when they sign up'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};