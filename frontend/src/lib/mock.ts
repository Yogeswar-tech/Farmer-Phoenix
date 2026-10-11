import { Crop, FarmerEnvelope, Region } from "./types";

export const MOCK_CROPS: Crop[] = [
  { id: "tomato", name: "Tomato", image: "https://example.com/tomato.png" },
  { id: "onion", name: "Onion", image: "https://example.com/onion.png" },
  { id: "potato", name: "Potato", image: "https://example.com/potato.png" },
];

export const MOCK_REGION: Region = {
  region_id: "reg_pune_01",
  mandis: [
    { id: "mandi_pune", name: "Pune APMC", dist_km: 12 },
    { id: "mandi_pimpri", name: "Pimpri Mandi", dist_km: 25 },
  ],
};

const SAMPLE_PROVENANCE = [
  {
    label: "Sample data",
    as_of: new Date().toISOString(),
    source: "Mock Data Source",
  },
];

export async function mockGetCrops(_lang: string): Promise<Crop[]> {
  return MOCK_CROPS;
}

export async function mockResolveRegion(
  _lat: number,
  _lon: number
): Promise<Region> {
  return MOCK_REGION;
}

export async function mockGetInsight(
  crop: string,
  region: string,
  lang: string
): Promise<FarmerEnvelope> {
  const isTomato = crop.toLowerCase() === "tomato";
  const mandiPrice = isTomato ? 18 : crop.toLowerCase() === "onion" ? 24 : 15;
  const retailPrice = isTomato ? 32 : crop.toLowerCase() === "onion" ? 40 : 25;

  return {
    request_id: `req_mock_insight_${Date.now()}`,
    lang,
    card: {
      headline: `${crop.charAt(0).toUpperCase() + crop.slice(1)} prices in ${region}`,
      bullets: [
        `Mandi modal price is ₹${mandiPrice}/kg.`,
        `Retail price is ₹${retailPrice}/kg.`,
        "Prices are expected to remain steady over the next few days.",
      ],
    },
    numbers: {
      mandi_modal_kg: mandiPrice,
      retail_kg: retailPrice,
    },
    provenance: SAMPLE_PROVENANCE,
    freshness: {
      stale: false,
    },
    cache: {
      status: "HIT",
      llm_calls: 0,
    },
    disclaimer_key: "general_price_disclaimer",
  };
}

export async function mockAskText(
  question: string,
  crop: string,
  region: string,
  lang: string
): Promise<FarmerEnvelope> {
  return {
    request_id: `req_mock_ask_${Date.now()}`,
    lang,
    card: {
      headline: `Answer regarding ${crop} in ${region}`,
      bullets: [
        `You asked: "${question}"`,
        `For ${crop}, current market conditions in ${region} are favorable.`,
        "Consult local agricultural extension officers for specific advice.",
      ],
    },
    numbers: {
      mandi_modal_kg: 18,
      retail_kg: 32,
    },
    provenance: SAMPLE_PROVENANCE,
    freshness: {
      stale: false,
    },
    cache: {
      status: "MISS",
      llm_calls: 1,
    },
    disclaimer_key: "advice_disclaimer",
  };
}

export async function mockSendPhoto(
  _file: Blob | File | { uri: string; name?: string; type?: string },
  crop: string,
  _region: string,
  lang: string
): Promise<FarmerEnvelope> {
  return {
    request_id: `req_mock_photo_${Date.now()}`,
    lang,
    card: {
      headline: `Photo Analysis for ${crop}`,
      bullets: [
        "Possible early blight or leaf spot observed.",
        "Check lower leaves for dark concentric spots.",
        "Ensure adequate spacing and avoid overhead watering.",
      ],
    },
    numbers: {},
    provenance: SAMPLE_PROVENANCE,
    freshness: {
      stale: false,
    },
    cache: {
      status: "MISS",
      llm_calls: 1,
    },
    disclaimer_key: "photo_disclaimer",
  };
}
