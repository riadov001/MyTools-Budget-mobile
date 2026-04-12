import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";
import apiClient, {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from "@/src/api/client";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role?: string;
  consentCguAt?: string | null;
  consentPrivacyAt?: string | null;
  consentCookiesAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasConsent: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  recordConsent: (cgu: boolean, privacy: boolean, cookies: boolean) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  hasConsent: false,
  loginWithEmail: async () => {},
  logout: async () => {},
  recordConsent: async () => {},
  deleteAccount: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasConsent = !!(user?.consentCguAt && user?.consentPrivacyAt);
  const isAuthenticated = !!user && !!token;

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiClient.get<{ user: User }>("/api/auth/me");
      setUser(response.data.user ?? response.data);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError?.response?.status === 401) {
        await clearAuthToken();
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await getAuthToken();
        if (storedToken) {
          setToken(storedToken);
          const response = await apiClient.get<User>("/api/auth/me");
          const userData = (response.data as unknown as { user: User })?.user ?? response.data;
          setUser(userData);
        }
      } catch (error: unknown) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError?.response?.status === 401) {
          await clearAuthToken();
          setToken(null);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const response = await apiClient.post<{ token: string; user: User }>(
      "/api/auth/login",
      { email, password }
    );
    const { token: newToken, user: newUser } = response.data;
    await setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    await clearAuthToken();
    setToken(null);
    setUser(null);
  }, []);

  const recordConsent = useCallback(
    async (cgu: boolean, privacy: boolean, cookies: boolean) => {
      const response = await apiClient.post<{ user: User }>("/api/auth/consent", {
        cgu,
        privacy,
        cookies,
      });
      const updatedUser = response.data.user ?? (response.data as unknown as User);
      setUser(updatedUser);
    },
    []
  );

  const deleteAccount = useCallback(async () => {
    await apiClient.delete("/api/auth/account");
    await clearAuthToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        hasConsent,
        loginWithEmail,
        logout,
        recordConsent,
        deleteAccount,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
