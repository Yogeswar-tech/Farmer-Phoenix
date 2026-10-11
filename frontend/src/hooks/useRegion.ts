import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { resolveRegion } from "@/lib/api";
import { ApiError, Region } from "@/lib/types";

export function useRegion(
  lat: number | null,
  lon: number | null
): UseQueryResult<Region, ApiError> {
  return useQuery<Region, ApiError>({
    queryKey: ["region", lat, lon],
    queryFn: () => resolveRegion(lat!, lon!),
    enabled: lat !== null && lon !== null,
  });
}
