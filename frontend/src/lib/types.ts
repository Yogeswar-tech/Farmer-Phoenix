export type ApiErrorKind = "network" | "timeout" | "http_status" | "bad_response";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export interface Card {
  headline: string;
  bullets: string[];
  audio_url?: string;
}

export interface ProvenanceItem {
  label: string;
  as_of: string;
  source: string;
}

export interface Freshness {
  stale: boolean;
}

export interface CacheInfo {
  status: "HIT" | "MISS" | "PARTIAL";
  llm_calls: number;
}

export interface FarmerEnvelope {
  request_id: string;
  lang: string;
  card: Card;
  numbers: Record<string, number>;
  provenance: ProvenanceItem[];
  freshness: Freshness;
  cache: CacheInfo;
  disclaimer_key: string;
}

export interface Crop {
  id: string;
  name: string;
  image?: string;
}

export interface Mandi {
  id: string;
  name: string;
  dist_km: number;
}

export interface Region {
  region_id: string;
  mandis: Mandi[];
}
