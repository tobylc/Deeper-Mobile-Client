import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const BIOMETRIC_ENABLED_KEY = "@deeper_biometric_enabled";
const BIOMETRIC_EMAIL_KEY = "deeper_biometric_email";
const BIOMETRIC_PASSWORD_KEY = "deeper_biometric_password";

export interface BiometricCapability {
  isAvailable: boolean;
  biometricType: "face" | "fingerprint" | "iris" | "none";
  hasEnrolledBiometrics: boolean;
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === "web") {
    return { isAvailable: false, biometricType: "none", hasEnrolledBiometrics: false };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType: "face" | "fingerprint" | "iris" | "none" = "none";
    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = "face";
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = "fingerprint";
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricType = "iris";
    }

    return {
      isAvailable: hasHardware && isEnrolled,
      biometricType,
      hasEnrolledBiometrics: isEnrolled,
    };
  } catch {
    return { isAvailable: false, biometricType: "none", hasEnrolledBiometrics: false };
  }
}

export async function authenticateWithBiometric(): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === "web") {
    return { success: false, error: "Biometric authentication not available on web" };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to access Deeper",
      cancelLabel: "Use Password",
      disableDeviceFallback: false,
      fallbackLabel: "Use Passcode",
    });

    if (result.success) {
      return { success: true };
    }

    return {
      success: false,
      error: result.error === "user_cancel" ? "Authentication cancelled" : result.error,
    };
  } catch (error) {
    return { success: false, error: "Authentication failed" };
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled.toString());
  } catch (error) {
    console.error("Error saving biometric preference:", error);
  }
}

export async function storeCredentialsForBiometric(email: string, password: string): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, password, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  } catch (error) {
    console.error("Error storing credentials securely:", error);
  }
}

export async function getStoredCredentials(): Promise<{ email: string; password: string } | null> {
  if (Platform.OS === "web") return null;

  try {
    const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
    const password = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY);
    
    if (email && password) {
      return { email, password };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearStoredCredentials(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    
    if (Platform.OS !== "web") {
      await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
    }
  } catch (error) {
    console.error("Error clearing biometric credentials:", error);
  }
}

export function getBiometricLabel(type: "face" | "fingerprint" | "iris" | "none"): string {
  switch (type) {
    case "face":
      return Platform.OS === "ios" ? "Face ID" : "Face Recognition";
    case "fingerprint":
      return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
    case "iris":
      return "Iris Recognition";
    default:
      return "Biometric";
  }
}

export function getBiometricIcon(type: "face" | "fingerprint" | "iris" | "none"): string {
  switch (type) {
    case "face":
      return "smile";
    case "fingerprint":
      return "lock";
    case "iris":
      return "eye";
    default:
      return "shield";
  }
}
