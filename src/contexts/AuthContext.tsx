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

async function ensureProfileAndProject(user: User) {
  try {
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        user_id: user.id,
        full_name: user.user_metadata?.full_name || null,
      });
      console.log("[Auth] Profile created for", user.id);
    }

    // Check if project exists
    const { data: existingProject } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingProject) {
      await supabase.from("projects").insert({
        user_id: user.id,
        name: "Meu Projeto",
      });
      console.log("[Auth] Project created for", user.id);
    }
  } catch (err) {
    console.error("[Auth] Error ensuring profile/project:", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // On first sign-in or sign-up, ensure profile & project exist
        if (session?.user && (event === "SIGNED_IN" || event === "SIGNED_UP" || event === "TOKEN_REFRESHED")) {
          // Use setTimeout to avoid Supabase deadlock with auth state
          setTimeout(() => ensureProfileAndProject(session.user), 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        setTimeout(() => ensureProfileAndProject(session.user), 0);
      }
    });

    return () => subscription.unsubscribe();
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
