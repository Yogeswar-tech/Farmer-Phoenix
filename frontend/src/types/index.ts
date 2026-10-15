export type Language = 'hi' | 'te' | 'en';

export type NavigationTab =
  | 'home'
  | 'logistics'
  | 'rates'
  | 'climate'
  | 'advisory'
  | 'soildoctor'
  | 'schemes'
  | 'storage'
  | 'charts';

export type LocationOption = {
  id: string;
  name: Record<Language, string>;
  state: Record<Language, string>;
  district: Record<Language, string>;
  mandiName: Record<Language, string>;
  pincode: string;
  lat?: number;
  lng?: number;
};

export type CropGrade = {
  name: Record<Language, string>;
  gradeCode: 'A' | 'B' | 'C' | 'MODAL';
  priceRange: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  qualityCriteria: Record<Language, string>;
  badgeColor?: string;
};

export type MandiItem = {
  id: string;
  cropKey: string;
  cropName: Record<Language, string>;
  variety: string;
  mandiName: Record<Language, string>;
  state: Record<Language, string>;
  distanceKm: number;
  lastUpdated: string;
  isLive: boolean;
  marketStatus: 'open' | 'closed';
  operatingHours: string;
  priceTrend: {
    diffLastWeek: number; // e.g. +300
    percentage: number;
    highest14Days: boolean;
  };
  whySellReasons: {
    trendReason: Record<Language, string>;
    weatherReason: Record<Language, string>;
    inflowReason: Record<Language, string>;
  };
  grades: CropGrade[];
  unsoldYardStockBags: number;
  eNamLotVerified: boolean;
  otherNearbyMandis: {
    name: Record<Language, string>;
    distance: number;
    modalPrice: number;
  }[];
};

export type WeatherDay = {
  dayName: Record<Language, string>;
  date: string;
  tempMax: number;
  tempMin: number;
  condition: 'sunny' | 'rain' | 'cloudy' | 'thunder';
  conditionText: Record<Language, string>;
  rainChance: number;
  sprayingAdvice: Record<Language, string>;
  riskLevel: 'safe' | 'warning' | 'danger';
};

export type SeasonalClimateOutlook = {
  month: Record<Language, string>;
  rainExpectation: Record<Language, string>;
  temperatureTrend: Record<Language, string>;
  farmingImpact: Record<Language, string>;
  riskStatus: 'favorable' | 'moderate' | 'drought-risk';
};

export type CropDisease = {
  cropKey: string;
  diseaseName: Record<Language, string>;
  symptoms: Record<Language, string>;
  chemicalTreatment: Record<Language, string>;
  organicTreatment: Record<Language, string>;
  sprayingWarning: Record<Language, string>;
  severity: 'low' | 'medium' | 'high';
};

export type GovtScheme = {
  id: string;
  category?: string;
  title: Record<Language, string>;
  shortDesc: Record<Language, string>;
  benefitAmount: string | Record<Language, string>;
  interestRate?: string;
  maxLimit?: string;
  eligibility: Record<Language, string>;
  helpline: string;
  applyUrl: string;
  tag: Record<Language, string>;
  sourcePortal?: string;
};

export type ColdStorageFacility = {
  id: string;
  name: Record<Language, string>;
  location: Record<Language, string>;
  distanceKm: number;
  totalCapacityBags: number;
  vacantCapacityBags: number;
  rentPerBagPerMonth: number;
  temperatureControlled: boolean;
  contactPhone: string;
  hasFumigation: boolean;
  district?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  capacityMt?: number;
  availableMt?: number;
  monthlyRentPerQtl?: number;
  occupancyPct?: number;
  wdraAccredited?: boolean;
  tempRangeC?: string;
  chambers?: number;
  crops?: string[];
  facilityMeta?: Record<string, any>;
};

export type SoilReportData = {
  farmerName: string;
  sampleId: string;
  testDate: string;
  soilType: Record<Language, string>;
  ph: number;
  phStatus: Record<Language, string>;
  organicCarbon: number;
  nitrogenKgPerHa: number;
  nitrogenStatus: 'low' | 'medium' | 'high';
  phosphorusKgPerHa: number;
  phosphorusStatus: 'low' | 'medium' | 'high';
  potassiumKgPerHa: number;
  potassiumStatus: 'low' | 'medium' | 'high';
  recommendedFertilizers: Record<Language, string>[];
};

export type CropSuitability = {
  cropName: Record<Language, string>;
  suitabilityStatus: 'highly-recommended' | 'favorable' | 'moderate';
  reason: Record<Language, string>;
  season: Record<Language, string>;
};

export type PriceTrendDay = {
  day: string;
  price: number;
};

