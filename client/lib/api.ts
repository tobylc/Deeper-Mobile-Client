const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://joindeeper.com";

export interface ApiError extends Error {
  status?: number;
  isNetworkError?: boolean;
  isRetryable?: boolean;
}

export interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryMultiplier?: number;
  retryOn?: number[];
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  retryDelay: 1000,
  retryMultiplier: 2,
  retryOn: [408, 429, 500, 502, 503, 504],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return true;
  }
  if (error instanceof Error && error.message.includes("Network request failed")) {
    return true;
  }
  return false;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  config: RetryConfig = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: ApiError | null = null;
  let attempt = 0;

  while (attempt <= retryConfig.maxRetries) {
    try {
      const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;
      
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: ApiError = new Error(errorData.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.isNetworkError = false;
        error.isRetryable = retryConfig.retryOn.includes(response.status);

        if (error.isRetryable && attempt < retryConfig.maxRetries) {
          lastError = error;
          attempt++;
          const delay = retryConfig.retryDelay * Math.pow(retryConfig.retryMultiplier, attempt - 1);
          await sleep(delay);
          continue;
        }

        throw error;
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      }
      
      return {} as T;
    } catch (error) {
      if (isNetworkError(error) && attempt < retryConfig.maxRetries) {
        const apiError: ApiError = new Error("Network connection failed. Please check your internet connection.");
        apiError.isNetworkError = true;
        apiError.isRetryable = true;
        lastError = apiError;
        attempt++;
        const delay = retryConfig.retryDelay * Math.pow(retryConfig.retryMultiplier, attempt - 1);
        await sleep(delay);
        continue;
      }

      if (error instanceof Error && "status" in error) {
        throw error;
      }

      const apiError: ApiError = new Error(
        isNetworkError(error)
          ? "Network connection failed. Please check your internet connection."
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred"
      );
      apiError.isNetworkError = isNetworkError(error);
      throw apiError;
    }
  }

  throw lastError || new Error("Request failed after retries");
}

export function getAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export { API_URL };
