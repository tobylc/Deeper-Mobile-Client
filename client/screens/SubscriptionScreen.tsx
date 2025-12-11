import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { AppStackParamList } from "@/navigation/RootStackNavigator";
import {
  loadProducts,
  purchaseProduct,
  restorePurchases,
  connectToStore,
  disconnectFromStore,
  initializePurchaseListener,
  getProductIdForTier,
  IAPProduct,
  SubscriptionTier,
} from "@/lib/iap";

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, "Subscription">;
};

interface TierConfig {
  id: SubscriptionTier;
  name: string;
  defaultPrice: string;
  period: string;
  connections: number;
  features: string[];
  popular?: boolean;
}

const TIER_CONFIGS: TierConfig[] = [
  {
    id: "basic",
    name: "Basic",
    defaultPrice: "$4.99",
    period: "month",
    connections: 3,
    features: [
      "3 meaningful connections",
      "Unlimited conversations",
      "Voice messages",
      "Question suggestions",
    ],
  },
  {
    id: "advanced",
    name: "Advanced",
    defaultPrice: "$9.99",
    period: "month",
    connections: 10,
    features: [
      "10 meaningful connections",
      "Unlimited conversations",
      "Voice messages",
      "AI-powered questions",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "unlimited",
    name: "Unlimited",
    defaultPrice: "$19.99",
    period: "month",
    connections: -1,
    features: [
      "Unlimited connections",
      "Unlimited conversations",
      "Voice messages",
      "AI-powered questions",
      "Priority support",
      "Early access to features",
    ],
  },
];

export default function SubscriptionScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, token, refreshUser } = useAuth();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionTier>("trial");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    if (user) {
      const tier = ((user as any)?.subscriptionTier as SubscriptionTier) || "trial";
      setCurrentSubscription(tier);
    }
  }, [user]);

  useEffect(() => {
    initializeIAP();
    return () => {
      disconnectFromStore();
    };
  }, [token]);

  const initializeIAP = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      await connectToStore();
      if (token) {
        await initializePurchaseListener(token);
      }
      const loadedProducts = await loadProducts();
      setProducts(loadedProducts);
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [token]);

  const getProductPrice = useCallback(
    (tier: SubscriptionTier): string => {
      const productId = getProductIdForTier(tier, billingPeriod);
      const product = products.find((p) => p.productId === productId);
      if (product) {
        return product.price;
      }
      const config = TIER_CONFIGS.find((t) => t.id === tier);
      return config?.defaultPrice || "$4.99";
    },
    [products, billingPeriod]
  );

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (!token) {
      Alert.alert("Error", "Please log in to subscribe.");
      return;
    }

    setSelectedTier(tier);
    setIsLoading(true);

    try {
      if (Platform.OS === "web") {
        await WebBrowser.openBrowserAsync(`https://joindeeper.com/upgrade?plan=${tier}`);
        await refreshUser();
      } else {
        const productId = getProductIdForTier(tier, billingPeriod);
        const result = await purchaseProduct(productId, token);

        if (result.success) {
          await refreshUser();
          Alert.alert(
            "Subscription Activated",
            `Welcome to ${tier.charAt(0).toUpperCase() + tier.slice(1)}! Your subscription is now active.`,
            [{ text: "OK", onPress: () => navigation.goBack() }]
          );
        } else if (result.requiresAction) {
          Alert.alert(
            "Approval Required",
            result.error || "This purchase requires additional approval."
          );
        } else if (result.error !== "Purchase cancelled") {
          Alert.alert("Purchase Failed", result.error || "Unable to complete purchase.");
        }
      }
    } catch (error) {
      console.error("Subscription error:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
      setSelectedTier(null);
    }
  };

  const handleRestorePurchases = async () => {
    if (!token) {
      Alert.alert("Error", "Please log in to restore purchases.");
      return;
    }

    setIsRestoring(true);
    try {
      if (Platform.OS === "web") {
        await refreshUser();
        const newTier = ((user as any)?.subscriptionTier as SubscriptionTier) || "trial";
        if (newTier !== "trial") {
          Alert.alert("Restored", `Your ${newTier} subscription has been restored.`);
        } else {
          Alert.alert("No Purchases Found", "No previous purchases were found for this account.");
        }
      } else {
        const result = await restorePurchases(token);
        
        if (result.success) {
          await refreshUser();
          Alert.alert(
            "Purchases Restored",
            `Your ${result.tier} subscription has been restored.`
          );
        } else {
          Alert.alert(
            "Restore Failed",
            result.error || "Unable to restore purchases. Please contact support if you believe this is an error."
          );
        }
      }
    } catch (error) {
      console.error("Restore error:", error);
      Alert.alert("Error", "Unable to restore purchases. Please try again later.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    if (Platform.OS === "ios") {
      try {
        await Linking.openURL("https://apps.apple.com/account/subscriptions");
      } catch {
        await WebBrowser.openBrowserAsync("https://joindeeper.com/account");
      }
    } else {
      await WebBrowser.openBrowserAsync("https://joindeeper.com/account");
    }
  };

  const openTerms = async () => {
    await WebBrowser.openBrowserAsync("https://joindeeper.com/terms");
  };

  const openPrivacy = async () => {
    await WebBrowser.openBrowserAsync("https://joindeeper.com/privacy");
  };

  const isCurrentPlan = (tier: SubscriptionTier) => {
    return currentSubscription === tier;
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText type="h2" style={styles.title}>
            Choose Your Plan
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            Unlock deeper connections with the right plan for you
          </ThemedText>
        </View>

        <View style={styles.periodToggle}>
          <Pressable
            onPress={() => setBillingPeriod("monthly")}
            style={[
              styles.periodButton,
              billingPeriod === "monthly" && { backgroundColor: theme.primary },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: billingPeriod === "monthly" ? "#fff" : theme.textSecondary,
                fontWeight: "600",
              }}
            >
              Monthly
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setBillingPeriod("yearly")}
            style={[
              styles.periodButton,
              billingPeriod === "yearly" && { backgroundColor: theme.primary },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: billingPeriod === "yearly" ? "#fff" : theme.textSecondary,
                fontWeight: "600",
              }}
            >
              Yearly
            </ThemedText>
            <View style={[styles.saveBadge, { backgroundColor: theme.success }]}>
              <ThemedText type="small" style={{ color: "#fff", fontSize: 10 }}>
                Save 17%
              </ThemedText>
            </View>
          </Pressable>
        </View>

        {currentSubscription !== "trial" ? (
          <Card elevation={1} style={{ ...styles.currentPlanCard, borderColor: theme.primary }}>
            <View style={styles.currentPlanHeader}>
              <View style={[styles.currentPlanIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="check-circle" size={20} color={theme.primary} />
              </View>
              <View style={styles.currentPlanInfo}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Current Plan
                </ThemedText>
                <ThemedText type="h4" style={{ textTransform: "capitalize" }}>
                  {currentSubscription}
                </ThemedText>
              </View>
              <Pressable
                onPress={handleManageSubscription}
                style={[styles.manageButton, { borderColor: theme.border }]}
              >
                <ThemedText type="small" style={{ color: theme.primary }}>
                  Manage
                </ThemedText>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {isLoadingProducts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              Loading subscription options...
            </ThemedText>
          </View>
        ) : (
          <View style={styles.tiersContainer}>
            {TIER_CONFIGS.map((tier) => {
              const isCurrent = isCurrentPlan(tier.id);
              const isSelected = selectedTier === tier.id;
              const price = getProductPrice(tier.id);

              return (
                <Pressable
                  key={tier.id}
                  onPress={() => !isCurrent && !isLoading && handleSubscribe(tier.id)}
                  disabled={isCurrent || isLoading}
                >
                  <Card
                    elevation={tier.popular ? 2 : 1}
                    style={{
                      ...styles.tierCard,
                      borderColor: tier.popular ? theme.primary : "transparent",
                      borderWidth: tier.popular ? 2 : 0,
                      opacity: isCurrent ? 0.7 : 1,
                    }}
                  >
                    {tier.popular ? (
                      <View style={[styles.popularBadge, { backgroundColor: theme.primary }]}>
                        <ThemedText type="small" style={{ color: "#fff", fontWeight: "600" }}>
                          Most Popular
                        </ThemedText>
                      </View>
                    ) : null}

                    <View style={styles.tierHeader}>
                      <ThemedText type="h3">{tier.name}</ThemedText>
                      <View style={styles.priceContainer}>
                        <ThemedText type="h2" style={{ color: theme.primary }}>
                          {price}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          /{billingPeriod === "yearly" ? "yr" : "mo"}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.connectionsRow}>
                      <Feather name="users" size={16} color={theme.accent} />
                      <ThemedText type="body" style={{ marginLeft: Spacing.sm, fontWeight: "600" }}>
                        {tier.connections === -1 ? "Unlimited" : tier.connections} connection
                        {tier.connections !== 1 ? "s" : ""}
                      </ThemedText>
                    </View>

                    <View style={styles.featuresContainer}>
                      {tier.features.map((feature, index) => (
                        <View key={index} style={styles.featureRow}>
                          <Feather name="check" size={16} color={theme.success} />
                          <ThemedText type="small" style={{ marginLeft: Spacing.sm, flex: 1 }}>
                            {feature}
                          </ThemedText>
                        </View>
                      ))}
                    </View>

                    <Button
                      onPress={() => handleSubscribe(tier.id)}
                      disabled={isCurrent || isLoading}
                      loading={isSelected && isLoading}
                      variant={tier.popular ? "primary" : "secondary"}
                      style={styles.subscribeButton}
                    >
                      {isCurrent ? "Current Plan" : "Subscribe"}
                    </Button>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.restoreSection}>
          <Pressable
            onPress={handleRestorePurchases}
            disabled={isRestoring}
            style={styles.restoreButton}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <ThemedText type="body" style={{ color: theme.primary }}>
                Restore Purchases
              </ThemedText>
            )}
          </Pressable>
        </View>

        <View style={styles.legalSection}>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.md }}
          >
            Payment will be charged to your Apple ID account at confirmation of purchase.
            Subscription automatically renews unless it is canceled at least 24 hours before the
            end of the current period. Your account will be charged for renewal within 24 hours
            prior to the end of the current period. You can manage and cancel your subscriptions by
            going to your account settings on the App Store after purchase.
          </ThemedText>

          <View style={styles.legalLinks}>
            <Pressable onPress={openTerms}>
              <ThemedText type="small" style={{ color: theme.primary }}>
                Terms of Service
              </ThemedText>
            </Pressable>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {" | "}
            </ThemedText>
            <Pressable onPress={openPrivacy}>
              <ThemedText type="small" style={{ color: theme.primary }}>
                Privacy Policy
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  periodToggle: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  periodButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  saveBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
  },
  currentPlanCard: {
    padding: Spacing.lg,
    borderWidth: 1,
  },
  currentPlanHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  currentPlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  currentPlanInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  manageButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  tiersContainer: {
    gap: Spacing.lg,
  },
  tierCard: {
    padding: Spacing.xl,
    position: "relative",
    overflow: "hidden",
  },
  popularBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderBottomLeftRadius: BorderRadius.md,
  },
  tierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  connectionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  featuresContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subscribeButton: {
    width: "100%",
  },
  restoreSection: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  restoreButton: {
    padding: Spacing.md,
  },
  legalSection: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
