import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let roleTimeout: ReturnType<typeof setTimeout>;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        console.log("Auth state change:", event, session?.user?.id);

        if (roleTimeout) {
          clearTimeout(roleTimeout);
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
          setUserRole(null);
          setLoading(false);
          return;
        }

        if (session?.user) {
          const fetchRole = async () => {
            try {
              const { data: roleData, error } = await supabase.rpc(
                "get_current_user_role"
              );

              if (error) {
                console.error("Error calling get_current_user_role:", error);
                const { data: fallbackData, error: fallbackError } =
                  await supabase
                    .from("user_roles")
                    .select("role")
                    .eq("user_id", session.user.id)
                    .single();

                if (fallbackError) {
                  console.error("Fallback query also failed:", fallbackError);
                  setUserRole("member");
                } else {
                  setUserRole(fallbackData?.role || "member");
                }
              } else {
                setUserRole(roleData || "member");
              }
            } catch (error) {
              console.error("Error fetching user role:", error);
              setUserRole("member");
            }
            setLoading(false);
          };

          roleTimeout = setTimeout(fetchRole, 100);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error);
          if (error.message?.includes("refresh")) {
            await supabase.auth.refreshSession();
            return;
          }
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            const { data: roleData, error: roleError } = await supabase.rpc(
              "get_current_user_role"
            );

            if (roleError) {
              const { data: fallbackData, error: fallbackError } =
                await supabase
                  .from("user_roles")
                  .select("role")
                  .eq("user_id", session.user.id)
                  .single();

              if (fallbackError) {
                setUserRole("member");
              } else {
                setUserRole(fallbackData?.role || "member");
              }
            } else {
              setUserRole(roleData || "member");
            }
          } catch (error) {
            console.error("Error fetching user role:", error);
            setUserRole("member");
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Auth initialization error:", error);
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

  const isAdmin = userRole === "admin";
  const isContentAdmin = userRole === "content_admin";
  const hasAdminAccess = isAdmin || isContentAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        isAdmin,
        isContentAdmin,
        hasAdminAccess,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
