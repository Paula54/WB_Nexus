import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseCustom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Clear stale tokens from previous environments on first load
const STORAGE_VERSION_KEY = "nexus_storage_v";
const CURRENT_VERSION = "2"; // bump to force clear
if (localStorage.getItem(STORAGE_VERSION_KEY) !== CURRENT_VERSION) {
  // Remove all Supabase auth keys
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("sb-")) localStorage.removeItem(key);
  });
  localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
  console.log("[Auth] Cleared stale localStorage tokens");
}

async function ensureProfileExists(user: User) {
  try {
    // Profile should already exist from the marketing site registration.
    // Only create if missing (safety net).
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        user_id: user.id,
        full_name: user.user_metadata?.full_name || null,
        contact_email: user.email || null,
      });
      console.log("[Auth] Profile created (fallback) for", user.id);
    }
  } catch (err) {
    console.error("[Auth] Error ensuring profile:", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    const syncProfile = (nextUser: User | null | undefined) => {
      if (!nextUser) return;
      setTimeout(() => {
        void ensureProfileExists(nextUser);
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        applySession(nextSession);

        if (nextSession?.user && (event === "SIGNED_IN" || event === "SIGNED_UP" || event === "TOKEN_REFRESHED" || event === "PASSWORD_RECOVERY")) {
          syncProfile(nextSession.user);
        }
      }
    );

    void supabase.auth.getSession()
      .then(({ data: { session: nextSession } }) => {
        applySession(nextSession);
        syncProfile(nextSession?.user);
      })
      .catch((error) => {
        console.error("[Auth] Error restoring session:", error);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://nexus.web-business.pt",
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "https://site.web-business.pt";
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
