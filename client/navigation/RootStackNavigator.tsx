import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { HeaderTitle } from "@/components/HeaderTitle";

import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";
import HomeScreen from "@/screens/HomeScreen";
import SettingsScreen from "@/screens/SettingsScreen";

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Settings: undefined;
};

export type RootStackParamList = AuthStackParamList & AppStackParamList;

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <AuthStack.Navigator screenOptions={screenOptions}>
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <AuthStack.Screen
        name="Signup"
        component={SignupScreen}
        options={{
          headerTitle: "Create Account",
          headerBackTitle: "Back",
        }}
      />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();

  return (
    <AppStack.Navigator screenOptions={screenOptions}>
      <AppStack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          headerTitle: () => <HeaderTitle title="Deeper" />,
          headerRight: () => (
            <HeaderButton
              onPress={() => navigation.navigate("Settings")}
              pressColor={theme.backgroundSecondary}
              pressOpacity={0.7}
            >
              <Feather name="settings" size={24} color={theme.text} />
            </HeaderButton>
          ),
        })}
      />
      <AppStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerTitle: "Settings",
          headerBackTitle: "Back",
        }}
      />
    </AppStack.Navigator>
  );
}

export default function RootStackNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return isAuthenticated ? <AppNavigator /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
