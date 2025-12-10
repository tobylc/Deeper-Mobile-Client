import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { AuthStackParamList } from "@/navigation/RootStackNavigator";

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Signup">;
};

export default function SignupScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { signup } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const getPasswordStrength = (pwd: string): { level: number; text: string; color: string } => {
    if (pwd.length === 0) return { level: 0, text: "", color: theme.border };
    if (pwd.length < 6) return { level: 1, text: "Weak", color: theme.error };
    if (pwd.length < 8) return { level: 2, text: "Fair", color: "#F59E0B" };
    if (pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) {
      return { level: 4, text: "Strong", color: theme.success };
    }
    return { level: 3, text: "Good", color: "#10B981" };
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await signup(email.trim().toLowerCase(), password);
    } catch (error) {
      Alert.alert(
        "Signup Failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const openLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      console.error("Failed to open link:", error);
    }
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <ThemedText type="h1" style={styles.title}>
            Create Account
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.subtitle, { color: theme.textSecondary }]}
          >
            Join Deeper to get started
          </ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <ThemedText type="small" style={styles.label}>
              Email
            </ThemedText>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: errors.email ? theme.error : theme.border,
                },
              ]}
            >
              <Feather
                name="mail"
                size={20}
                color={theme.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter your email"
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                editable={!isLoading}
              />
            </View>
            {errors.email ? (
              <ThemedText type="small" style={[styles.errorText, { color: theme.error }]}>
                {errors.email}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.inputContainer}>
            <ThemedText type="small" style={styles.label}>
              Password
            </ThemedText>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: errors.password ? theme.error : theme.border,
                },
              ]}
            >
              <Feather
                name="lock"
                size={20}
                color={theme.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Create a password"
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: undefined });
                }}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                editable={!isLoading}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={8}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>
            {password.length > 0 ? (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            level <= passwordStrength.level
                              ? passwordStrength.color
                              : theme.border,
                        },
                      ]}
                    />
                  ))}
                </View>
                <ThemedText
                  type="small"
                  style={{ color: passwordStrength.color, marginLeft: Spacing.sm }}
                >
                  {passwordStrength.text}
                </ThemedText>
              </View>
            ) : null}
            {errors.password ? (
              <ThemedText type="small" style={[styles.errorText, { color: theme.error }]}>
                {errors.password}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.inputContainer}>
            <ThemedText type="small" style={styles.label}>
              Confirm Password
            </ThemedText>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: errors.confirmPassword ? theme.error : theme.border,
                },
              ]}
            >
              <Feather
                name="lock"
                size={20}
                color={theme.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Confirm your password"
                placeholderTextColor={theme.textSecondary}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword)
                    setErrors({ ...errors, confirmPassword: undefined });
                }}
                secureTextEntry={!showConfirmPassword}
                returnKeyType="go"
                onSubmitEditing={handleSignup}
                editable={!isLoading}
              />
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
                hitSlop={8}
              >
                <Feather
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>
            {errors.confirmPassword ? (
              <ThemedText type="small" style={[styles.errorText, { color: theme.error }]}>
                {errors.confirmPassword}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.termsContainer}>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
              By signing up, you agree to our{" "}
            </ThemedText>
            <View style={styles.termsLinks}>
              <Pressable
                onPress={() => openLink("https://joindeeper.com/terms")}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <ThemedText type="link" style={styles.termsLink}>
                  Terms of Service
                </ThemedText>
              </Pressable>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {" "}and{" "}
              </ThemedText>
              <Pressable
                onPress={() => openLink("https://joindeeper.com/privacy")}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <ThemedText type="link" style={styles.termsLink}>
                  Privacy Policy
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <Button
            onPress={handleSignup}
            disabled={isLoading}
            style={styles.signupButton}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.buttonText} size="small" />
            ) : (
              "Sign Up"
            )}
          </Button>
        </View>

        <View style={styles.footer}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Already have an account?{" "}
          </ThemedText>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <ThemedText type="link">Log In</ThemedText>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
  },
  form: {
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  errorText: {
    marginTop: Spacing.xs,
  },
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  strengthBars: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  strengthBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  termsContainer: {
    marginBottom: Spacing.xl,
    alignItems: "center",
  },
  termsLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  termsLink: {
    fontSize: 14,
  },
  signupButton: {
    width: "100%",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
