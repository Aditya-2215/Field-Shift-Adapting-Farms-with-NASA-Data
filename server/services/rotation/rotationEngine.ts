import { CROP_KNOWLEDGE_BASE, getCropById } from '../../../shared/data/crops';
import type {
  CropKnowledge,
  CropSuitabilityResult,
  Farm,
  GrowingSeason,
  NasaPowerData,
  RotationComparison,
  RotationStep,
  RotationStrategy,
  RotationWeights
} from '../../../shared/types/agri';

export const DEFAULT_ROTATION_WEIGHTS: RotationWeights = {
  waterEfficiency: 25,
  climateResilience: 25,
  soilImprovement: 25,
  erosionProtection: 15,
  marketSuitability: 10
};

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function buildStep(crop: CropKnowledge, season: GrowingSeason): RotationStep {
  const avgDuration = Math.round((crop.durationDays.min + crop.durationDays.max) / 2);
  const netN = crop.nitrogenFixingKgHa > 0 ? crop.nitrogenFixingKgHa - crop.nitrogenDemandKgHa : -crop.nitrogenDemandKgHa;
  return {
    season,
    cropId: crop.id,
    cropName: crop.name,
    category: crop.category,
    durationDays: avgDuration,
    nitrogenBalanceKgHa: netN,
    waterDemandMm: crop.waterRequirementMm.optimal,
    rootDepth: crop.rootDepth
  };
}

function resolveBaselineSteps(farm: Farm): RotationStep[] {
  const names = farm.currentCrops.length ? farm.currentCrops : ['Rice', 'Wheat'];
  const steps: RotationStep[] = [];
  const defaultSeasons: GrowingSeason[] = ['Kharif', 'Rabi', 'Zaid'];

  names.slice(0, 3).forEach((name, idx) => {
    const crop = getCropById(name.trim()) ?? CROP_KNOWLEDGE_BASE[0];
    const season = crop.seasons[0] ?? defaultSeasons[idx] ?? 'Kharif';
    steps.push(buildStep(crop, season));
  });

  return steps;
}

function pickBestCrop(
  suitability: CropSuitabilityResult[],
  filterFn: (crop: CropKnowledge, s: CropSuitabilityResult) => boolean,
  fallbackId: string
): CropKnowledge {
  const ranked = suitability
    .map((s) => ({ s, crop: getCropById(s.cropId) }))
    .filter((item): item is { s: CropSuitabilityResult; crop: CropKnowledge } => Boolean(item.crop))
    .filter(({ crop, s }) => filterFn(crop, s));

  if (ranked.length > 0) return ranked[0].crop;
  return getCropById(fallbackId) ?? CROP_KNOWLEDGE_BASE[0];
}

function scoreRotationSequence(
  steps: RotationStep[],
  farm: Farm,
  power: NasaPowerData,
  suitabilityMap: Map<string, CropSuitabilityResult>,
  weights: RotationWeights
): Omit<RotationStrategy, 'id' | 'code' | 'label' | 'focus' | 'isExistingBaseline'> {
  const crops = steps
    .map((st) => getCropById(st.cropId))
    .filter((c): c is CropKnowledge => Boolean(c));

  const annualWaterDemandMm = steps.reduce((sum, st) => sum + st.waterDemandMm, 0);
  const netNitrogenEffectKgHa = steps.reduce((sum, st) => sum + st.nitrogenBalanceKgHa, 0);
  const totalDurationDays = steps.reduce((sum, st) => sum + st.durationDays, 0);

  // 1. Water Efficiency (0-100): lower annual consumptive demand relative to rainfall + irrigation buffer
  const availWaterProxy =
    power.summary.totalPrecipitationMm +
    (farm.irrigationAvailable
      ? farm.waterAvailability === 'abundant'
        ? 950
        : farm.waterAvailability === 'moderate'
        ? 550
        : 220
      : 0);
  const demandRatio = annualWaterDemandMm / Math.max(400, availWaterProxy);
  const waterEfficiency = clamp(100 - Math.max(0, demandRatio - 0.55) * 72);

  // 2. Climate Resilience (0-100): average climate suitability + heat tolerance + crop diversity
  const avgClimateSuit =
    steps.reduce((sum, st) => sum + (suitabilityMap.get(st.cropId)?.breakdown.climateCompatibility ?? 60), 0) /
    Math.max(1, steps.length);
  const uniqueCategories = new Set(crops.map((c) => c.category)).size;
  const diversityBonus = uniqueCategories >= 3 ? 12 : uniqueCategories === 2 ? 6 : -8;
  const climateResilience = clamp(avgClimateSuit + diversityBonus);

  // 3. Soil Improvement (0-100): legume presence, root depth diversity, organic matter, pest-family break
  const hasLegume = crops.some((c) => c.nitrogenFixingKgHa > 0);
  const rootDepths = new Set(crops.map((c) => c.rootDepth)).size;
  const pestGroups = new Set(crops.map((c) => c.pestRotationGroup)).size;
  const highOmCount = crops.filter((c) => c.organicMatterContribution === 'high').length;
  const sameFamilyPenalty = pestGroups < crops.length ? -12 : 10;
  const soilImprovement = clamp(
    42 + (hasLegume ? 24 : -10) + rootDepths * 8 + highOmCount * 7 + sameFamilyPenalty
  );

  // 4. Erosion Protection (0-100): canopy cover days across the 365-day year & erosion ratings
  const coverRatio = Math.min(1, totalDurationDays / 320);
  const highErosionCount = crops.filter((c) => c.erosionProtection === 'high').length;
  const modErosionCount = crops.filter((c) => c.erosionProtection === 'moderate').length;
  const erosionProtection = clamp(32 + coverRatio * 34 + highErosionCount * 14 + modErosionCount * 7);

  // 5. Market Suitability (0-100): mean regional demand & suitability compatibility
  const avgMarket =
    crops.reduce((sum, c) => sum + c.marketSuitabilityScore, 0) / Math.max(1, crops.length);
  const avgOverallSuit =
    steps.reduce((sum, st) => sum + (suitabilityMap.get(st.cropId)?.score ?? 65), 0) /
    Math.max(1, steps.length);
  const marketSuitability = clamp(avgMarket * 0.6 + avgOverallSuit * 0.4);

  const weightSum =
    weights.waterEfficiency +
    weights.climateResilience +
    weights.soilImprovement +
    weights.erosionProtection +
    weights.marketSuitability;

  const norm = weightSum > 0 ? weightSum : 100;
  const totalScore = clamp(
    (waterEfficiency * weights.waterEfficiency +
      climateResilience * weights.climateResilience +
      soilImprovement * weights.soilImprovement +
      erosionProtection * weights.erosionProtection +
      marketSuitability * weights.marketSuitability) /
      norm
  );

  const sequenceDisplay = steps.map((st) => `${st.cropName} (${st.season})`).join(' → ');

  const expectedBenefits: string[] = [];
  if (hasLegume) {
    const legNames = crops.filter((c) => c.nitrogenFixingKgHa > 0).map((c) => c.name).join(', ');
    expectedBenefits.push(`Includes nitrogen-fixing legume (${legNames}), reducing synthetic urea requirements for the following cereal.`);
  }
  if (rootDepths >= 2) {
    expectedBenefits.push('Alternates rooting depths across seasons to scavenge subsoil nutrients and break shallow plow pans.');
  }
  if (annualWaterDemandMm <= 1050) {
    expectedBenefits.push(`Lower annual water demand (~${annualWaterDemandMm} mm) eases groundwater pumping pressure.`);
  }
  if (totalDurationDays >= 275) {
    expectedBenefits.push(`Maintains vegetative soil cover across ~${totalDurationDays} days/year, limiting bare-fallow erosion.`);
  }
  if (expectedBenefits.length === 0) {
    expectedBenefits.push('Maintains familiar agronomic calendar and established regional procurement channels.');
  }

  const tradeOffs: string[] = [];
  if (totalDurationDays > 335) {
    tradeOffs.push(`Tight turnaround (~${365 - totalDurationDays} days/year) requires timely harvesting or short-duration cultivars.`);
  }
  if (annualWaterDemandMm > 1400) {
    tradeOffs.push(`High cumulative water requirement (~${annualWaterDemandMm} mm) increases vulnerability during dry monsoons.`);
  }
  if (!hasLegume) {
    tradeOffs.push('Absence of a legume phase increases reliance on synthetic nitrogen and risks long-term organic carbon decline.');
  }
  if (steps.some((st) => st.category === 'Pulse')) {
    tradeOffs.push('Pulse phases can face pod-borer pest pressure or local price fluctuations without MSP procurement.');
  }

  const uncertainties: string[] = [
    'Actual seasonal monsoon onset and dry-spell timing cannot be predicted from historical NASA POWER averages.',
    farm.soilProfile?.organicCarbonPct == null
      ? 'Soil organic carbon is unmeasured; nitrogen mineralization estimates carry wider uncertainty.'
      : 'Micro-plot soil heterogeneity and cultivar duration choice may shift exact harvest dates by 10–15 days.'
  ];

  const expertValidationNotes: string[] = [
    'Confirm local short-duration cultivar availability and seed treatment with your district Krishi Vigyan Kendra (KVK).',
    'Verify post-harvest market linkage or MSP procurement window before shifting acreage into pulses or oilseeds.'
  ];

  return {
    sequence: steps,
    sequenceDisplay,
    totalScore,
    componentScores: {
      waterEfficiency,
      climateResilience,
      soilImprovement,
      erosionProtection,
      marketSuitability
    },
    componentExplanations: {
      waterEfficiency: `Estimated ${annualWaterDemandMm} mm cumulative water demand vs ${Math.round(availWaterProxy)} mm seasonal rainfall + irrigation buffer.`,
      climateResilience: `Mean seasonal climate fit ${Math.round(avgClimateSuit)}/100 across ${uniqueCategories} crop categories.`,
      soilImprovement: `${hasLegume ? 'Legume N-fixation active' : 'No N-fixing legume'}; ${rootDepths} root-depth classes; net N balance ${netNitrogenEffectKgHa > 0 ? '+' : ''}${netNitrogenEffectKgHa} kg/ha before fertilizer.`,
      erosionProtection: `Active crop cover for ~${totalDurationDays} days/year across ${steps.length} seasonal phases.`,
      marketSuitability: `Weighted regional demand (${Math.round(avgMarket)}/100) balanced with site suitability (${Math.round(avgOverallSuit)}/100).`
    },
    annualWaterDemandMm,
    netNitrogenEffectKgHa,
    expectedBenefits,
    tradeOffs,
    uncertainties,
    expertValidationNotes
  };
}

export function generateRotationStrategies(
  farm: Farm,
  power: NasaPowerData,
  suitability: CropSuitabilityResult[],
  weights: RotationWeights = DEFAULT_ROTATION_WEIGHTS
): RotationComparison {
  const suitabilityMap = new Map(suitability.map((s) => [s.cropId, s]));

  // Strategy A: Existing Farmer Rotation
  const baselineSteps = resolveBaselineSteps(farm);
  const scoredA = scoreRotationSequence(baselineSteps, farm, power, suitabilityMap, weights);

  // Strategy B: Soil Improvement-Focused Rotation (Keep viable Kharif or balanced Kharif + Rabi Pulse + Zaid Legume)
  const kharifForSoil =
    farm.waterAvailability === 'scarce' || !farm.irrigationAvailable
      ? pickBestCrop(suitability, (c) => c.seasons.includes('Kharif') && c.waterRequirementMm.optimal <= 600, 'maize')
      : getCropById(baselineSteps[0]?.cropId ?? 'rice') ?? getCropById('rice')!;

  const rabiPulse = pickBestCrop(
    suitability,
    (c) => c.seasons.includes('Rabi') && c.category === 'Pulse',
    'chickpea'
  );
  const zaidPulse = pickBestCrop(
    suitability,
    (c) => c.seasons.includes('Zaid') && c.nitrogenFixingKgHa > 0,
    'green_gram'
  );

  // Check 365-day constraint before adding 3rd crop
  const baseSoilDays =
    Math.round((kharifForSoil.durationDays.min + kharifForSoil.durationDays.max) / 2) +
    Math.round((rabiPulse.durationDays.min + rabiPulse.durationDays.max) / 2);
  const stepsB: RotationStep[] = [buildStep(kharifForSoil, 'Kharif'), buildStep(rabiPulse, 'Rabi')];
  if (baseSoilDays <= 265 && (farm.irrigationAvailable || power.summary.zaidRainfallMm >= 50)) {
    stepsB.push(buildStep(zaidPulse, 'Zaid'));
  }
  const scoredB = scoreRotationSequence(stepsB, farm, power, suitabilityMap, weights);

  // Strategy C: Climate & Water Resilience-Focused Rotation (Low-water Kharif cereal/millet + low-water Rabi oilseed/pulse)
  const resilientKharif = pickBestCrop(
    suitability,
    (c) =>
      c.seasons.includes('Kharif') &&
      c.waterRequirementMm.optimal <= 600 &&
      c.id !== 'rice' &&
      c.tempRangeC.max >= 36,
    'maize'
  );
  const resilientRabi = pickBestCrop(
    suitability,
    (c) =>
      c.seasons.includes('Rabi') &&
      c.waterRequirementMm.optimal <= 360 &&
      c.id !== rabiPulse.id &&
      c.id !== resilientKharif.id,
    'mustard'
  );
  const resilientZaid = pickBestCrop(
    suitability,
    (c) =>
      c.seasons.includes('Zaid') &&
      c.waterRequirementMm.optimal <= 330 &&
      c.id !== resilientKharif.id &&
      c.id !== resilientRabi.id,
    'black_gram'
  );

  const baseResDays =
    Math.round((resilientKharif.durationDays.min + resilientKharif.durationDays.max) / 2) +
    Math.round((resilientRabi.durationDays.min + resilientRabi.durationDays.max) / 2);
  const stepsC: RotationStep[] = [buildStep(resilientKharif, 'Kharif'), buildStep(resilientRabi, 'Rabi')];
  if (baseResDays <= 255) {
    stepsC.push(buildStep(resilientZaid, 'Zaid'));
  }
  const scoredC = scoreRotationSequence(stepsC, farm, power, suitabilityMap, weights);

  // Strategy D: Balanced Cereal–Pulse–Oilseed Diversification
  const divKharif = pickBestCrop(
    suitability,
    (c) => c.seasons.includes('Kharif') && (c.category === 'Oilseed' || c.id === 'maize' || c.id === 'pigeon_pea'),
    'soybean'
  );
  const divRabi = pickBestCrop(
    suitability,
    (c) => c.seasons.includes('Rabi') && (c.id === 'wheat' || c.id === 'mustard') && c.id !== divKharif.id,
    'wheat'
  );
  const divZaid = pickBestCrop(
    suitability,
    (c) => c.seasons.includes('Zaid') && c.nitrogenFixingKgHa > 0 && c.id !== divKharif.id && c.id !== divRabi.id,
    'green_gram'
  );
  const stepsD: RotationStep[] = [buildStep(divKharif, 'Kharif'), buildStep(divRabi, 'Rabi')];
  if (farm.irrigationAvailable) {
    stepsD.push(buildStep(divZaid, 'Zaid'));
  }
  const scoredD = scoreRotationSequence(stepsD, farm, power, suitabilityMap, weights);

  const strategies: RotationStrategy[] = [
    {
      id: 'strategy_a_baseline',
      code: 'Strategy A',
      label: 'Existing Farmer Rotation (Baseline)',
      focus: 'Preserves current cropping pattern as reference benchmark',
      isExistingBaseline: true,
      ...scoredA
    },
    {
      id: 'strategy_b_soil',
      code: 'Strategy B',
      label: 'Soil Health & Nitrogen Restoration',
      focus: 'Integrates Rabi/Zaid legumes to rebuild organic carbon and fix biological N',
      isExistingBaseline: false,
      ...scoredB
    },
    {
      id: 'strategy_c_climate',
      code: 'Strategy C',
      label: 'Climate & Water Resilience',
      focus: 'Substitutes high-water cereals with drought-resilient Kharif & low-ET Rabi crops',
      isExistingBaseline: false,
      ...scoredC
    },
    {
      id: 'strategy_d_diversified',
      code: 'Strategy D',
      label: 'Diversified Cereal–Legume–Oilseed',
      focus: 'Balances regional staple procurement with multi-family pest-cycle interruption',
      isExistingBaseline: false,
      ...scoredD
    }
  ];

  return {
    farmId: farm.id,
    generatedAt: new Date().toISOString(),
    weights,
    strategies,
    constraintsApplied: [
      'Seasonal continuity enforced (Kharif Jun–Oct → Rabi Nov–Mar → optional Zaid Apr–May).',
      'Cumulative annual crop duration constrained within 365 days with turnaround margin.',
      'High-water crops (>=1000 mm) filtered out from resilience strategies on limited/scarce water farms.',
      'Consecutive same-family monoculture penalized in Soil Improvement scoring.'
    ],
    methodologyNote:
      'Deterministic multi-criteria decision analysis (MCDA). Modeled component scores are comparative agronomic indicators, not yield or profit guarantees.'
  };
}
