import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch user role when user signs in
        if (session?.user) {
          setTimeout(async () => {
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
          }, 0);
        } else {
          setUserRole(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const fetchRole = async () => {
          try {
            console.log('Initial session - fetching role for user:', session.user.id);
            
            // Use the security definer function to get current user role
            const { data: roleData, error } = await supabase.rpc('get_current_user_role');
            
            if (error) {
              console.error('Initial session - Error calling get_current_user_role:', error);
              // Fallback to direct query
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
          setLoading(false);
        };
        fetchRole();
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = userRole === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      session,
      userRole,
      isAdmin,
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