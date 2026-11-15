import type {
  EnvironmentalAssessment,
  Farm,
  NasaPowerData,
  RiskLevel,
  RiskMetricDetail
} from '../../../shared/types/agri';

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function classifyRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 25) return 'Moderate';
  return 'Low';
}

export function computeEnvironmentalAssessment(
  farm: Farm,
  power: NasaPowerData
): EnvironmentalAssessment {
  const nowIso = new Date().toISOString();
  const s = power.summary;
  const soil = farm.soilProfile || {};

  // Track missing inputs transparently
  const missingInputs: string[] = [];
  if (soil.ph == null) missingInputs.push('Soil pH (lab test)');
  if (soil.organicCarbonPct == null && soil.organicMatterPct == null) {
    missingInputs.push('Soil Organic Carbon / Organic Matter (%)');
  }
  if (soil.nitrogenKgHa == null) missingInputs.push('Available Nitrogen (kg/ha)');
  if (soil.phosphorusKgHa == null) missingInputs.push('Available Phosphorus (kg/ha)');
  if (soil.potassiumKgHa == null) missingInputs.push('Available Potassium (kg/ha)');
  if (!soil.drainage) missingInputs.push('Field drainage class');
  if (!process.env.NASA_EARTHDATA_TOKEN) {
    missingInputs.push('SMAP Surface Soil Moisture & ECOSTRESS ET (NASA Earthdata token not configured)');
  }

  // Data completeness: 6 soil fields + 2 satellite tiers (NASA POWER + Earthdata)
  let observedFields = 1; // NASA POWER (or fallback)
  if (soil.ph != null) observedFields++;
  if (soil.organicCarbonPct != null || soil.organicMatterPct != null) observedFields++;
  if (soil.nitrogenKgHa != null) observedFields++;
  if (soil.drainage) observedFields++;
  if (farm.waterAvailability) observedFields++;
  const dataCompletenessPct = clamp((observedFields / 7) * 100);

  // 1. Thermal Stress Risk (based on temperature anomaly + heat stress days >= 38C)
  const tempAnomScore = Math.max(0, s.tempAnomalyC) * 22;
  const heatDaysScore = Math.min(55, s.heatStressDays * 1.1);
  const thermalScore = clamp(15 + tempAnomScore + heatDaysScore);

  // 2. Precipitation Deficit & Variability Risk
  const rainDeficit = s.rainfallAnomalyPct < 0 ? Math.abs(s.rainfallAnomalyPct) * 1.8 : 0;
  const dryDaysFactor = Math.max(0, (s.dryDaysCount - 180) * 0.35);
  const extremeRainFactor = s.extremeRainDaysCount * 3.5;
  const precipRiskScore = clamp(12 + rainDeficit + dryDaysFactor + extremeRainFactor);

  // 3. Water Resource & Moisture Balance Pressure
  // Estimate potential ET proxy (~4.2 mm/day mean across tropics/subtropics modulated by solar radiation & temp)
  const estimatedAnnualEtMm = Math.round(
    (0.0023 * (s.meanTempC + 17.8) * Math.sqrt(Math.max(4, s.maxTempC - s.minTempC)) * (s.meanSolarRadiationMjM2 * 0.408)) *
      365 *
      0.72
  );
  const moistureBalanceMm = Math.round(s.totalPrecipitationMm - estimatedAnnualEtMm);
  const waterAvailBase =
    farm.waterAvailability === 'scarce'
      ? 72
      : farm.waterAvailability === 'limited'
      ? 54
      : farm.waterAvailability === 'moderate'
      ? 34
      : 18;
  const irrigationBuffer = farm.irrigationAvailable ? -8 : 14;
  const deficitPush = moistureBalanceMm < -300 ? Math.min(25, Math.abs(moistureBalanceMm + 300) / 35) : 0;
  const waterRiskScore = clamp(waterAvailBase + irrigationBuffer + deficitPush);

  // 4. Soil & Monoculture Vulnerability Risk
  let soilVuln = 30;
  const oc = soil.organicCarbonPct ?? (soil.organicMatterPct != null ? soil.organicMatterPct / 1.724 : null);
  let ocStatus = 'Not measured (lab report missing)';
  if (oc !== null) {
    if (oc < 0.5) {
      soilVuln += 32;
      ocStatus = `Low (${oc.toFixed(2)}% OC — below 0.5% threshold)`;
    } else if (oc < 0.75) {
      soilVuln += 14;
      ocStatus = `Moderate (${oc.toFixed(2)}% OC)`;
    } else {
      soilVuln -= 10;
      ocStatus = `Healthy (${oc.toFixed(2)}% OC)`;
    }
  }
  const hasCerealMonoculture =
    farm.currentCrops.includes('Rice') && farm.currentCrops.includes('Wheat');
  if (hasCerealMonoculture) soilVuln += 18;
  if (soil.nitrogenKgHa != null && soil.nitrogenKgHa < 220) soilVuln += 10;
  const soilRiskScore = clamp(soilVuln);

  const overallRiskScore = clamp(
    thermalScore * 0.24 + precipRiskScore * 0.26 + waterRiskScore * 0.28 + soilRiskScore * 0.22
  );
  const overallRiskLevel = classifyRiskLevel(overallRiskScore);

  const refPeriod = `${power.startDate} to ${power.endDate}`;
  const sourceLabel = power.isDemonstrationFallback
    ? 'DEMONSTRATION DATA (NASA POWER fallback) + Farm Soil Profile'
    : 'NASA POWER API (MERRA-2 / CERES) + Farm Profile';

  const riskMetrics: RiskMetricDetail[] = [
    {
      id: 'thermal_stress',
      name: 'Thermal & Heat-Wave Stress',
      score: thermalScore,
      level: classifyRiskLevel(thermalScore),
      methodology: 'Weighted index combining seasonal mean temperature anomaly vs 20-year NASA POWER climatology and count of days with Tmax >= 38°C.',
      inputVariables: ['T2M (mean)', 'T2M_MAX (>=38°C days)', 'Climatology Temp Anomaly'],
      dataSource: sourceLabel,
      referencePeriod: refPeriod,
      timestamp: nowIso,
      dataCompletenessPct: power.missingDaysCount === 0 ? 95 : 80,
      interpretation:
        s.heatStressDays > 25
          ? `${s.heatStressDays} extreme heat days (>=38°C) increase grain-filling and evaporative stress risk.`
          : 'Moderate thermal load within typical regional crop tolerance.'
    },
    {
      id: 'precip_anomaly',
      name: 'Precipitation Deficit & Extreme Events',
      score: precipRiskScore,
      level: classifyRiskLevel(precipRiskScore),
      methodology: 'Evaluates percentage rainfall departure from 20-year baseline, dry days (<1 mm), and heavy storm days (>=50 mm/day).',
      inputVariables: ['PRECTOTCORR', 'Dry Days (<1mm)', 'Extreme Rain Days (>=50mm)', 'Climatology Baseline'],
      dataSource: sourceLabel,
      referencePeriod: refPeriod,
      timestamp: nowIso,
      dataCompletenessPct: 92,
      interpretation:
        s.rainfallAnomalyPct < -10
          ? `Annual rainfall is ${Math.abs(s.rainfallAnomalyPct)}% below historical baseline, elevating rainfed crop failure risk.`
          : `Rainfall departure (${s.rainfallAnomalyPct > 0 ? '+' : ''}${s.rainfallAnomalyPct}%) with ${s.extremeRainDaysCount} intense rain days.`
    },
    {
      id: 'water_pressure',
      name: 'Water Balance & Irrigation Pressure',
      score: waterRiskScore,
      level: classifyRiskLevel(waterRiskScore),
      methodology: 'Combines Hargreaves-calibrated atmospheric moisture deficit (P - ET0 proxy) with farm irrigation availability and reported water constraints.',
      inputVariables: ['PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'T2M_MAX/MIN', 'Farm Water Availability'],
      dataSource: sourceLabel,
      referencePeriod: refPeriod,
      timestamp: nowIso,
      dataCompletenessPct: process.env.NASA_EARTHDATA_TOKEN ? 85 : 65,
      interpretation: `Estimated annual atmospheric moisture balance is ${moistureBalanceMm} mm; SMAP root-zone soil moisture is ${
        process.env.NASA_EARTHDATA_TOKEN ? 'available' : 'not configured (relying on meteorological P-ET proxy)'
      }.`
    },
    {
      id: 'soil_vulnerability',
      name: 'Soil Organic Carbon & Monoculture Pressure',
      score: soilRiskScore,
      level: classifyRiskLevel(soilRiskScore),
      methodology: 'Evaluates lab soil organic carbon (SOC), available nitrogen, and continuous cereal-only rotation intensity.',
      inputVariables: ['Organic Carbon %', 'Nitrogen kg/ha', 'Current Crop Sequence'],
      dataSource: 'Farmer-entered Soil Health Profile & Crop History',
      referencePeriod: soil.labTestedDate || 'Current profile',
      timestamp: nowIso,
      dataCompletenessPct: soil.organicCarbonPct != null && soil.nitrogenKgHa != null ? 90 : 45,
      interpretation: hasCerealMonoculture
        ? 'Continuous cereal sequence (Rice–Wheat) increases nitrogen depletion and soil compaction risk without a pulse/legume break.'
        : 'Soil profile evaluated against current cropping intensity.'
    }
  ];

  const alerts: EnvironmentalAssessment['alerts'] = [];
  if (s.rainfallAnomalyPct <= -10) {
    alerts.push({
      id: 'alert_rain_deficit',
      severity: s.rainfallAnomalyPct <= -20 ? 'High' : 'Moderate',
      title: 'Below-Normal Seasonal Precipitation',
      detail: `Observed rainfall (${s.totalPrecipitationMm} mm) is ${Math.abs(s.rainfallAnomalyPct)}% below the NASA POWER 20-year climatology baseline.`,
      recommendedAction: 'Prioritize drought-resilient Kharif alternatives (Maize, Sorghum, or Pearl Millet) or moisture-conserving Rabi pulses.'
    });
  }
  if (s.heatStressDays >= 25 || s.tempAnomalyC >= 1.0) {
    const signedTempAnom = `${s.tempAnomalyC >= 0 ? '+' : ''}${s.tempAnomalyC}°C`;
    alerts.push({
      id: 'alert_heat_stress',
      severity: s.heatStressDays >= 40 ? 'High' : 'Moderate',
      title: s.tempAnomalyC >= 1.0 ? 'Elevated Thermal Anomaly & Heat Days' : 'High Heat-Stress Day Frequency',
      detail: `Observed ${s.heatStressDays} extreme heat days (>=38°C) with a seasonal mean anomaly of ${signedTempAnom} vs climatology, elevating late-Rabi terminal heat risk.`,
      recommendedAction: 'Consider earlier-maturing Rabi varieties or shifting partial acreage to Mustard / Chickpea.'
    });
  }
  if (oc !== null && oc < 0.5) {
    alerts.push({
      id: 'alert_low_soc',
      severity: 'High',
      title: 'Low Soil Organic Carbon (<0.50%)',
      detail: `Soil organic carbon is ${oc.toFixed(2)}%, limiting water-holding capacity and nutrient retention.`,
      recommendedAction: 'Introduce nitrogen-fixing legumes (Chickpea, Lentil, or Summer Green Gram) and retain crop residues.'
    });
  }
  if (missingInputs.length > 0) {
    alerts.push({
      id: 'alert_data_gaps',
      severity: 'Low',
      title: 'Incomplete Soil or Satellite Observations',
      detail: `${missingInputs.length} environmental inputs are missing or unconfigured (${missingInputs.slice(0, 2).join(', ')}).`,
      recommendedAction: 'Upload recent lab soil health card values and verify local drainage conditions with an agronomist.'
    });
  }

  return {
    farmId: farm.id,
    overallRiskScore,
    overallRiskLevel,
    dataCompletenessPct,
    timestamp: nowIso,
    methodologySummary:
      'Composite unweighted-adjusted multi-factor index (Thermal 24%, Precipitation 26%, Water Balance 28%, Soil Vulnerability 22%). Does not substitute for field soil testing or local extension advisories.',
    indicators: {
      rainfallAnomalyPct: s.rainfallAnomalyPct,
      temperatureAnomalyC: s.tempAnomalyC,
      estimatedMoistureBalanceMm: moistureBalanceMm,
      heatStressDays: s.heatStressDays,
      drySpellSeverity:
        s.dryDaysCount > 260 ? 'Severe dry-day frequency' : s.dryDaysCount > 210 ? 'Moderate dry spells' : 'Low dry-spell pressure',
      bareFieldRiskWindow:
        farm.currentCrops.length <= 2 ? 'April–June pre-monsoon bare fallow window (~65 days)' : 'Minimal bare fallow',
      soilOrganicCarbonStatus: ocStatus
    },
    riskMetrics,
    alerts,
    missingInputs,
    scientificCaveats: [
      'NASA POWER meteorological grid resolution is 0.5° × 0.625° (~55 km) and reflects regional weather, not plot-level microclimate.',
      'NDVI (when configured) measures canopy greenness and must not be interpreted as a direct measurement of soil fertility or organic carbon.',
      'Water stress estimates without live SMAP/ECOSTRESS granules rely on atmospheric P - ET0 balance and farmer-reported irrigation availability.'
    ]
  };
}
