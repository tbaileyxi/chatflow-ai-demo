import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/integrations/supabase/client";
import { DEV_FOLLOWS_STORAGE_KEY } from "@/config/devData";
import type { TestLogin } from "@/config/testLogins";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  isAdmin: boolean;
  isContentAdmin: boolean;
  hasAdminAccess: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithDevTestLogin: (testLogin: TestLogin) => Promise<void>;
  completeDevOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const DEV_SESSION_STORAGE_KEY = "side-huddle-dev-test-login";
const DEV_ONBOARDING_COMPLETED_STORAGE_KEY =
  "side-huddle-dev-onboarding-completed";

function createDevUser(
  testLogin: TestLogin,
  onboardingCompleted = false,
): User {
  return {
    id: testLogin.userId,
    aud: "authenticated",
    app_metadata: {
      provider: "dev_test",
      providers: ["dev_test"],
    },
    user_metadata: {
      display_name: testLogin.displayName,
      onboarding_completed: onboardingCompleted,
      phone: testLogin.phone,
      username: testLogin.username,
    },
    created_at: new Date().toISOString(),
    phone: testLogin.phone,
    role: "authenticated",
  };
}

function createDevSession(
  testLogin: TestLogin,
  onboardingCompleted = false,
): Session {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: `dev-test-${testLogin.userId}`,
    refresh_token: `dev-refresh-${testLogin.userId}`,
    expires_in: 60 * 60 * 24 * 30,
    expires_at: now + 60 * 60 * 24 * 30,
    token_type: "bearer",
    user: createDevUser(testLogin, onboardingCompleted),
  };
}

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
        const storedDevLogin = await AsyncStorage.getItem(DEV_SESSION_STORAGE_KEY);
        if (storedDevLogin) {
          const testLogin = JSON.parse(storedDevLogin) as TestLogin;
          const onboardingCompleted = await AsyncStorage.getItem(
            DEV_ONBOARDING_COMPLETED_STORAGE_KEY,
          );
          const storedFollows = await AsyncStorage.getItem(DEV_FOLLOWS_STORAGE_KEY);
          const devSession = createDevSession(
            testLogin,
            onboardingCompleted === "true" || !!storedFollows,
          );
          setSession(devSession);
          setUser(devSession.user);
          setUserRole("member");
          setLoading(false);
          return;
        }

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
    await AsyncStorage.removeItem(DEV_SESSION_STORAGE_KEY);
    await AsyncStorage.removeItem(DEV_ONBOARDING_COMPLETED_STORAGE_KEY);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setUserRole(null);
  };

  const signInWithDevTestLogin = async (testLogin: TestLogin) => {
    await AsyncStorage.setItem(
      DEV_SESSION_STORAGE_KEY,
      JSON.stringify(testLogin),
    );
    const devSession = createDevSession(testLogin);
    setSession(devSession);
    setUser(devSession.user);
    setUserRole("member");
    setLoading(false);
  };

  const completeDevOnboarding = async () => {
    const storedDevLogin = await AsyncStorage.getItem(DEV_SESSION_STORAGE_KEY);
    if (!storedDevLogin) return;

    const testLogin = JSON.parse(storedDevLogin) as TestLogin;
    await AsyncStorage.setItem(DEV_ONBOARDING_COMPLETED_STORAGE_KEY, "true");
    const devSession = createDevSession(testLogin, true);
    setSession(devSession);
    setUser(devSession.user);
    setUserRole("member");
    setLoading(false);
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
        signInWithDevTestLogin,
        completeDevOnboarding,
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
