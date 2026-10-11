export interface MandiLocation {
  id: string;
  name: string;
  district: string;
  state: string;
  type: "APMC" | "Rythu Bazar" | "Wholesale Complex";
  latitude: number;
  longitude: number;
}

export interface NearbyMandiPrice {
  mandiName: string;
  district: string;
  pricePerKg: number;
  pricePerQtl: number;
  distKm: number;
  spread: number; // difference compared to active mandi
}

export interface CommodityRecord {
  id: string;
  name: string;
  hindiName: string;
  category: "Essentials" | "Greens" | "Spices" | "Gourds" | "Roots";
  variety: string;
  icon: string;
  modalPriceKg: number;
  modalPriceQtl: number;
  minPriceKg: number;
  maxPriceKg: number;
  minPriceQtl: number;
  maxPriceQtl: number;
  change24h: number; // percentage e.g. +4.2 or -3.1
  changeAmount: number; // in ₹/kg
  arrivalTons: number;
  arrivalQuintals: number;
  volumeStatus: "HIGH" | "NORMAL" | "LOW";
  sparkline7d: number[]; // 7 consecutive day prices
  history14d: { date: string; price: number; volume: number; high: number; low: number }[];
  history30d: { date: string; price: number; volume: number; high: number; low: number }[];
  nearbyMandis: NearbyMandiPrice[];
  asOf: string;
}

export const MANDI_LOCATIONS: MandiLocation[] = [
  {
    id: "mandi-bowenpally",
    name: "Bowenpally APMC",
    district: "Hyderabad",
    state: "Telangana",
    type: "APMC",
    latitude: 17.4728,
    longitude: 78.4842,
  },
  {
    id: "mandi-gudimalkapur",
    name: "Gudimalkapur Rythu Bazar",
    district: "Hyderabad",
    state: "Telangana",
    type: "Rythu Bazar",
    latitude: 17.3871,
    longitude: 78.4428,
  },
  {
    id: "mandi-lbnagar",
    name: "L.B. Nagar Vegetable Market",
    district: "Hyderabad",
    state: "Telangana",
    type: "APMC",
    latitude: 17.3524,
    longitude: 78.5528,
  },
  {
    id: "mandi-shamshabad",
    name: "Shamshabad APMC",
    district: "Rangareddy",
    state: "Telangana",
    type: "APMC",
    latitude: 17.2514,
    longitude: 78.4284,
  },
  {
    id: "mandi-warangal",
    name: "Warangal Enmamula APMC",
    district: "Warangal",
    state: "Telangana",
    type: "APMC",
    latitude: 17.9806,
    longitude: 79.6105,
  },
  {
    id: "mandi-gollapudi",
    name: "Gollapudi Market Yard",
    district: "NTR / Vijayawada",
    state: "Andhra Pradesh",
    type: "APMC",
    latitude: 16.5385,
    longitude: 80.5937,
  },
  {
    id: "mandi-guntur",
    name: "Guntur APMC Yard",
    district: "Guntur",
    state: "Andhra Pradesh",
    type: "APMC",
    latitude: 16.3067,
    longitude: 80.4365,
  },
  {
    id: "mandi-vashi",
    name: "Vashi APMC Market",
    district: "Navi Mumbai",
    state: "Maharashtra",
    type: "APMC",
    latitude: 19.0768,
    longitude: 73.0076,
  },
  {
    id: "mandi-gultekdi",
    name: "Gultekdi Market Yard",
    district: "Pune",
    state: "Maharashtra",
    type: "APMC",
    latitude: 18.4965,
    longitude: 73.8682,
  },
  {
    id: "mandi-nashik",
    name: "Nashik APMC (Panchavati)",
    district: "Nashik",
    state: "Maharashtra",
    type: "APMC",
    latitude: 19.9975,
    longitude: 73.7898,
  },
  {
    id: "mandi-yeshwanthpur",
    name: "Yeshwanthpur APMC Yard",
    district: "Bengaluru Urban",
    state: "Karnataka",
    type: "APMC",
    latitude: 13.0242,
    longitude: 77.5469,
  },
  {
    id: "mandi-kalasipalya",
    name: "Kalasipalya Mandi",
    district: "Bengaluru Urban",
    state: "Karnataka",
    type: "Wholesale Complex",
    latitude: 12.9622,
    longitude: 77.5786,
  },
  {
    id: "mandi-azadpur",
    name: "Azadpur Subzi Mandi",
    district: "North Delhi",
    state: "Delhi",
    type: "APMC",
    latitude: 28.7126,
    longitude: 77.1742,
  },
  {
    id: "mandi-ghazipur",
    name: "Ghazipur Fruit & Vegetable Mandi",
    district: "East Delhi",
    state: "Delhi",
    type: "APMC",
    latitude: 28.6258,
    longitude: 77.3298,
  },
  {
    id: "mandi-koyambedu",
    name: "Koyambedu Wholesale Complex",
    district: "Chennai",
    state: "Tamil Nadu",
    type: "Wholesale Complex",
    latitude: 13.0694,
    longitude: 80.1948,
  },
];

// Helper to calculate haversine distance in km
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function findClosestMandi(
  userLat: number,
  userLon: number
): { mandi: MandiLocation; distanceKm: number } {
  let closest = MANDI_LOCATIONS[0];
  let minDistance = calculateDistanceKm(
    userLat,
    userLon,
    closest.latitude,
    closest.longitude
  );

  for (let i = 1; i < MANDI_LOCATIONS.length; i++) {
    const d = calculateDistanceKm(
      userLat,
      userLon,
      MANDI_LOCATIONS[i].latitude,
      MANDI_LOCATIONS[i].longitude
    );
    if (d < minDistance) {
      minDistance = d;
      closest = MANDI_LOCATIONS[i];
    }
  }

  return { mandi: closest, distanceKm: minDistance };
}

// Generate realistic history helper
function generateHistory(basePrice: number, baseVol: number) {
  const dates = [
    "Oct 01", "Oct 02", "Oct 03", "Oct 04", "Oct 05", "Oct 06", "Oct 07",
    "Oct 08", "Oct 09", "Oct 10", "Oct 11", "Oct 12"
  ];
  const history = dates.map((date, idx) => {
    const factor = 1 + Math.sin(idx * 0.7) * 0.08 + (idx - 6) * 0.005;
    const price = Math.round(basePrice * factor);
    const volume = Math.round(baseVol * (1 - Math.sin(idx * 0.7) * 0.12));
    const high = Math.round(price * 1.05);
    const low = Math.round(price * 0.94);
    return { date, price, volume, high, low };
  });
  return history;
}

export const COMMODITIES_DATA: CommodityRecord[] = [
  {
    id: "tomato",
    name: "Tomato",
    hindiName: "Tamatar",
    category: "Essentials",
    variety: "Hybrid (Vaishali)",
    icon: "🍅",
    modalPriceKg: 24,
    modalPriceQtl: 2400,
    minPriceKg: 20,
    maxPriceKg: 28,
    minPriceQtl: 2000,
    maxPriceQtl: 2800,
    change24h: 9.09,
    changeAmount: 2.0,
    arrivalTons: 142.5,
    arrivalQuintals: 1425,
    volumeStatus: "HIGH",
    sparkline7d: [18, 19, 21, 20, 22, 23, 24],
    history14d: generateHistory(23, 1400),
    history30d: generateHistory(23, 1400),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 22, pricePerQtl: 2200, distKm: 9.8, spread: -2 },
      { mandiName: "Shamshabad APMC", district: "Rangareddy", pricePerKg: 26, pricePerQtl: 2600, distKm: 28.4, spread: +2 },
      { mandiName: "L.B. Nagar Market", district: "Hyderabad", pricePerKg: 25, pricePerQtl: 2500, distKm: 16.2, spread: +1 },
    ],
    asOf: "Today, 06:00 AM",
  },
  {
    id: "onion",
    name: "Onion",
    hindiName: "Pyaaz",
    category: "Essentials",
    variety: "Nasik Red (Patti)",
    icon: "🧅",
    modalPriceKg: 28,
    modalPriceQtl: 2800,
    minPriceKg: 24,
    maxPriceKg: 32,
    minPriceQtl: 2400,
    maxPriceQtl: 3200,
    change24h: -3.45,
    changeAmount: -1.0,
    arrivalTons: 280.0,
    arrivalQuintals: 2800,
    volumeStatus: "HIGH",
    sparkline7d: [31, 30, 30, 29, 29, 29, 28],
    history14d: generateHistory(29, 2700),
    history30d: generateHistory(29, 2700),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 27, pricePerQtl: 2700, distKm: 9.8, spread: -1 },
      { mandiName: "Shamshabad APMC", district: "Rangareddy", pricePerKg: 30, pricePerQtl: 3000, distKm: 28.4, spread: +2 },
      { mandiName: "Warangal APMC", district: "Warangal", pricePerKg: 26, pricePerQtl: 2600, distKm: 140.0, spread: -2 },
    ],
    asOf: "Today, 06:15 AM",
  },
  {
    id: "potato",
    name: "Potato",
    hindiName: "Aaloo",
    category: "Essentials",
    variety: "Jyoti (Grade A)",
    icon: "🥔",
    modalPriceKg: 22,
    modalPriceQtl: 2200,
    minPriceKg: 19,
    maxPriceKg: 25,
    minPriceQtl: 1900,
    maxPriceQtl: 2500,
    change24h: 4.76,
    changeAmount: 1.0,
    arrivalTons: 310.0,
    arrivalQuintals: 3100,
    volumeStatus: "HIGH",
    sparkline7d: [20, 20, 21, 21, 21, 22, 22],
    history14d: generateHistory(21, 3000),
    history30d: generateHistory(21, 3000),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 21, pricePerQtl: 2100, distKm: 9.8, spread: -1 },
      { mandiName: "Shamshabad APMC", district: "Rangareddy", pricePerKg: 23, pricePerQtl: 2300, distKm: 28.4, spread: +1 },
      { mandiName: "L.B. Nagar Market", district: "Hyderabad", pricePerKg: 22, pricePerQtl: 2200, distKm: 16.2, spread: 0 },
    ],
    asOf: "Today, 05:45 AM",
  },
  {
    id: "brinjal",
    name: "Brinjal",
    hindiName: "Baingan",
    category: "Essentials",
    variety: "Round Violet (Local)",
    icon: "🍆",
    modalPriceKg: 32,
    modalPriceQtl: 3200,
    minPriceKg: 28,
    maxPriceKg: 36,
    minPriceQtl: 2800,
    maxPriceQtl: 3600,
    change24h: 6.67,
    changeAmount: 2.0,
    arrivalTons: 45.0,
    arrivalQuintals: 450,
    volumeStatus: "NORMAL",
    sparkline7d: [28, 29, 30, 29, 30, 31, 32],
    history14d: generateHistory(30, 480),
    history30d: generateHistory(30, 480),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 30, pricePerQtl: 3000, distKm: 9.8, spread: -2 },
      { mandiName: "L.B. Nagar Market", district: "Hyderabad", pricePerKg: 33, pricePerQtl: 3300, distKm: 16.2, spread: +1 },
    ],
    asOf: "Today, 06:30 AM",
  },
  {
    id: "chilli",
    name: "Green Chilli",
    hindiName: "Hari Mirchi",
    category: "Spices",
    variety: "Guntur Teja (Fine)",
    icon: "🌶️",
    modalPriceKg: 65,
    modalPriceQtl: 6500,
    minPriceKg: 58,
    maxPriceKg: 75,
    minPriceQtl: 5800,
    maxPriceQtl: 7500,
    change24h: 12.07,
    changeAmount: 7.0,
    arrivalTons: 38.0,
    arrivalQuintals: 380,
    volumeStatus: "LOW",
    sparkline7d: [52, 54, 55, 58, 60, 62, 65],
    history14d: generateHistory(58, 400),
    history30d: generateHistory(58, 400),
    nearbyMandis: [
      { mandiName: "Guntur APMC Yard", district: "Guntur", pricePerKg: 58, pricePerQtl: 5800, distKm: 260.0, spread: -7 },
      { mandiName: "Warangal APMC", district: "Warangal", pricePerKg: 62, pricePerQtl: 6200, distKm: 140.0, spread: -3 },
    ],
    asOf: "Today, 06:10 AM",
  },
  {
    id: "garlic",
    name: "Garlic",
    hindiName: "Lahsun",
    category: "Spices",
    variety: "Desi Mandsaur Grade",
    icon: "🧄",
    modalPriceKg: 195,
    modalPriceQtl: 19500,
    minPriceKg: 180,
    maxPriceKg: 215,
    minPriceQtl: 18000,
    maxPriceQtl: 21500,
    change24h: 5.41,
    changeAmount: 10.0,
    arrivalTons: 22.0,
    arrivalQuintals: 220,
    volumeStatus: "LOW",
    sparkline7d: [175, 180, 182, 185, 188, 190, 195],
    history14d: generateHistory(185, 230),
    history30d: generateHistory(185, 230),
    nearbyMandis: [
      { mandiName: "Gultekdi Market Yard", district: "Pune", pricePerKg: 190, pricePerQtl: 19000, distKm: 560.0, spread: -5 },
      { mandiName: "Azadpur Mandi", district: "North Delhi", pricePerKg: 205, pricePerQtl: 20500, distKm: 1550.0, spread: +10 },
    ],
    asOf: "Today, 05:30 AM",
  },
  {
    id: "ginger",
    name: "Ginger",
    hindiName: "Adrak",
    category: "Spices",
    variety: "Wayanad Bold",
    icon: "🫚",
    modalPriceKg: 110,
    modalPriceQtl: 11000,
    minPriceKg: 95,
    maxPriceKg: 125,
    minPriceQtl: 9500,
    maxPriceQtl: 12500,
    change24h: -4.35,
    changeAmount: -5.0,
    arrivalTons: 19.5,
    arrivalQuintals: 195,
    volumeStatus: "NORMAL",
    sparkline7d: [122, 120, 118, 115, 115, 112, 110],
    history14d: generateHistory(115, 200),
    history30d: generateHistory(115, 200),
    nearbyMandis: [
      { mandiName: "Kalasipalya Mandi", district: "Bengaluru", pricePerKg: 105, pricePerQtl: 10500, distKm: 570.0, spread: -5 },
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 112, pricePerQtl: 11200, distKm: 9.8, spread: +2 },
    ],
    asOf: "Today, 06:40 AM",
  },
  {
    id: "cabbage",
    name: "Cabbage",
    hindiName: "Patta Gobhi",
    category: "Essentials",
    variety: "Golden Acre",
    icon: "🥬",
    modalPriceKg: 18,
    modalPriceQtl: 1800,
    minPriceKg: 15,
    maxPriceKg: 21,
    minPriceQtl: 1500,
    maxPriceQtl: 2100,
    change24h: -5.26,
    changeAmount: -1.0,
    arrivalTons: 65.0,
    arrivalQuintals: 650,
    volumeStatus: "HIGH",
    sparkline7d: [20, 20, 19, 19, 19, 18, 18],
    history14d: generateHistory(19, 620),
    history30d: generateHistory(19, 620),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 17, pricePerQtl: 1700, distKm: 9.8, spread: -1 },
      { mandiName: "Shamshabad APMC", district: "Rangareddy", pricePerKg: 19, pricePerQtl: 1900, distKm: 28.4, spread: +1 },
    ],
    asOf: "Today, 06:20 AM",
  },
  {
    id: "cauliflower",
    name: "Cauliflower",
    hindiName: "Phool Gobhi",
    category: "Essentials",
    variety: "Snowball 16",
    icon: "🥦",
    modalPriceKg: 26,
    modalPriceQtl: 2600,
    minPriceKg: 22,
    maxPriceKg: 30,
    minPriceQtl: 2200,
    maxPriceQtl: 3000,
    change24h: -7.14,
    changeAmount: -2.0,
    arrivalTons: 52.0,
    arrivalQuintals: 520,
    volumeStatus: "HIGH",
    sparkline7d: [30, 29, 28, 28, 27, 27, 26],
    history14d: generateHistory(28, 500),
    history30d: generateHistory(28, 500),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 25, pricePerQtl: 2500, distKm: 9.8, spread: -1 },
      { mandiName: "L.B. Nagar Market", district: "Hyderabad", pricePerKg: 27, pricePerQtl: 2700, distKm: 16.2, spread: +1 },
    ],
    asOf: "Today, 06:25 AM",
  },
  {
    id: "carrot",
    name: "Carrot",
    hindiName: "Gajar",
    category: "Roots",
    variety: "Ooty Red (Desi)",
    icon: "🥕",
    modalPriceKg: 42,
    modalPriceQtl: 4200,
    minPriceKg: 36,
    maxPriceKg: 48,
    minPriceQtl: 3600,
    maxPriceQtl: 4800,
    change24h: 5.0,
    changeAmount: 2.0,
    arrivalTons: 40.0,
    arrivalQuintals: 400,
    volumeStatus: "NORMAL",
    sparkline7d: [38, 39, 40, 40, 41, 41, 42],
    history14d: generateHistory(40, 410),
    history30d: generateHistory(40, 410),
    nearbyMandis: [
      { mandiName: "Yeshwanthpur APMC", district: "Bengaluru", pricePerKg: 38, pricePerQtl: 3800, distKm: 570.0, spread: -4 },
      { mandiName: "Koyambedu Complex", district: "Chennai", pricePerKg: 36, pricePerQtl: 3600, distKm: 620.0, spread: -6 },
    ],
    asOf: "Today, 06:15 AM",
  },
  {
    id: "bhindi",
    name: "Bhindi (Okra)",
    hindiName: "Bhindi",
    category: "Essentials",
    variety: "Local F1 Hybrid",
    icon: "🌱",
    modalPriceKg: 38,
    modalPriceQtl: 3800,
    minPriceKg: 32,
    maxPriceKg: 44,
    minPriceQtl: 3200,
    maxPriceQtl: 4400,
    change24h: 8.57,
    changeAmount: 3.0,
    arrivalTons: 32.0,
    arrivalQuintals: 320,
    volumeStatus: "NORMAL",
    sparkline7d: [32, 33, 34, 35, 36, 37, 38],
    history14d: generateHistory(35, 330),
    history30d: generateHistory(35, 330),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 36, pricePerQtl: 3600, distKm: 9.8, spread: -2 },
      { mandiName: "Shamshabad APMC", district: "Rangareddy", pricePerKg: 40, pricePerQtl: 4000, distKm: 28.4, spread: +2 },
    ],
    asOf: "Today, 06:35 AM",
  },
  {
    id: "matar",
    name: "Green Peas (Matar)",
    hindiName: "Matar",
    category: "Essentials",
    variety: "Himachal Sweet",
    icon: "🫛",
    modalPriceKg: 72,
    modalPriceQtl: 7200,
    minPriceKg: 64,
    maxPriceKg: 82,
    minPriceQtl: 6400,
    maxPriceQtl: 8200,
    change24h: -10.0,
    changeAmount: -8.0,
    arrivalTons: 78.0,
    arrivalQuintals: 780,
    volumeStatus: "HIGH",
    sparkline7d: [90, 86, 84, 80, 78, 75, 72],
    history14d: generateHistory(80, 720),
    history30d: generateHistory(80, 720),
    nearbyMandis: [
      { mandiName: "Azadpur Mandi", district: "North Delhi", pricePerKg: 58, pricePerQtl: 5800, distKm: 1550.0, spread: -14 },
      { mandiName: "Gultekdi Market", district: "Pune", pricePerKg: 68, pricePerQtl: 6800, distKm: 560.0, spread: -4 },
    ],
    asOf: "Today, 05:50 AM",
  },
  {
    id: "capsicum",
    name: "Capsicum",
    hindiName: "Shimla Mirch",
    category: "Essentials",
    variety: "Green Wonder (Polyhouse)",
    icon: "🫑",
    modalPriceKg: 55,
    modalPriceQtl: 5500,
    minPriceKg: 48,
    maxPriceKg: 62,
    minPriceQtl: 4800,
    maxPriceQtl: 6200,
    change24h: 7.84,
    changeAmount: 4.0,
    arrivalTons: 26.0,
    arrivalQuintals: 260,
    volumeStatus: "NORMAL",
    sparkline7d: [48, 49, 50, 52, 53, 54, 55],
    history14d: generateHistory(52, 270),
    history30d: generateHistory(52, 270),
    nearbyMandis: [
      { mandiName: "Yeshwanthpur APMC", district: "Bengaluru", pricePerKg: 50, pricePerQtl: 5000, distKm: 570.0, spread: -5 },
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 54, pricePerQtl: 5400, distKm: 9.8, spread: -1 },
    ],
    asOf: "Today, 06:20 AM",
  },
  {
    id: "cucumber",
    name: "Cucumber",
    hindiName: "Kheera",
    category: "Essentials",
    variety: "Desi Green",
    icon: "🥒",
    modalPriceKg: 25,
    modalPriceQtl: 2500,
    minPriceKg: 20,
    maxPriceKg: 30,
    minPriceQtl: 2000,
    maxPriceQtl: 3000,
    change24h: 4.17,
    changeAmount: 1.0,
    arrivalTons: 36.0,
    arrivalQuintals: 360,
    volumeStatus: "NORMAL",
    sparkline7d: [22, 23, 23, 24, 24, 24, 25],
    history14d: generateHistory(23, 350),
    history30d: generateHistory(23, 350),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 23, pricePerQtl: 2300, distKm: 9.8, spread: -2 },
      { mandiName: "Shamshabad APMC", district: "Rangareddy", pricePerKg: 26, pricePerQtl: 2600, distKm: 28.4, spread: +1 },
    ],
    asOf: "Today, 06:10 AM",
  },
  {
    id: "bottlegourd",
    name: "Bottle Gourd",
    hindiName: "Lauki",
    category: "Gourds",
    variety: "Long Tender Green",
    icon: "🍈",
    modalPriceKg: 20,
    modalPriceQtl: 2000,
    minPriceKg: 16,
    maxPriceKg: 24,
    minPriceQtl: 1600,
    maxPriceQtl: 2400,
    change24h: 0.0,
    changeAmount: 0.0,
    arrivalTons: 42.0,
    arrivalQuintals: 420,
    volumeStatus: "NORMAL",
    sparkline7d: [20, 20, 19, 20, 20, 20, 20],
    history14d: generateHistory(20, 420),
    history30d: generateHistory(20, 420),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 18, pricePerQtl: 1800, distKm: 9.8, spread: -2 },
      { mandiName: "L.B. Nagar Market", district: "Hyderabad", pricePerKg: 21, pricePerQtl: 2100, distKm: 16.2, spread: +1 },
    ],
    asOf: "Today, 06:15 AM",
  },
  {
    id: "bittergourd",
    name: "Bitter Gourd",
    hindiName: "Karela",
    category: "Gourds",
    variety: "Small Dark Prickly",
    icon: "🥒",
    modalPriceKg: 45,
    modalPriceQtl: 4500,
    minPriceKg: 38,
    maxPriceKg: 52,
    minPriceQtl: 3800,
    maxPriceQtl: 5200,
    change24h: -6.25,
    changeAmount: -3.0,
    arrivalTons: 25.0,
    arrivalQuintals: 250,
    volumeStatus: "NORMAL",
    sparkline7d: [50, 49, 48, 48, 47, 46, 45],
    history14d: generateHistory(48, 250),
    history30d: generateHistory(48, 250),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 42, pricePerQtl: 4200, distKm: 9.8, spread: -3 },
      { mandiName: "Shamshabad APMC", district: "Rangareddy", pricePerKg: 46, pricePerQtl: 4600, distKm: 28.4, spread: +1 },
    ],
    asOf: "Today, 06:25 AM",
  },
  {
    id: "palak",
    name: "Spinach (Palak)",
    hindiName: "Palak",
    category: "Greens",
    variety: "Desi All Green",
    icon: "🍃",
    modalPriceKg: 30,
    modalPriceQtl: 3000,
    minPriceKg: 24,
    maxPriceKg: 38,
    minPriceQtl: 2400,
    maxPriceQtl: 3800,
    change24h: 15.38,
    changeAmount: 4.0,
    arrivalTons: 18.0,
    arrivalQuintals: 180,
    volumeStatus: "LOW",
    sparkline7d: [22, 24, 25, 26, 26, 28, 30],
    history14d: generateHistory(25, 200),
    history30d: generateHistory(25, 200),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 28, pricePerQtl: 2800, distKm: 9.8, spread: -2 },
      { mandiName: "L.B. Nagar Market", district: "Hyderabad", pricePerKg: 32, pricePerQtl: 3200, distKm: 16.2, spread: +2 },
    ],
    asOf: "Today, 05:40 AM",
  },
  {
    id: "lemon",
    name: "Lemon",
    hindiName: "Nimbu",
    category: "Essentials",
    variety: "Balaji Kagzi (Juicy)",
    icon: "🍋",
    modalPriceKg: 85,
    modalPriceQtl: 8500,
    minPriceKg: 70,
    maxPriceKg: 100,
    minPriceQtl: 7000,
    maxPriceQtl: 10000,
    change24h: 3.66,
    changeAmount: 3.0,
    arrivalTons: 16.0,
    arrivalQuintals: 160,
    volumeStatus: "NORMAL",
    sparkline7d: [78, 80, 80, 82, 82, 84, 85],
    history14d: generateHistory(81, 160),
    history30d: generateHistory(81, 160),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 82, pricePerQtl: 8200, distKm: 9.8, spread: -3 },
      { mandiName: "Shamshabad APMC", district: "Rangareddy", pricePerKg: 88, pricePerQtl: 8800, distKm: 28.4, spread: +3 },
    ],
    asOf: "Today, 06:10 AM",
  },
  {
    id: "coriander",
    name: "Coriander (Dhaniya)",
    hindiName: "Hara Dhaniya",
    category: "Greens",
    variety: "Desi Sugandhi Bunch",
    icon: "🌿",
    modalPriceKg: 40,
    modalPriceQtl: 4000,
    minPriceKg: 30,
    maxPriceKg: 50,
    minPriceQtl: 3000,
    maxPriceQtl: 5000,
    change24h: 11.11,
    changeAmount: 4.0,
    arrivalTons: 14.5,
    arrivalQuintals: 145,
    volumeStatus: "LOW",
    sparkline7d: [30, 32, 33, 35, 36, 38, 40],
    history14d: generateHistory(35, 150),
    history30d: generateHistory(35, 150),
    nearbyMandis: [
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 36, pricePerQtl: 3600, distKm: 9.8, spread: -4 },
      { mandiName: "L.B. Nagar Market", district: "Hyderabad", pricePerKg: 42, pricePerQtl: 4200, distKm: 16.2, spread: +2 },
    ],
    asOf: "Today, 05:55 AM",
  },
  {
    id: "beetroot",
    name: "Beetroot",
    hindiName: "Chukandar",
    category: "Roots",
    variety: "Madurai / Ooty Dark",
    icon: "🫐",
    modalPriceKg: 36,
    modalPriceQtl: 3600,
    minPriceKg: 30,
    maxPriceKg: 42,
    minPriceQtl: 3000,
    maxPriceQtl: 4200,
    change24h: -2.7,
    changeAmount: -1.0,
    arrivalTons: 20.0,
    arrivalQuintals: 200,
    volumeStatus: "NORMAL",
    sparkline7d: [38, 38, 37, 37, 37, 36, 36],
    history14d: generateHistory(37, 210),
    history30d: generateHistory(37, 210),
    nearbyMandis: [
      { mandiName: "Yeshwanthpur APMC", district: "Bengaluru", pricePerKg: 32, pricePerQtl: 3200, distKm: 570.0, spread: -4 },
      { mandiName: "Gudimalkapur Rythu", district: "Hyderabad", pricePerKg: 35, pricePerQtl: 3500, distKm: 9.8, spread: -1 },
    ],
    asOf: "Today, 06:05 AM",
  },
];

// Market Movers & KPI summaries
export interface MarketMoversData {
  topGainer: CommodityRecord;
  topCrash: CommodityRecord;
  highestArrival: CommodityRecord;
  compositeIndex: {
    name: string;
    value: number; // e.g. 142.8
    change24h: number; // +1.8%
    totalArrivalTons: number;
    activeMandiCount: number;
  };
}

export function computeMarketMovers(data: CommodityRecord[] = COMMODITIES_DATA): MarketMoversData {
  const sortedByChange = [...data].sort((a, b) => b.change24h - a.change24h);
  const topGainer = sortedByChange[0];
  const topCrash = sortedByChange[sortedByChange.length - 1];

  const sortedByArrival = [...data].sort((a, b) => b.arrivalTons - a.arrivalTons);
  const highestArrival = sortedByArrival[0];

  const totalArrival = data.reduce((acc, curr) => acc + curr.arrivalTons, 0);
  const weightedPriceSum = data.reduce((acc, curr) => acc + curr.modalPriceKg * curr.arrivalTons, 0);
  const indexValue = Math.round((weightedPriceSum / totalArrival) * 10) / 10;

  const avgChange = data.reduce((acc, curr) => acc + curr.change24h, 0) / data.length;

  return {
    topGainer,
    topCrash,
    highestArrival,
    compositeIndex: {
      name: "KM-INDEX 20",
      value: indexValue,
      change24h: Math.round(avgChange * 100) / 100,
      totalArrivalTons: Math.round(totalArrival),
      activeMandiCount: MANDI_LOCATIONS.length,
    },
  };
}
