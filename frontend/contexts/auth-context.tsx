"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { getUserProfile, UserProfile } from "@/lib/api";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export type UserRole = "TEACHER" | "STUDENT" | "ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  profileImageUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isHydrated: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ user: SupabaseUser; session: any } | null>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  supabaseUser: SupabaseUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize auth state on mount
  useEffect(() => {
    setIsHydrated(true);
    initializeAuth();

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        await fetchUserProfile(session.user.id, session.access_token);
      } else {
        setSupabaseUser(null);
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setSupabaseUser(session.user);
        await fetchUserProfile(session.user.id, session.access_token);
      }
    } catch (error) {
      console.error("Failed to initialize auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string, token: string) => {
    try {
      const profile = await getUserProfile(userId);
      setUser({
        id: profile.userId,
        email: profile.email,
        name: profile.name,
        role: profile.role as UserRole,
        profileImageUrl: profile.profileImageUrl,
      });
    } catch (error) {
      console.warn("Failed to fetch user profile, using default:", error);
      // Profile might not exist yet, create a temporary user object
      // This happens right after signup before the profile is created
      setUser({
        id: userId,
        email: "",
        name: "사용자",
        role: "STUDENT",
      });
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error("이메일과 비밀번호를 입력해주세요.");
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split("@")[0],
            role: "STUDENT",
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data || !data.user) {
        throw new Error("회원가입 처리 중 오류가 발생했습니다.");
      }

      return data;
    } catch (error) {
      console.error("Sign up error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "회원가입에 실패했습니다.";
      throw new Error(errorMessage);
    }
  };

  const signIn = async (email: string, password: string): Promise<boolean> => {
    try {
      if (!email || !password) {
        throw new Error("이메일과 비밀번호를 입력해주세요.");
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Handle specific errors
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        if (error.message.includes("Email not confirmed")) {
          throw new Error("이메일 인증이 필요합니다. 메일함을 확인해주세요.");
        }
        throw error;
      }

      if (data.session?.user) {
        setSupabaseUser(data.session.user);
        try {
          await fetchUserProfile(data.session.user.id, data.session.access_token);
        } catch (profileError) {
          // Profile fetch failure shouldn't block login
          console.warn("Profile fetch skipped:", profileError);
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error("Sign in error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "로그인에 실패했습니다.";
      throw new Error(errorMessage);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    }
  };

  const deleteAccount = async () => {
    if (!supabaseUser) {
      throw new Error("No user logged in");
    }

    try {
      // This should be done via a backend function, not directly from client
      // For now, we'll just sign out
      await signOut();
    } catch (error) {
      console.error("Delete account error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isHydrated,
        signUp,
        signIn,
        signOut,
        deleteAccount,
        supabaseUser,
      }}
    >
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
