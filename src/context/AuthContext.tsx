"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { authService, UserProfile } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: (role?: "teacher" | "student", email?: string) => Promise<void>;
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

  useEffect(() => {
    // Listen to Firebase Auth state
    const unsubscribe = authService.onAuthStateChanged((profile) => {
      setUser(profile);
      setLoading(false);

      // Handle redirects based on registration status
      if (profile) {
        if (profile.role === "student" && !profile.isRegistered) {
          if (pathname !== "/register") {
            router.push("/register");
          }
        } else if (pathname === "/register" && profile.isRegistered) {
          router.push("/classroom");
        } else if (pathname === "/") {
          router.push("/classroom");
        }
      } else {
        // Not logged in - allow landing page and register page
        if (pathname !== "/" && pathname !== "" && pathname !== "/register") {
          router.push("/");
        }
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [pathname, router]);

  const signIn = async (role: "teacher" | "student" = "student", email?: string) => {
    setLoading(true);
    try {
      const profile = await authService.signInWithGoogle(role, email);
      setUser(profile);
      if (profile.role === "student" && !profile.isRegistered) {
        router.push("/register");
      } else {
        router.push("/classroom");
      }
    } catch (error) {
      console.error("Authentication Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      setUser(null);
      router.push("/");
    } catch (error) {
      console.error("Sign Out Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const registerProfile = async (profileData: { fullName: string; grade: string; room: string; studentNo: string }) => {
    setLoading(true);
    try {
      await authService.registerProfile(profileData);
      // Let onAuthStateChanged handle the redirect to /classroom
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
      const profile = await authService.signUpWithUsernamePassword(username, password, profileData);
      setUser(profile);
      // Automatically redirect to classroom on success
      router.push("/classroom");
    } catch (error) {
      console.error("Profile Sign Up Error:", error);
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
      console.error("Username Sign In Error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signOut, 
      registerProfile,
      signUpWithUsernamePassword,
      signInWithUsernamePassword
    }}>
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
