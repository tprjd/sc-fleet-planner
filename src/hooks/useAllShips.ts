import { useQuery } from "@tanstack/react-query";
import type { Ship } from "@/types";
import { fetchAllShips } from "@/lib/shipApi";
import { FALLBACK_SHIPS } from "@/lib/fallbackShips";

/**
 * All Star Citizen ships, fetched once and cached for 24h (persisted to
 * localStorage by the QueryClient persister). On API failure the query
 * resolves to the bundled fallback list and flags `usedFallback`.
 */
export function useAllShips() {
  const query = useQuery({
    queryKey: ["ships", "v1"],
    queryFn: async (): Promise<{ ships: Ship[]; usedFallback: boolean }> => {
      try {
        const ships = await fetchAllShips();
        return { ships, usedFallback: false };
      } catch (err) {
        console.warn("[fleet-planner] ship API failed, using fallback:", err);
        return { ships: FALLBACK_SHIPS, usedFallback: true };
      }
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  return {
    ships: query.data?.ships ?? [],
    usedFallback: query.data?.usedFallback ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
