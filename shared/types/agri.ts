export type UserRole = 'farmer' | 'expert' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  preferredLanguage: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export type AreaUnit = 'hectares' | 'acres';
export type WaterAvailabilityLevel = 'abundant' | 'moderate' | 'limited' | 'scarce';
export type DrainageClass = 'well_drained' | 'moderately_drained' | 'poorly_drained' | 'excessively_drained';

export interface SoilProfile {
  soilType?: string;
  ph?: number | null;
  nitrogenKgHa?: number | null;
  phosphorusKgHa?: number | null;
  potassiumKgHa?: number | null;
  organicCarbonPct?: number | null;
  organicMatterPct?: number | null;
  texture?: string;
  drainage?: DrainageClass | null;
  labReportFileName?: string | null;
  labTestedDate?: string | null;
  notes?: string;
}

export interface CropHistoryEntry {
  year: number;
  season: 'Kharif' | 'Rabi' | 'Zaid' | 'Annual';
  cropName: string;
  yieldNote?: string;
}

export interface GeoJsonPolygon {
  type: 'Feature' | 'FeatureCollection' | 'Polygon';
  geometry?: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  coordinates?: number[][][];
  properties?: Record<string, unknown>;
}

export interface Farm {
  id: string;
  ownerId: string;
  name: string;
  country: string;
  state: string;
  district: string;
  village?: string;
  latitude: number;
  longitude: number;
  area: number;
  areaUnit: AreaUnit;
  irrigationAvailable: boolean;
  irrigationMethod?: string;
  waterAvailability: WaterAvailabilityLevel;
  waterConstraints?: string;
  currentCrops: string[];
  cropHistory: CropHistoryEntry[];
  soilProfile: SoilProfile;
  boundaryGeoJson?: GeoJsonPolygon | null;
  locationAccuracy?: number | null;
  addressComponents?: Record<string, unknown> | null;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DatasetConnectionStatus =
  | 'Connected'
  | 'Pipeline unavailable'
  | 'Authentication required'
  | 'Temporarily unavailable'
  | 'Not configured';

export interface NasaDatasetStatus {
  id: 'power' | 'smap' | 'gpm' | 'modis' | 'landsat' | 'ecostress' | 'grace' | 'srtm';
  name: string;
  shortName: string;
  purpose: string;
  status: DatasetConnectionStatus;
  retrievalImplemented: boolean;
  credentialsConfigured: boolean;
  spatialResolution: string;
  temporalResolution: string;
  lastUpdated: string | null;
  coverageNote: string;
  configurationGuide: string;
  isFieldLevel: boolean;
}

export interface NasaPowerMonthlyPoint {
  month: string; // YYYY-MM
  label: string; // e.g., Jan 2025
  avgTempC: number | null;
  maxTempC: number | null;
  minTempC: number | null;
  precipitationMm: number | null;
  humidityPct: number | null;
  solarRadiationMjM2: number | null;
  tempAnomalyC: number | null;
  rainfallAnomalyPct: number | null;
}

export interface NasaPowerData {
  farmId: string;
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  source: string;
  spatialResolution: string;
  retrievedAt: string;
  isDemonstrationFallback: boolean;
  statusMessage: string;
  summary: {
    meanTempC: number;
    maxTempC: number;
    minTempC: number;
    totalPrecipitationMm: number;
    kharifRainfallMm: number;
    rabiRainfallMm: number;
    zaidRainfallMm: number;
    meanHumidityPct: number;
    meanSolarRadiationMjM2: number;
    tempAnomalyC: number;
    rainfallAnomalyPct: number;
    heatStressDays: number;
    dryDaysCount: number;
    extremeRainDaysCount: number;
    baselineReference: string;
  };
  monthlySeries: NasaPowerMonthlyPoint[];
  missingDaysCount: number;
  totalDaysCount: number;
}

export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface RiskMetricDetail {
  id: string;
  name: string;
  score: number; // 0 to 100 (higher = higher risk)
  level: RiskLevel;
  methodology: string;
  inputVariables: string[];
  dataSource: string;
  referencePeriod: string;
  timestamp: string;
  dataCompletenessPct: number;
  interpretation: string;
}

export interface EnvironmentalAssessment {
  farmId: string;
  overallRiskScore: number;
  overallRiskLevel: RiskLevel;
  dataCompletenessPct: number;
  timestamp: string;
  methodologySummary: string;
  indicators: {
    rainfallAnomalyPct: number;
    temperatureAnomalyC: number;
    estimatedMoistureBalanceMm: number;
    heatStressDays: number;
    drySpellSeverity: string;
    bareFieldRiskWindow: string;
    soilOrganicCarbonStatus: string;
  };
  riskMetrics: RiskMetricDetail[];
  alerts: {
    id: string;
    severity: RiskLevel;
    title: string;
    detail: string;
    recommendedAction: string;
  }[];
  missingInputs: string[];
  scientificCaveats: string[];
}

export type CropCategory = 'Cereal' | 'Pulse' | 'Oilseed' | 'Commercial & Tuber';
export type GrowingSeason = 'Kharif' | 'Rabi' | 'Zaid' | 'Annual';

export interface CropKnowledge {
  id: string;
  name: string;
  scientificName: string;
  category: CropCategory;
  seasons: GrowingSeason[];
  durationDays: { min: number; max: number };
  tempRangeC: { min: number; optimalMin: number; optimalMax: number; max: number };
  waterRequirementMm: { min: number; optimal: number; max: number };
  rainfallRangeMm: { min: number; max: number };
  phRange: { min: number; optimalMin: number; optimalMax: number; max: number };
  preferredTextures: string[];
  drainageRequirement: DrainageClass[];
  nitrogenDemandKgHa: number;
  nitrogenFixingKgHa: number;
  rootDepth: 'shallow' | 'medium' | 'deep';
  organicMatterContribution: 'low' | 'moderate' | 'high';
  erosionProtection: 'low' | 'moderate' | 'high';
  pestRotationGroup: string;
  marketSuitabilityScore: number; // 0-100 baseline regional demand index
  marketNotes: string;
  agronomicNotes: string;
  sourceCitation: string;
}

export type SuitabilityClass =
  | 'Highly Suitable'
  | 'Moderately Suitable'
  | 'Marginally Suitable'
  | 'Unsuitable';

export interface CropSuitabilityResult {
  cropId: string;
  cropName: string;
  scientificName: string;
  category: CropCategory;
  seasons: GrowingSeason[];
  score: number; // 0-100
  classification: SuitabilityClass;
  breakdown: {
    soilCompatibility: number;
    climateCompatibility: number;
    waterCompatibility: number;
    nutrientCompatibility: number;
  };
  supportingEvidence: string[];
  majorLimitations: string[];
  missingInputs: string[];
}

export interface RotationWeights {
  waterEfficiency: number;
  climateResilience: number;
  soilImprovement: number;
  erosionProtection: number;
  marketSuitability: number;
}

export interface RotationStep {
  season: GrowingSeason;
  cropId: string;
  cropName: string;
  category: CropCategory;
  durationDays: number;
  nitrogenBalanceKgHa: number;
  waterDemandMm: number;
  rootDepth: 'shallow' | 'medium' | 'deep';
}

export interface RotationStrategy {
  id: string;
  code: 'Strategy A' | 'Strategy B' | 'Strategy C' | 'Strategy D';
  label: string;
  focus: string;
  isExistingBaseline: boolean;
  sequence: RotationStep[];
  sequenceDisplay: string;
  totalScore: number;
  componentScores: {
    waterEfficiency: number;
    climateResilience: number;
    soilImprovement: number;
    erosionProtection: number;
    marketSuitability: number;
  };
  componentExplanations: {
    waterEfficiency: string;
    climateResilience: string;
    soilImprovement: string;
    erosionProtection: string;
    marketSuitability: string;
  };
  annualWaterDemandMm: number;
  netNitrogenEffectKgHa: number;
  expectedBenefits: string[];
  tradeOffs: string[];
  uncertainties: string[];
  expertValidationNotes: string[];
}

export interface RotationComparison {
  farmId: string;
  generatedAt: string;
  weights: RotationWeights;
  strategies: RotationStrategy[];
  constraintsApplied: string[];
  methodologyNote: string;
}

export type ScenarioPresetId =
  | 'baseline'
  | 'reduced_rainfall'
  | 'increased_temperature'
  | 'water_limited'
  | 'custom';

export interface WhatIfScenarioInput {
  presetId: ScenarioPresetId;
  label: string;
  rainfallDeltaPct: number; // e.g. -30 to +30
  temperatureDeltaC: number; // e.g. -2 to +4
  irrigationAvailableOverride: boolean;
  waterAvailabilityOverride: WaterAvailabilityLevel;
  weights: RotationWeights;
}

export interface WhatIfSimulationResult {
  scenario: WhatIfScenarioInput;
  isSimulatedAssumption: true;
  simulatedAt: string;
  disclaimer: string;
  baselineTopStrategy: string;
  simulatedTopStrategy: string;
  suitabilityChanges: {
    cropId: string;
    cropName: string;
    baselineScore: number;
    simulatedScore: number;
    delta: number;
  }[];
  rotationComparison: RotationComparison;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface FarmReportPayload {
  id: string;
  farm: Farm;
  nasaPower: NasaPowerData;
  datasets: NasaDatasetStatus[];
  assessment: EnvironmentalAssessment;
  suitability: CropSuitabilityResult[];
  rotationComparison: RotationComparison;
  generatedAt: string;
  disclaimer: string;
}

export interface PersistedEnvironmentalAssessment {
  id: string;
  ownerId: string;
  farmId: string;
  overallRiskLevel: RiskLevel;
  overallRiskScore: number;
  dataCompleteness: number;
  summary?: string;
  indicators?: Record<string, unknown>;
  createdAt: string;
}

export interface PersistedRotationScenario {
  id: string;
  ownerId: string;
  farmId: string;
  title: string;
  weights: RotationWeights;
  strategies: {
    id: string;
    code: string;
    label: string;
    sequenceDisplay: string;
    totalScore: number;
    annualWaterDemandMm: number;
    netNitrogenEffectKgHa: number;
  }[];
  createdAt: string;
}

export interface PersistedFarmReport {
  id: string;
  ownerId: string;
  farmId: string;
  title: string;
  recommendedStrategy?: string;
  summary?: string;
  createdAt: string;
}

export interface PersistedAiConversation {
  id: string;
  ownerId: string;
  farmId: string;
  messages: AiChatMessage[];
  createdAt: string;
  updatedAt: string;
}

