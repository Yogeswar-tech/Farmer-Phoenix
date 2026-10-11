import {
  ApiError,
  Crop,
  FarmerEnvelope,
  Region,
} from "./types";
import {
  mockAskText,
  mockGetCrops,
  mockGetInsight,
  mockResolveRegion,
  mockSendPhoto,
} from "./mock";
import { getLastInsight, saveLastInsight } from "./storage";

const REQUEST_TIMEOUT_MS = 15000;

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
}

function isMockEnabled(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK === "true";
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getBaseUrl()}${endpoint}`, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new ApiError(
        "http_status",
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    try {
      const data = await response.json();
      return data as T;
    } catch {
      throw new ApiError("bad_response", "Failed to parse JSON response");
    }
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new ApiError("timeout", "Request timed out after 15 seconds");
      }
      throw new ApiError("network", error.message || "Network request failed");
    }

    throw new ApiError("network", "An unknown error occurred");
  }
}

export async function getHealth(): Promise<{ status: string }> {
  if (isMockEnabled()) {
    return { status: "ok" };
  }
  return request<{ status: string }>("/v1/health");
}

export async function getCrops(lang: string): Promise<Crop[]> {
  if (isMockEnabled()) {
    return mockGetCrops(lang);
  }
  try {
    return await request<Crop[]>(`/v1/crops?lang=${encodeURIComponent(lang)}`);
  } catch {
    return mockGetCrops(lang);
  }
}

export async function resolveRegion(lat: number, lon: number): Promise<Region> {
  if (isMockEnabled()) {
    return mockResolveRegion(lat, lon);
  }
  try {
    return await request<Region>(
      `/v1/regions/resolve?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
    );
  } catch {
    return mockResolveRegion(lat, lon);
  }
}

export async function getInsight(
  crop: string,
  region: string,
  lang: string
): Promise<FarmerEnvelope> {
  if (isMockEnabled()) {
    return mockGetInsight(crop, region, lang);
  }

  try {
    const data = await request<FarmerEnvelope>(
      `/v1/insight?crop=${encodeURIComponent(crop)}&region=${encodeURIComponent(
        region
      )}&lang=${encodeURIComponent(lang)}`
    );
    await saveLastInsight(crop, data);
    return data;
  } catch {
    const cached = await getLastInsight(crop);
    if (cached) {
      return {
        ...cached,
        freshness: {
          stale: true,
        },
      };
    }
    return mockGetInsight(crop, region, lang);
  }
}

export async function askText(
  question: string,
  crop: string,
  region: string,
  lang: string
): Promise<FarmerEnvelope> {
  if (isMockEnabled()) {
    return mockAskText(question, crop, region, lang);
  }

  try {
    return await request<FarmerEnvelope>("/v1/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question, crop, region, lang }),
    });
  } catch {
    return mockAskText(question, crop, region, lang);
  }
}

export async function sendPhoto(
  file: Blob | File | { uri: string; name?: string; type?: string },
  crop: string,
  region: string,
  lang: string
): Promise<FarmerEnvelope> {
  if (isMockEnabled()) {
    return mockSendPhoto(file, crop, region, lang);
  }

  const formData = new FormData();
  formData.append("file", file as unknown as Blob);
  formData.append("crop", crop);
  formData.append("region", region);
  formData.append("lang", lang);

  return request<FarmerEnvelope>("/v1/photo", {
    method: "POST",
    body: formData,
  });
}
