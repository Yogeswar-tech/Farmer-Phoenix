import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { getInsight } from "@/lib/api";
import { ApiError, FarmerEnvelope } from "@/lib/types";

export function useInsight(
  crop: string,
  region: string,
  lang: string
): UseQueryResult<FarmerEnvelope, ApiError> {
  return useQuery<FarmerEnvelope, ApiError>({
    queryKey: ["insight", crop, region, lang],
    queryFn: () => getInsight(crop, region, lang),
    enabled: !!crop && !!region && !!lang,
    retry: false,
  });
}
