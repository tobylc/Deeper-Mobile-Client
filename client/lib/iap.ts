import { Platform } from "react-native";
import { apiRequest, getAuthHeaders } from "./api";

let InAppPurchases: typeof import("expo-in-app-purchases") | null = null;
let iapLoadError: Error | null = null;

async function getIAPModule() {
  if (InAppPurchases) return InAppPurchases;
  if (iapLoadError) return null;
  
  try {
    InAppPurchases = await import("expo-in-app-purchases");
    return InAppPurchases;
  } catch (error) {
    iapLoadError = error as Error;
    console.log("expo-in-app-purchases not available:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

export const PRODUCT_IDS = {
  BASIC_MONTHLY: "com.deeper.app.basic.monthly",
  BASIC_YEARLY: "com.deeper.app.basic.yearly",
  ADVANCED_MONTHLY: "com.deeper.app.advanced.monthly",
  ADVANCED_YEARLY: "com.deeper.app.advanced.yearly",
  UNLIMITED_MONTHLY: "com.deeper.app.unlimited.monthly",
  UNLIMITED_YEARLY: "com.deeper.app.unlimited.yearly",
};

export const ALL_PRODUCT_IDS = Object.values(PRODUCT_IDS);

export type SubscriptionTier = "trial" | "basic" | "advanced" | "unlimited";

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
}

export interface PurchaseResult {
  success: boolean;
  tier?: SubscriptionTier;
  error?: string;
  requiresAction?: boolean;
}

export interface ReceiptValidationResponse {
  valid: boolean;
  tier: SubscriptionTier;
  expiresAt: string;
  error?: string;
}

let isConnected = false;

export async function connectToStore(): Promise<boolean> {
  if (Platform.OS === "web") {
    console.log("IAP not available on web");
    return false;
  }

  if (isConnected) {
    return true;
  }

  try {
    const IAP = await getIAPModule();
    if (!IAP || typeof IAP.connectAsync !== "function") {
      console.log("IAP module not available or connectAsync missing");
      return false;
    }
    await IAP.connectAsync();
    isConnected = true;
    return true;
  } catch (error) {
    console.error("Failed to connect to store:", error);
    return false;
  }
}

export async function disconnectFromStore(): Promise<void> {
  if (!isConnected) return;
  
  try {
    const IAP = await getIAPModule();
    if (IAP) {
      await IAP.disconnectAsync();
    }
    isConnected = false;
  } catch (error) {
    console.error("Failed to disconnect from store:", error);
  }
}

export async function loadProducts(): Promise<IAPProduct[]> {
  if (Platform.OS === "web") {
    return getMockProducts();
  }

  try {
    const IAP = await getIAPModule();
    if (!IAP || typeof IAP.getProductsAsync !== "function") {
      return getMockProducts();
    }

    const connected = await connectToStore();
    if (!connected) {
      return getMockProducts();
    }

    const { results, responseCode } = await IAP.getProductsAsync(ALL_PRODUCT_IDS);
    
    if (responseCode !== IAP.IAPResponseCode.OK || !results) {
      console.error("Failed to load products:", responseCode);
      return getMockProducts();
    }

    return results.map((product) => ({
      productId: product.productId,
      title: product.title,
      description: product.description,
      price: product.price,
      priceAmountMicros: product.priceAmountMicros,
      priceCurrencyCode: product.priceCurrencyCode,
    }));
  } catch (error) {
    console.error("Error loading products:", error);
    return getMockProducts();
  }
}

let activePurchaseResolver: ((result: PurchaseResult) => void) | null = null;
let activePurchaseToken: string | null = null;

async function processPurchaseTransaction(
  IAP: typeof import("expo-in-app-purchases"),
  purchase: import("expo-in-app-purchases").InAppPurchase,
  token: string
): Promise<PurchaseResult> {
  try {
    const validationResult = await validateReceipt(
      purchase.transactionReceipt || "",
      purchase.productId,
      purchase.orderId || "",
      token
    );

    if (validationResult.valid) {
      await IAP.finishTransactionAsync(purchase, true);
      return {
        success: true,
        tier: validationResult.tier,
      };
    } else {
      await IAP.finishTransactionAsync(purchase, false);
      return {
        success: false,
        error: validationResult.error || "Receipt validation failed",
      };
    }
  } catch (error) {
    console.error("Error validating purchase:", error);
    return {
      success: false,
      error: "Failed to validate purchase. Please contact support.",
    };
  }
}

export async function initializePurchaseListener(token: string): Promise<void> {
  const IAP = await getIAPModule();
  if (!IAP || typeof IAP.setPurchaseListener !== "function") {
    console.log("IAP setPurchaseListener not available");
    return;
  }

  IAP.setPurchaseListener(async ({ responseCode, results }) => {
    if (responseCode === IAP.IAPResponseCode.OK && results) {
      for (const purchase of results) {
        if (!purchase.acknowledged) {
          const currentToken = activePurchaseToken || token;
          const result = await processPurchaseTransaction(IAP, purchase, currentToken);
          
          if (activePurchaseResolver) {
            activePurchaseResolver(result);
            activePurchaseResolver = null;
            activePurchaseToken = null;
          }
        }
      }
    } else if (responseCode === IAP.IAPResponseCode.USER_CANCELED) {
      if (activePurchaseResolver) {
        activePurchaseResolver({
          success: false,
          error: "Purchase cancelled",
        });
        activePurchaseResolver = null;
        activePurchaseToken = null;
      }
    } else if (responseCode === IAP.IAPResponseCode.DEFERRED) {
      if (activePurchaseResolver) {
        activePurchaseResolver({
          success: false,
          requiresAction: true,
          error: "Purchase requires approval (e.g., parental consent)",
        });
        activePurchaseResolver = null;
        activePurchaseToken = null;
      }
    } else {
      if (activePurchaseResolver) {
        activePurchaseResolver({
          success: false,
          error: `Purchase failed with code: ${responseCode}`,
        });
        activePurchaseResolver = null;
        activePurchaseToken = null;
      }
    }
  });
}

export async function purchaseProduct(
  productId: string,
  token: string
): Promise<PurchaseResult> {
  if (Platform.OS === "web") {
    return {
      success: false,
      error: "In-app purchases are not available on web. Please use the iOS app.",
    };
  }

  try {
    const IAP = await getIAPModule();
    if (!IAP || typeof IAP.purchaseItemAsync !== "function") {
      return {
        success: false,
        error: "In-app purchases require a development build. This feature is not available in Expo Go.",
      };
    }

    const connected = await connectToStore();
    if (!connected) {
      return {
        success: false,
        error: "Unable to connect to App Store. Please try again.",
      };
    }

    activePurchaseToken = token;
    
    return new Promise((resolve) => {
      activePurchaseResolver = resolve;
      IAP.purchaseItemAsync(productId).catch((error) => {
        console.error("Purchase initiation error:", error);
        activePurchaseResolver = null;
        activePurchaseToken = null;
        resolve({
          success: false,
          error: error instanceof Error ? error.message : "Failed to start purchase",
        });
      });
    });
  } catch (error) {
    console.error("Purchase error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Purchase failed",
    };
  }
}

export async function restorePurchases(token: string): Promise<PurchaseResult> {
  if (Platform.OS === "web") {
    return {
      success: false,
      error: "Restore purchases is not available on web.",
    };
  }

  try {
    const IAP = await getIAPModule();
    if (!IAP || typeof IAP.getPurchaseHistoryAsync !== "function") {
      return {
        success: false,
        error: "In-app purchases require a development build. This feature is not available in Expo Go.",
      };
    }

    const connected = await connectToStore();
    if (!connected) {
      return {
        success: false,
        error: "Unable to connect to App Store. Please try again.",
      };
    }

    const { responseCode, results } = await IAP.getPurchaseHistoryAsync();

    if (responseCode !== IAP.IAPResponseCode.OK) {
      return {
        success: false,
        error: "Failed to retrieve purchase history",
      };
    }

    if (!results || results.length === 0) {
      return {
        success: false,
        error: "No previous purchases found",
      };
    }

    const latestPurchase = results[results.length - 1];
    const validationResult = await validateReceipt(
      latestPurchase.transactionReceipt || "",
      latestPurchase.productId,
      latestPurchase.orderId || "",
      token
    );

    if (validationResult.valid) {
      return {
        success: true,
        tier: validationResult.tier,
      };
    } else {
      return {
        success: false,
        error: validationResult.error || "Failed to restore purchases",
      };
    }
  } catch (error) {
    console.error("Restore purchases error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Restore failed",
    };
  }
}

async function validateReceipt(
  receiptData: string,
  productId: string,
  transactionId: string,
  token: string
): Promise<ReceiptValidationResponse> {
  try {
    const response = await apiRequest<ReceiptValidationResponse>(
      "/api/mobile/subscriptions/ios/verify",
      {
        method: "POST",
        headers: {
          ...getAuthHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiptData,
          productId,
          transactionId,
          platform: "ios",
        }),
      }
    );

    return response;
  } catch (error) {
    console.error("Receipt validation error:", error);
    return {
      valid: false,
      tier: "trial",
      expiresAt: "",
      error: "Failed to validate receipt with server",
    };
  }
}

export async function getSubscriptionStatus(token: string): Promise<{
  tier: SubscriptionTier;
  status: string;
  expiresAt?: string;
  maxConnections: number;
}> {
  try {
    const response = await apiRequest<{
      tier: SubscriptionTier;
      status: string;
      expiresAt?: string;
      maxConnections: number;
    }>("/api/mobile/subscriptions/status", {
      headers: getAuthHeaders(token),
    });
    return response;
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    return {
      tier: "trial",
      status: "unknown",
      maxConnections: 1,
    };
  }
}

export function getTierFromProductId(productId: string): SubscriptionTier {
  if (productId.includes("basic")) return "basic";
  if (productId.includes("advanced")) return "advanced";
  if (productId.includes("unlimited")) return "unlimited";
  return "trial";
}

export function getProductIdForTier(
  tier: SubscriptionTier,
  period: "monthly" | "yearly" = "monthly"
): string {
  switch (tier) {
    case "basic":
      return period === "yearly" ? PRODUCT_IDS.BASIC_YEARLY : PRODUCT_IDS.BASIC_MONTHLY;
    case "advanced":
      return period === "yearly" ? PRODUCT_IDS.ADVANCED_YEARLY : PRODUCT_IDS.ADVANCED_MONTHLY;
    case "unlimited":
      return period === "yearly" ? PRODUCT_IDS.UNLIMITED_YEARLY : PRODUCT_IDS.UNLIMITED_MONTHLY;
    default:
      return PRODUCT_IDS.BASIC_MONTHLY;
  }
}

function getMockProducts(): IAPProduct[] {
  return [
    {
      productId: PRODUCT_IDS.BASIC_MONTHLY,
      title: "Basic Monthly",
      description: "3 connections, basic features",
      price: "$4.99",
      priceAmountMicros: 4990000,
      priceCurrencyCode: "USD",
    },
    {
      productId: PRODUCT_IDS.BASIC_YEARLY,
      title: "Basic Yearly",
      description: "3 connections, basic features - Save 17%",
      price: "$49.99",
      priceAmountMicros: 49990000,
      priceCurrencyCode: "USD",
    },
    {
      productId: PRODUCT_IDS.ADVANCED_MONTHLY,
      title: "Advanced Monthly",
      description: "10 connections, all features",
      price: "$9.99",
      priceAmountMicros: 9990000,
      priceCurrencyCode: "USD",
    },
    {
      productId: PRODUCT_IDS.ADVANCED_YEARLY,
      title: "Advanced Yearly",
      description: "10 connections, all features - Save 17%",
      price: "$99.99",
      priceAmountMicros: 99990000,
      priceCurrencyCode: "USD",
    },
    {
      productId: PRODUCT_IDS.UNLIMITED_MONTHLY,
      title: "Unlimited Monthly",
      description: "Unlimited connections, priority support",
      price: "$19.99",
      priceAmountMicros: 19990000,
      priceCurrencyCode: "USD",
    },
    {
      productId: PRODUCT_IDS.UNLIMITED_YEARLY,
      title: "Unlimited Yearly",
      description: "Unlimited connections, priority support - Save 17%",
      price: "$199.99",
      priceAmountMicros: 199990000,
      priceCurrencyCode: "USD",
    },
  ];
}

export function formatPrice(priceAmountMicros: number, currencyCode: string): string {
  const price = priceAmountMicros / 1000000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(price);
}
