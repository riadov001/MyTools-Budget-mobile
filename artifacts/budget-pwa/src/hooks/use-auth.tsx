import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, type AuthResponse } from "@shared/routes";
import { User, loginSchema, registerSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: z.infer<typeof loginSchema>) => void;
  register: (data: z.infer<typeof registerSchema>) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      if (!token) return null;
      try {
        const res = await fetch(api.auth.me.path, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem("token");
          setToken(null);
          return null;
        }
        if (!res.ok) throw new Error("Failed to fetch user");
        const data = await res.json();
        return api.auth.me.responses[200].parse(data);
      } catch (err) {
        localStorage.removeItem("token");
        setToken(null);
        return null;
      }
    },
    enabled: !!token,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: z.infer<typeof loginSchema>) => {
      const res = await apiRequest("POST", api.auth.login.path, data);
      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      localStorage.setItem("token", data.token);
      setToken(data.token);
      queryClient.setQueryData([api.auth.me.path], data.user);
      setLocation("/");
      toast({ title: "Connexion réussie", description: "Bienvenue !" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Échec de connexion", description: "Email ou mot de passe incorrect." });
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof registerSchema>) => {
      const res = await apiRequest("POST", api.auth.register.path, data);
      return api.auth.register.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      localStorage.setItem("token", data.token);
      setToken(data.token);
      queryClient.setQueryData([api.auth.me.path], data.user);
      setLocation("/");
      toast({ title: "Compte créé", description: "Votre compte a été créé avec succès." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Registration failed", description: error.message });
    }
  });

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    queryClient.setQueryData([api.auth.me.path], null);
    queryClient.clear();
    setLocation("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading: isLoading && !!token,
        login: loginMutation.mutate,
        register: registerMutation.mutate,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
