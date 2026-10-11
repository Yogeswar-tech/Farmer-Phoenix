import { useMutation, UseMutationResult } from "@tanstack/react-query";
import { askText } from "@/lib/api";
import { ApiError, FarmerEnvelope } from "@/lib/types";

export interface AskParams {
  question: string;
  crop: string;
  region: string;
  lang: string;
}

export function useAsk(): UseMutationResult<
  FarmerEnvelope,
  ApiError,
  AskParams
> {
  return useMutation<FarmerEnvelope, ApiError, AskParams>({
    mutationFn: ({ question, crop, region, lang }) =>
      askText(question, crop, region, lang),
  });
}
