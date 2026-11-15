import type { Farm, NasaPowerData } from '../types/agri';

export const DEMO_FARM_ID = 'demo_up_barabanki_01';

export const DEMO_FARM: Farm = {
  id: DEMO_FARM_ID,
  ownerId: 'demo_user',
  name: 'Gomti Basin Demonstration Farm (Barabanki)',
  country: 'India',
  state: 'Uttar Pradesh',
  district: 'Barabanki',
  village: 'Dewa',
  latitude: 26.924,
  longitude: 81.189,
  area: 4.2,
  areaUnit: 'hectares',
  irrigationAvailable: true,
  irrigationMethod: 'Shallow Tubewell + Seasonal Canal',
  waterAvailability: 'moderate',
  waterConstraints: 'Pre-monsoon groundwater drawdown during April–May; canal supply intermittent in late Rabi.',
  currentCrops: ['Rice', 'Wheat'],
  cropHistory: [
    { year: 2023, season: 'Kharif', cropName: 'Rice', yieldNote: '4.1 t/ha (flooded transplanting)' },
    { year: 2023, season: 'Rabi', cropName: 'Wheat', yieldNote: '3.9 t/ha (late March heat stress)' },
    { year: 2024, season: 'Kharif', cropName: 'Rice', yieldNote: '3.8 t/ha (delayed July monsoon)' },
    { year: 2024, season: 'Rabi', cropName: 'Wheat', yieldNote: '4.0 t/ha' },
    { year: 2025, season: 'Kharif', cropName: 'Rice', yieldNote: '3.9 t/ha' },
    { year: 2025, season: 'Rabi', cropName: 'Wheat', yieldNote: '3.7 t/ha (high February max temp)' }
  ],
  soilProfile: {
    soilType: 'Indo-Gangetic Alluvial',
    ph: 7.4,
    nitrogenKgHa: 185,
    phosphorusKgHa: 16,
    potassiumKgHa: 210,
    organicCarbonPct: 0.48,
    organicMatterPct: 0.83,
    texture: 'Alluvial Loam',
    drainage: 'moderately_drained',
    labReportFileName: 'KVK_Barabanki_Soil_Health_Card_2025.pdf',
    labTestedDate: '2025-10-18',
    notes: 'Low organic carbon (<0.5%) and low available nitrogen after 3+ consecutive Rice-Wheat cycles.'
  },
  boundaryGeoJson: {
    type: 'Feature',
    properties: {
      parcelName: 'Gomti Basin Demo Parcel',
      surveyId: 'UP-BBK-2026-042'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [81.1878, 26.9249],
          [81.1902, 26.9249],
          [81.1902, 26.9231],
          [81.1878, 26.9231],
          [81.1878, 26.9249]
        ]
      ]
    }
  },
  isDemo: true,
  createdAt: '2026-01-10T08:00:00.000Z',
  updatedAt: '2026-10-15T08:00:00.000Z'
};

/**
 * Fallback demonstration NASA POWER dataset used ONLY when live NASA POWER API
 * is unreachable or times out. Always flagged explicitly with isDemonstrationFallback = true.
 */
export const DEMO_NASA_POWER_FALLBACK: NasaPowerData = {
  farmId: DEMO_FARM_ID,
  latitude: 26.924,
  longitude: 81.189,
  startDate: '2025-11-01',
  endDate: '2026-10-31',
  source: 'DEMONSTRATION DATA (Cached NASA POWER Representative Baseline for Barabanki, UP)',
  spatialResolution: '0.5° × 0.625° (MERRA-2 Grid Cell)',
  retrievedAt: '2026-11-01T00:00:00.000Z',
  isDemonstrationFallback: true,
  statusMessage: 'DEMONSTRATION DATA: Displayed because live NASA POWER API request was unavailable.',
  summary: {
    meanTempC: 25.8,
    maxTempC: 42.4,
    minTempC: 7.2,
    totalPrecipitationMm: 862.4,
    kharifRainfallMm: 718.0,
    rabiRainfallMm: 84.4,
    zaidRainfallMm: 60.0,
    meanHumidityPct: 62.5,
    meanSolarRadiationMjM2: 18.2,
    tempAnomalyC: 1.15,
    rainfallAnomalyPct: -11.8,
    heatStressDays: 38,
    dryDaysCount: 248,
    extremeRainDaysCount: 6,
    baselineReference: 'Regional 10-year climatology baseline (978 mm/yr, 24.65°C)'
  },
  monthlySeries: [
    { month: '2025-11', label: 'Nov 2025', avgTempC: 21.4, maxTempC: 29.5, minTempC: 13.8, precipitationMm: 4.2, humidityPct: 58.0, solarRadiationMjM2: 15.1, tempAnomalyC: 0.9, rainfallAnomalyPct: -35 },
    { month: '2025-12', label: 'Dec 2025', avgTempC: 16.5, maxTempC: 24.8, minTempC: 8.9, precipitationMm: 6.8, humidityPct: 64.0, solarRadiationMjM2: 13.4, tempAnomalyC: 0.7, rainfallAnomalyPct: -20 },
    { month: '2026-01', label: 'Jan 2026', avgTempC: 15.1, maxTempC: 22.9, minTempC: 7.2, precipitationMm: 14.5, humidityPct: 71.0, solarRadiationMjM2: 13.8, tempAnomalyC: 0.6, rainfallAnomalyPct: -18 },
    { month: '2026-02', label: 'Feb 2026', avgTempC: 19.6, maxTempC: 27.9, minTempC: 11.4, precipitationMm: 11.2, humidityPct: 61.0, solarRadiationMjM2: 17.2, tempAnomalyC: 1.4, rainfallAnomalyPct: -25 },
    { month: '2026-03', label: 'Mar 2026', avgTempC: 25.9, maxTempC: 34.8, minTempC: 16.5, precipitationMm: 9.4, humidityPct: 45.0, solarRadiationMjM2: 21.1, tempAnomalyC: 1.8, rainfallAnomalyPct: -22 },
    { month: '2026-04', label: 'Apr 2026', avgTempC: 31.8, maxTempC: 40.2, minTempC: 22.3, precipitationMm: 8.1, humidityPct: 33.0, solarRadiationMjM2: 23.4, tempAnomalyC: 1.5, rainfallAnomalyPct: -15 },
    { month: '2026-05', label: 'May 2026', avgTempC: 34.2, maxTempC: 42.4, minTempC: 25.8, precipitationMm: 22.5, humidityPct: 38.0, solarRadiationMjM2: 24.0, tempAnomalyC: 1.3, rainfallAnomalyPct: -10 },
    { month: '2026-06', label: 'Jun 2026', avgTempC: 33.1, maxTempC: 40.8, minTempC: 26.9, precipitationMm: 98.4, humidityPct: 57.0, solarRadiationMjM2: 20.6, tempAnomalyC: 1.1, rainfallAnomalyPct: -14 },
    { month: '2026-07', label: 'Jul 2026', avgTempC: 29.8, maxTempC: 34.6, minTempC: 25.9, precipitationMm: 248.6, humidityPct: 79.0, solarRadiationMjM2: 16.4, tempAnomalyC: 0.8, rainfallAnomalyPct: -8 },
    { month: '2026-08', label: 'Aug 2026', avgTempC: 29.3, maxTempC: 33.9, minTempC: 25.5, precipitationMm: 236.2, humidityPct: 82.0, solarRadiationMjM2: 16.1, tempAnomalyC: 0.9, rainfallAnomalyPct: -12 },
    { month: '2026-09', label: 'Sep 2026', avgTempC: 28.6, maxTempC: 33.5, minTempC: 24.1, precipitationMm: 164.3, humidityPct: 78.0, solarRadiationMjM2: 17.5, tempAnomalyC: 1.2, rainfallAnomalyPct: -6 },
    { month: '2026-10', label: 'Oct 2026', avgTempC: 24.8, maxTempC: 31.8, minTempC: 18.4, precipitationMm: 38.2, humidityPct: 64.0, solarRadiationMjM2: 17.8, tempAnomalyC: 1.6, rainfallAnomalyPct: -5 }
  ],
  missingDaysCount: 0,
  totalDaysCount: 365
};
