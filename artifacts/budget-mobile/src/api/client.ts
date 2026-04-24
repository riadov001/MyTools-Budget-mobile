import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "auth_token";

// API base URL resolution:
//   1. EXPO_PUBLIC_API_URL — set in eas.json profiles (dev/preview/production builds)
//   2. EXPO_PUBLIC_DOMAIN — set automatically by Replit dev server (web preview only)
//   3. Production fallback (custom domain)
function getBaseURL(): string {
  // Explicit override always wins (set in eas.json env per profile)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Web preview inside Replit — use the proxied dev domain
  if (Platform.OS === "web" && process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  // Production fallback
  return "https://mybudget.mytoolsgroup.eu";
}

// SecureStore is not available on web — fall back to localStorage
async function storeToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function retrieveToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function removeToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

const apiClient = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await retrieveToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function setAuthToken(token: string): Promise<void> {
  await storeToken(token);
}

export async function clearAuthToken(): Promise<void> {
  await removeToken();
}

export async function getAuthToken(): Promise<string | null> {
  return retrieveToken();
}

export default apiClient;
