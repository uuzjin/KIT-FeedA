"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
// import { login as loginApi } from "@/lib/api";

export type UserRole = "teacher" | "student";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isHydrated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const mockUsers: Record<string, { password: string; user: User }> = {
  teacher: {
    password: "teacher",
    user: {
      id: "1",
      name: "김교수",
      email: "teacher@university.ac.kr",
      role: "teacher",
    },
  },
  student: {
    password: "student",
    user: {
      id: "2",
      name: "이학생",
      email: "student@university.ac.kr",
      role: "student",
    },
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark as hydrated first to prevent hydration mismatch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHydrated(true);

    // Check for stored session only on client
    try {
      const storedUser = localStorage.getItem("eduflow_user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // localStorage not available
    }
    setIsLoading(false);
  }, []);

  const login = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
    const mockUser = mockUsers[username];
    if (mockUser && mockUser.password === password) {
      setUser(mockUser.user);
      try {
        localStorage.setItem("eduflow_user", JSON.stringify(mockUser.user));
      } catch {
        // localStorage not available
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("eduflow_user");
    } catch {
      // localStorage not available
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isHydrated, login, logout }}
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
