import { Crop, FarmerEnvelope, Region } from "./types";

export const MOCK_CROPS: Crop[] = [
  {
    id: "tomato",
    name: "Tomato",
    image: "https://images.unsplash.com/photo-1546470427-227c7369a9b7?w=120&q=80",
  },
  {
    id: "onion",
    name: "Onion",
    image: "https://images.unsplash.com/photo-1508747703725-719777637510?w=120&q=80",
  },
  {
    id: "potato",
    name: "Potato",
    image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=120&q=80",
  },
  {
    id: "brinjal",
    name: "Brinjal",
    image: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=120&q=80",
  },
  {
    id: "chilli",
    name: "Green Chilli",
    image: "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=120&q=80",
  },
  {
    id: "cabbage",
    name: "Cabbage",
    image: "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=120&q=80",
  },
  {
    id: "cauliflower",
    name: "Cauliflower",
    image: "https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=120&q=80",
  },
  {
    id: "carrot",
    name: "Carrot",
    image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5c317?w=120&q=80",
  },
  {
    id: "garlic",
    name: "Garlic",
    image: "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=120&q=80",
  },
  {
    id: "ginger",
    name: "Ginger",
    image: "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=120&q=80",
  },
  {
    id: "bhindi",
    name: "Ladies Finger (Bhindi)",
    image: "https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2?w=120&q=80",
  },
  {
    id: "matar",
    name: "Green Peas (Matar)",
    image: "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=120&q=80",
  },
  {
    id: "capsicum",
    name: "Capsicum",
    image: "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=120&q=80",
  },
  {
    id: "cucumber",
    name: "Cucumber",
    image: "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=120&q=80",
  },
  {
    id: "bottlegourd",
    name: "Bottle Gourd (Lauki)",
    image: "https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=120&q=80",
  },
  {
    id: "bittergourd",
    name: "Bitter Gourd (Karela)",
    image: "https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=120&q=80",
  },
  {
    id: "palak",
    name: "Spinach (Palak)",
    image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=120&q=80",
  },
  {
    id: "lemon",
    name: "Lemon",
    image: "https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=120&q=80",
  },
  {
    id: "coriander",
    name: "Coriander",
    image: "https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=120&q=80",
  },
  {
    id: "beetroot",
    name: "Beetroot",
    image: "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=120&q=80",
  },
];

const CROP_BASE_PRICES: Record<string, number> = {
  tomato: 24,
  onion: 32,
  potato: 20,
  brinjal: 26,
  chilli: 48,
  cabbage: 16,
  cauliflower: 25,
  carrot: 38,
  garlic: 140,
  ginger: 72,
  bhindi: 31,
  matar: 47,
  capsicum: 40,
  cucumber: 19,
  bottlegourd: 15,
  bittergourd: 34,
  palak: 13,
  lemon: 61,
  coriander: 32,
  beetroot: 28,
};

export const MOCK_REGION: Region = {
  region_id: "reg_pune_01",
  mandis: [
    { id: "mandi_pune", name: "Pune APMC", dist_km: 12 },
    { id: "mandi_lasalgaon", name: "Lasalgaon Mandi", dist_km: 25 },
  ],
};

const SAMPLE_PROVENANCE = [
  {
    label: "AGMARKNET wholesale mandi rate",
    as_of: new Date().toISOString().split("T")[0],
    source: "data.gov.in (AGMARKNET)",
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
  const cropKey = crop.toLowerCase();
  const mandiPrice = CROP_BASE_PRICES[cropKey] ?? 25;
  const retailPrice = Math.round(mandiPrice * 1.45);
  const displayName = crop.charAt(0).toUpperCase() + crop.slice(1);

  return {
    request_id: `req_mock_insight_${Date.now()}`,
    lang,
    card: {
      headline: `${displayName} prices in ${region}`,
      bullets: [
        `Wholesale mandi modal price: ₹${mandiPrice}/kg (₹${mandiPrice * 100}/quintal).`,
        `Estimated local retail rate: ₹${retailPrice}/kg.`,
        "Steady arrivals reported today. Compare adjacent mandis before transit.",
      ],
    },
    numbers: {
      mandi_modal_kg: mandiPrice,
      retail_kg: retailPrice,
      modal_quintal: mandiPrice * 100,
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
  const cropKey = crop.toLowerCase();
  const mandiPrice = CROP_BASE_PRICES[cropKey] ?? 25;
  const retailPrice = Math.round(mandiPrice * 1.45);

  return {
    request_id: `req_mock_ask_${Date.now()}`,
    lang,
    card: {
      headline: `Market advice for ${crop} in ${region}`,
      bullets: [
        `Wholesale mandi rate is ₹${mandiPrice}/kg (₹${mandiPrice * 100}/quintal).`,
        `Retail market price is ₹${retailPrice}/kg.`,
        "Current market arrivals are healthy. Good window to harvest and sell.",
      ],
    },
    numbers: {
      mandi_modal_kg: mandiPrice,
      retail_kg: retailPrice,
      modal_quintal: mandiPrice * 100,
    },
    provenance: SAMPLE_PROVENANCE,
    freshness: {
      stale: false,
    },
    cache: {
      status: "HIT",
      llm_calls: 0,
    },
    disclaimer_key: "advice_disclaimer",
  };
}

export async function mockSendPhoto(
  _photo: Blob | File | { uri: string; name?: string; type?: string } | string,
  crop: string,
  region: string,
  lang: string
): Promise<FarmerEnvelope> {
  return {
    request_id: `req_mock_photo_${Date.now()}`,
    lang,
    card: {
      headline: `Crop Health Guidance for ${crop}`,
      bullets: [
        "Possible cause: Mild early blight or nutrient deficiency symptoms.",
        "Check undersides of leaves for fungal spotting or pest activity.",
        "Consult your local Krishi Vigyan Kendra (KVK) extension officer.",
      ],
    },
    numbers: {},
    provenance: [
      {
        label: "Visual crop check guide",
        as_of: new Date().toISOString().split("T")[0],
        source: "Agricultural Advisory Portal",
      },
    ],
    freshness: {
      stale: false,
    },
    cache: {
      status: "HIT",
      llm_calls: 0,
    },
    disclaimer_key: "photo_disclaimer",
  };
}
