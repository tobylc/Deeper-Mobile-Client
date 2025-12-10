import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://joindeeper.com";
const TOKEN_KEY = "@deeper_auth_token";
const USER_KEY = "@deeper_user";
const NOTIFICATIONS_KEY = "@deeper_notifications_enabled";

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        try {
          await fetchCurrentUser(storedToken);
        } catch (error) {
          await clearAuth();
        }
      }
    } catch (error) {
      console.error("Error loading auth:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentUser = async (authToken: string) => {
    const response = await fetch(`${API_URL}/api/mobile/auth/user`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user");
    }

    const userData = await response.json();
    setUser(userData);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
    return userData;
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/mobile/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Login failed");
    }

    const data = await response.json();
    
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    
    setToken(data.token);
    setUser(data.user);
  };

  const signup = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/mobile/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Signup failed");
    }

    const data = await response.json();
    
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    
    setToken(data.token);
    setUser(data.user);
  };

  const clearAuth = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(NOTIFICATIONS_KEY);
    setToken(null);
    setUser(null);
  };

  const logout = useCallback(async () => {
    await clearAuth();
  }, []);

  const refreshToken = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/mobile/auth/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
    } catch (error) {
      await clearAuth();
      throw error;
    }
  };

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      await fetchCurrentUser(token);
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        signup,
        logout,
        refreshToken,
        refreshUser,
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

export async function registerPushToken(authToken: string, pushToken: string) {
  const response = await fetch(`${API_URL}/api/mobile/push-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ token: pushToken }),
  });

  if (!response.ok) {
    throw new Error("Failed to register push token");
  }
}

export async function getNotificationPreference(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    return value === null ? true : value === "true";
  } catch {
    return true;
  }
}
