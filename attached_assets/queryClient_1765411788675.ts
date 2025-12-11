import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Declare queryClient first to avoid circular dependency
export const queryClient = new QueryClient();

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Handle authentication failures by redirecting to login
    if (res.status === 401) {
      console.log('[AUTH] Session expired or invalid, redirecting to login');
      // Clear any existing query cache
      queryClient.clear();
      // Redirect to auth page
      window.location.href = '/auth';
      return;
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // Handle empty responses gracefully
    const text = await res.text();
    if (!text) {
      return null;
    }
    
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error("Failed to parse JSON response:", text);
      throw new Error("Invalid JSON response");
    }
  };

// Configure queryClient with default options
queryClient.setDefaultOptions({
  queries: {
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: false,
  },
  mutations: {
    retry: false,
  },
});
