import { useState, useEffect } from 'react';
import { Home, Users, MessageSquare, Plus, Settings, LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { StartHuddleDialog } from '@/components/StartHuddleDialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Huddle {
  id: string;
  name: string;
  member_count: number;
  unread_count: number;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { user, isAdmin, signOut } = useAuth();
  const [huddles, setHuddles] = useState<Huddle[]>([]);

  useEffect(() => {
    if (user) {
      fetchUserHuddles();
    }
  }, [user]);

  const fetchUserHuddles = async () => {
    try {
      const { data } = await supabase
        .from('huddle_members')
        .select(`
          huddle:huddles(id, name, member_count)
        `)
        .eq('user_id', user?.id);

      setHuddles(data?.map(item => ({
        ...item.huddle,
        unread_count: Math.floor(Math.random() * 5) // Mock unread count
      })) || []);
    } catch (error) {
      console.error('Error fetching huddles:', error);
    }
  };

  const menuItems = [
    { title: 'Home', url: '/', icon: Home },
    { title: 'Team Directory', url: '/teams', icon: Users }
  ];

  if (isAdmin) {
    menuItems.push({ title: 'Admin Panel', url: '/admin', icon: Settings });
  }

  return (
    <Sidebar className={isCollapsed ? 'w-14' : 'w-64'} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className="flex items-center gap-3">
                      <item.icon className="w-4 h-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user && (
          <>
            <Separator />
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center justify-between">
                {!isCollapsed && 'Side Huddles'}
                {!isCollapsed && (
                  <StartHuddleDialog 
                    onHuddleCreated={fetchUserHuddles}
                    trigger={
                      <Button size="sm" variant="ghost">
                        <Plus className="w-4 h-4" />
                      </Button>
                    }
                  />
                )}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {huddles.length === 0 ? (
                    !isCollapsed && (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No huddles yet</p>
                        <StartHuddleDialog 
                          onHuddleCreated={fetchUserHuddles}
                          trigger={
                            <Button size="sm" variant="outline" className="mt-2">
                              <Plus className="w-4 h-4 mr-2" />
                              Start Huddle
                            </Button>
                          }
                        />
                      </div>
                    )
                  ) : (
                    huddles.map((huddle) => (
                      <SidebarMenuItem key={huddle.id}>
                        <SidebarMenuButton asChild>
                          <NavLink to={`/huddle/${huddle.id}`} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <MessageSquare className="w-4 h-4" />
                              {!isCollapsed && <span className="truncate">{huddle.name}</span>}
                            </div>
                            {!isCollapsed && (
                              <div className="flex gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  {huddle.member_count}
                                </Badge>
                                {huddle.unread_count > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {huddle.unread_count}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {user && (
          <>
            <Separator />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={signOut}>
                      <LogOut className="w-4 h-4" />
                      {!isCollapsed && <span>Sign Out</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}