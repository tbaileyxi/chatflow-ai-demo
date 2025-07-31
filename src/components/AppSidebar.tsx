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
  unread_count: number;
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
                                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                  <span className="text-xs text-muted-foreground">{huddle.member_count}</span>
                                </div>
                                {huddle.unread_count > 0 && (
                                  <div className="flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3 text-destructive" />
                                    <Badge variant="destructive" className="text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full">
                                      {huddle.unread_count}
                                    </Badge>
                                  </div>
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