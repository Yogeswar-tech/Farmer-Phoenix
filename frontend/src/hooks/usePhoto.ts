import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { sendPhoto } from "@/lib/api";
import { ApiError, FarmerEnvelope } from "@/lib/types";

export interface PhotoParams {
  file: Blob | File | { uri: string; name?: string; type?: string };
  crop: string;
  region: string;
  lang: string;
}

export function usePhoto(): UseMutationResult<
  FarmerEnvelope,
  ApiError,
  PhotoParams
> {
  return useMutation<FarmerEnvelope, ApiError, PhotoParams>({
    mutationFn: ({ file, crop, region, lang }) =>
      sendPhoto(file, crop, region, lang),
  });
}
