import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest, getAuthHeaders, API_URL } from "./api";

const ACCESS_TOKEN_KEY = "@deeper_access_token";
const REFRESH_TOKEN_KEY = "@deeper_refresh_token";
const USER_KEY = "@deeper_user";
const NOTIFICATIONS_KEY = "@deeper_notifications_enabled";

interface User {
  id: string;
  email: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
  requiresEmailVerification?: boolean;
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
      const storedToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
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
    const userData = await apiRequest<User>(
      "/api/mobile/auth/user",
      {
        method: "GET",
        headers: getAuthHeaders(authToken),
      },
      { maxRetries: 2 }
    );
    
    setUser(userData);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
    return userData;
  };

  const login = async (email: string, password: string) => {
    const data = await apiRequest<AuthResponse & { token?: string; message?: string }>(
      "/api/mobile/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      { maxRetries: 1 }
    );
    
    if (data.message && !data.accessToken && !data.token) {
      throw new Error(data.message);
    }
    
    const authToken = data.accessToken || data.token;
    
    if (!authToken) {
      console.log("Login response:", JSON.stringify(data, null, 2));
      throw new Error("Login failed: No authentication token received");
    }
    if (!data.user) {
      throw new Error("Login failed: No user data received");
    }
    
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, authToken);
    if (data.refreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    
    setToken(authToken);
    setUser(data.user);
  };

  const signup = async (email: string, password: string) => {
    const data = await apiRequest<AuthResponse & { token?: string; message?: string }>(
      "/api/mobile/auth/signup",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      { maxRetries: 1 }
    );
    
    if (data.requiresEmailVerification) {
      throw new Error("Please check your email to verify your account before logging in.");
    }
    
    if (data.message && !data.accessToken && !data.token) {
      throw new Error(data.message);
    }
    
    const authToken = data.accessToken || data.token;
    
    if (!authToken) {
      console.log("Signup response:", JSON.stringify(data, null, 2));
      throw new Error("Signup failed: No authentication token received. Please try again or contact support.");
    }
    if (!data.user) {
      throw new Error("Signup failed: No user data received");
    }
    
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, authToken);
    if (data.refreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    
    setToken(authToken);
    setUser(data.user);
  };

  const clearAuth = async () => {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(NOTIFICATIONS_KEY);
    setToken(null);
    setUser(null);
  };

  const logout = useCallback(async () => {
    await clearAuth();
  }, []);

  const refreshToken = async () => {
    const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      await clearAuth();
      return;
    }

    try {
      const data = await apiRequest<{ accessToken: string; refreshToken?: string }>(
        "/api/mobile/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        },
        { maxRetries: 2 }
      );
      
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      if (data.refreshToken) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      }
      setToken(data.accessToken);
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
  try {
    await apiRequest(
      "/api/mobile/push-token",
      {
        method: "POST",
        headers: getAuthHeaders(authToken),
        body: JSON.stringify({ pushToken }),
      },
      { maxRetries: 1 }
    );
  } catch (error) {
    console.warn("Push token registration failed (non-critical):", error);
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
