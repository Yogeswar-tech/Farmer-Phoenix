import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { getCrops } from "@/lib/api";
import { ApiError, Crop } from "@/lib/types";

export function useCrops(lang: string): UseQueryResult<Crop[], ApiError> {
  return useQuery<Crop[], ApiError>({
    queryKey: ["crops", lang],
    queryFn: () => getCrops(lang),
    enabled: !!lang,
  });
}
