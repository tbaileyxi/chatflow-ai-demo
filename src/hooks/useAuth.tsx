import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  isAdmin: boolean;
  isContentAdmin: boolean;
  hasAdminAccess: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearSupabaseAuthStorage() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth-token')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Failed to clear auth storage:', error);
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let roleTimeout: NodeJS.Timeout;
    const forceLogout = new URLSearchParams(window.location.search).get('logout') === '1';

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        // Clear any pending role fetches
        if (roleTimeout) {
          clearTimeout(roleTimeout);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Handle sign out or token refresh
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
          setUserRole(null);
          setLoading(false);
          return;
        }
        
        // Only check for onboarding on sign-in, not every auth state change
        if (session?.user && event === 'SIGNED_IN') {
          // Clear old onboarding data that might cause loops
          const keys = Object.keys(localStorage);
          keys.forEach(key => {
            if (key.startsWith('hasSeenOnboarding_') && key !== `hasSeenOnboarding_${session.user.id}`) {
              localStorage.removeItem(key);
            }
          });
        }
        
        // Fetch user role when user is authenticated
        if (session?.user) {
          const fetchRole = async () => {
            try {
              console.log('Fetching role for user:', session.user.id);
              
              // Use the security definer function to get current user role
              const { data: roleData, error } = await supabase.rpc('get_current_user_role');
              
              if (error) {
                console.error('Error calling get_current_user_role:', error);
                // Fallback to direct query
                const { data: fallbackData, error: fallbackError } = await supabase
                  .from('user_roles')
                  .select('role')
                  .eq('user_id', session.user.id)
                  .single();
                
                if (fallbackError) {
                  console.error('Fallback query also failed:', fallbackError);
                  setUserRole('member');
                } else {
                  console.log('Fallback role data:', fallbackData);
                  setUserRole(fallbackData?.role || 'member');
                }
              } else {
                console.log('Role data from function:', roleData);
                setUserRole(roleData || 'member');
              }
            } catch (error) {
              console.error('Error fetching user role:', error);
              setUserRole('member');
            }
            setLoading(false);
          };
          
          // Use timeout to avoid blocking auth state changes
          roleTimeout = setTimeout(fetchRole, 100);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session with better error handling
    const initializeAuth = async () => {
      try {
        if (forceLogout) {
          await supabase.auth.signOut({ scope: 'local' }).catch((error) => {
            console.error('Local sign out failed:', error);
          });
          clearSupabaseAuthStorage();
          window.history.replaceState({}, '', window.location.pathname);
          setSession(null);
          setUser(null);
          setUserRole(null);
          setLoading(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          clearSupabaseAuthStorage();
          setSession(null);
          setUser(null);
          setUserRole(null);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          try {
            console.log('Initial session - fetching role for user:', session.user.id);
            
            const { data: roleData, error: roleError } = await supabase.rpc('get_current_user_role');
            
            if (roleError) {
              console.error('Initial session - Error calling get_current_user_role:', roleError);
              const { data: fallbackData, error: fallbackError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .single();
              
              if (fallbackError) {
                console.error('Initial session - Fallback query also failed:', fallbackError);
                setUserRole('member');
              } else {
                console.log('Initial session - Fallback role data:', fallbackData);
                setUserRole(fallbackData?.role || 'member');
              }
            } else {
              console.log('Initial session - Role data from function:', roleData);
              setUserRole(roleData || 'member');
            }
          } catch (error) {
            console.error('Initial session - Error fetching user role:', error);
            setUserRole('member');
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearSupabaseAuthStorage();
        setSession(null);
        setUser(null);
        setUserRole(null);
        setLoading(false);
      }
    };
    
    initializeAuth();

    return () => {
      subscription.unsubscribe();
      if (roleTimeout) {
        clearTimeout(roleTimeout);
      }
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = userRole === 'admin';
  const isContentAdmin = userRole === 'content_admin';
  const hasAdminAccess = isAdmin || isContentAdmin;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      userRole,
      isAdmin,
      isContentAdmin,
      hasAdminAccess,
      loading,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
