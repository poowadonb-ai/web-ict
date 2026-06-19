"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { authService, UserProfile } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  registerProfile: (profileData: { fullName: string; grade: string; room: string; studentNo: string }) => Promise<void>;
  signUpWithUsernamePassword: (
    username: string,
    password: string,
    profileData: { fullName: string; grade: string; room: string; studentNo: string }
  ) => Promise<void>;
  signInWithUsernamePassword: (username: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // ── Step 1: Initial session check (runs ONCE on mount) ───────────────────────
  // Reads from localStorage synchronously via authService.onAuthStateChanged.
  // Keeping this separate from the redirect effect prevents the "flickering" loop.
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((profile) => {
      setUser(profile);
      setLoading(false);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []); // ← empty deps: only run once on mount

  // ── Step 2: Handle page redirects whenever user/loading/pathname changes ─────
  useEffect(() => {
    if (loading) return; // Wait until auth is resolved

    if (user) {
      if (user.role === "student" && !user.isRegistered) {
        if (pathname !== "/register") router.push("/register");
      } else if (pathname === "/register" && user.isRegistered) {
        router.push("/classroom");
      } else if (pathname === "/" || pathname === "") {
        router.push("/classroom");
      }
    } else {
      // Not logged in — only allow landing page and register page
      const publicPaths = ["/", "", "/register"];
      if (!publicPaths.includes(pathname)) {
        router.push("/");
      }
    }
  }, [user, loading, pathname, router]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const signOut = async () => {
    try {
      await authService.signOut();
      setUser(null);
      router.push("/");
    } catch (error) {
      console.error("Sign Out Error:", error);
    }
  };

  const registerProfile = async (profileData: {
    fullName: string;
    grade: string;
    room: string;
    studentNo: string;
  }) => {
    setLoading(true);
    try {
      await authService.registerProfile(profileData);
      setUser((prev) =>
        prev
          ? {
              ...prev,
              ...profileData,
              isRegistered: true,
              packsCount: prev.packsCount || 3,
              lastLoginDate: new Date().toISOString().split("T")[0],
            }
          : prev
      );
    } catch (error) {
      console.error("Profile Registration Error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithUsernamePassword = async (
    username: string,
    password: string,
    profileData: { fullName: string; grade: string; room: string; studentNo: string }
  ) => {
    setLoading(true);
    try {
      const profile = await authService.signUpWithUsernamePassword(
        username,
        password,
        profileData
      );
      setUser(profile);
      router.push("/classroom");
    } catch (error) {
      console.error("Sign Up Error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithUsernamePassword = async (username: string, password: string) => {
    setLoading(true);
    try {
      const profile = await authService.signInWithUsernamePassword(username, password);
      setUser(profile);
      router.push("/classroom");
    } catch (error) {
      console.error("Sign In Error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signOut,
        registerProfile,
        signUpWithUsernamePassword,
        signInWithUsernamePassword,
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
