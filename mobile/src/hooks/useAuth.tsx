import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

// Legacy dev-test session keys. The fake-session mechanism is gone; clear any
// stale keys so devices that used it can never boot into a phantom session.
const LEGACY_DEV_KEYS = [
  "side-huddle-dev-test-login",
  "side-huddle-dev-onboarding-completed",
];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.multiRemove(LEGACY_DEV_KEYS).catch(() => {});

    // Single source of truth: supabase-js v2 emits INITIAL_SESSION on
    // startup, then SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED as they happen.
    // All session + role state flows through this one listener — no separate
    // init path racing it.
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state change:", event, session?.user?.id);
        if (!active) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (!session?.user) {
          setUserRole(null);
          setLoading(false);
          return;
        }

        // Defer the role fetch out of the auth callback (Supabase warns
        // against awaiting inside onAuthStateChange).
        const fetchRole = async () => {
          try {
            const { data: roleData, error } = await supabase.rpc(
              "get_current_user_role",
            );

            if (error) {
              console.error("Error calling get_current_user_role:", error);
              const { data: fallbackData, error: fallbackError } =
                await supabase
                  .from("user_roles")
                  .select("role")
                  .eq("user_id", session.user.id)
                  .single();

              if (!active) return;
              setUserRole(fallbackError ? "member" : fallbackData?.role || "member");
            } else {
              if (!active) return;
              setUserRole(roleData || "member");
            }
          } catch (error) {
            console.error("Error fetching user role:", error);
            if (active) setUserRole("member");
          }
          if (active) setLoading(false);
        };

        setTimeout(fetchRole, 0);
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setUserRole(null);
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
