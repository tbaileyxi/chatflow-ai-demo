import { useState, useEffect } from 'react';
import { Home, Users, MessageSquare, Plus, Settings, LogOut, Menu, User } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  online_count: number;
  has_unread: boolean;
}

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const isCollapsed = state === 'collapsed';
  const { user, isAdmin, signOut } = useAuth();
  const [huddles, setHuddles] = useState<Huddle[]>([]);

  useEffect(() => {
    if (user) {
      fetchUserHuddles();
    }
  }, [user]);

  // Update last_read_at when viewing a huddle to mark messages as read
  useEffect(() => {
    const currentPath = window.location.pathname;
    const huddleMatch = currentPath.match(/\/huddle\/(.+)/);
    
    if (huddleMatch && user) {
      const huddleId = huddleMatch[1];
      const updateLastRead = async () => {
        await supabase
          .from('huddle_members')
          .update({ last_read_at: new Date().toISOString() })
          .eq('huddle_id', huddleId)
          .eq('user_id', user.id);
        
        // Refresh huddles to update unread status
        fetchUserHuddles();
      };
      
      updateLastRead();
    }
  }, [window.location.pathname, user]);

  const fetchUserHuddles = async () => {
    try {
      const { data } = await supabase
        .from('huddle_members')
        .select(`
          huddle:huddles(id, name),
          last_read_at
        `)
        .eq('user_id', user?.id);

      // Get real member counts, unread message counts, and online counts for each huddle
      const huddlesWithUnread = await Promise.all(
        (data || []).map(async (item) => {
          // Get real member count from huddle_members table
          const { count: realMemberCount } = await supabase
            .from('huddle_members')
            .select('*', { count: 'exact', head: true })
            .eq('huddle_id', item.huddle.id);

          // Get unread message count
          const { count: unreadCount } = await supabase
            .from('huddle_messages')
            .select('*', { count: 'exact', head: true })
            .eq('huddle_id', item.huddle.id)
            .gt('created_at', item.last_read_at || '1970-01-01');

          // Simulate online count (in real app, this would use presence tracking)
          const onlineCount = Math.max(1, Math.floor((realMemberCount || 1) * 0.6));

          return {
            ...item.huddle,
            member_count: realMemberCount || 1,
            online_count: onlineCount,
            has_unread: (unreadCount || 0) > 0
          };
        })
      );

      setHuddles(huddlesWithUnread);
    } catch (error) {
      console.error('Error fetching huddles:', error);
    }
  };

  const menuItems = [
    { title: 'Home', url: '/app', icon: Home },
    { title: 'Team Directory', url: '/teams', icon: Users }
  ];

  if (isAdmin) {
    menuItems.push({ title: 'Admin Panel', url: '/admin', icon: Settings });
  }

  const handleNavClick = (url: string) => {
    navigate(url);
    // Auto-collapse sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar 
      className={`${isCollapsed ? 'w-14' : 'w-64'} transition-all duration-300 ease-in-out`} 
      collapsible="icon"
    >
      <SidebarContent className="bg-sidebar border-sidebar-border">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground font-semibold">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200"
                  >
                    <button 
                      onClick={() => handleNavClick(item.url)}
                      className="flex items-center gap-3 w-full text-left"
                    >
                      <item.icon className="w-4 h-4" />
                      {!isCollapsed && <span className="font-medium">{item.title}</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user && (
          <>
            <Separator className="bg-sidebar-border" />
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center justify-between text-sidebar-foreground font-semibold">
                {!isCollapsed && 'Side Huddles'}
                {!isCollapsed && (
                  <StartHuddleDialog 
                    onHuddleCreated={fetchUserHuddles}
                    trigger={
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      >
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
                      <div className="p-4 text-center text-sm text-sidebar-foreground/70">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="mb-3">No huddles yet</p>
                        <StartHuddleDialog 
                          onHuddleCreated={fetchUserHuddles}
                          trigger={
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            >
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
                        <SidebarMenuButton 
                          asChild
                          className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200"
                        >
                          <button 
                            onClick={() => handleNavClick(`/huddle/${huddle.id}`)}
                            className="flex items-center justify-between w-full text-left"
                          >
                            <div className="flex items-center gap-3">
                              <MessageSquare className="w-4 h-4" />
                              {!isCollapsed && <span className="truncate font-medium">{huddle.name}</span>}
                            </div>
                            {!isCollapsed && (
                               <div className="flex gap-1 items-center">
                                <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {huddle.member_count} • {huddle.online_count} online
                                    </span>
                                  </div>
                                   {huddle.has_unread && (
                                     <div className="w-2 h-2 bg-destructive rounded-full"></div>
                                   )}
                               </div>
                            )}
                          </button>
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
            <Separator className="bg-sidebar-border" />
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild
                      className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200"
                    >
                      <button 
                        onClick={() => handleNavClick('/profile')}
                        className="flex items-center gap-3 w-full text-left"
                      >
                        <User className="w-4 h-4" />
                        {!isCollapsed && <span className="font-medium">Profile</span>}
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={signOut}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
                    >
                      <LogOut className="w-4 h-4" />
                      {!isCollapsed && <span className="font-medium">Sign Out</span>}
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