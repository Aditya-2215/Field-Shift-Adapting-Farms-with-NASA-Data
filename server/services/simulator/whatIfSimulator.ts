import type {
  Farm,
  NasaPowerData,
  WhatIfScenarioInput,
  WhatIfSimulationResult
} from '../../../shared/types/agri';
import { evaluateCropSuitability } from '../crops/cropSuitabilityEngine';
import { generateRotationStrategies } from '../rotation/rotationEngine';

export function runWhatIfSimulation(
  farm: Farm,
  basePower: NasaPowerData,
  input: WhatIfScenarioInput
): WhatIfSimulationResult {
  const baselineSuitability = evaluateCropSuitability(farm, basePower);
  const baselineRotations = generateRotationStrategies(farm, basePower, baselineSuitability, input.weights);

  // Apply non-destructive perturbations to a cloned farm and NASA POWER dataset
  const rainMultiplier = Math.max(0.2, 1 + input.rainfallDeltaPct / 100);
  const tempDelta = input.temperatureDeltaC;

  const perturbedPower: NasaPowerData = {
    ...basePower,
    summary: {
      ...basePower.summary,
      meanTempC: Math.round((basePower.summary.meanTempC + tempDelta) * 10) / 10,
      maxTempC: Math.round((basePower.summary.maxTempC + tempDelta) * 10) / 10,
      minTempC: Math.round((basePower.summary.minTempC + tempDelta) * 10) / 10,
      totalPrecipitationMm: Math.round(basePower.summary.totalPrecipitationMm * rainMultiplier * 10) / 10,
      kharifRainfallMm: Math.round(basePower.summary.kharifRainfallMm * rainMultiplier * 10) / 10,
      rabiRainfallMm: Math.round(basePower.summary.rabiRainfallMm * rainMultiplier * 10) / 10,
      zaidRainfallMm: Math.round(basePower.summary.zaidRainfallMm * rainMultiplier * 10) / 10,
      tempAnomalyC: Math.round((basePower.summary.tempAnomalyC + tempDelta) * 100) / 100,
      rainfallAnomalyPct: Math.round((basePower.summary.rainfallAnomalyPct + input.rainfallDeltaPct) * 10) / 10,
      heatStressDays: Math.max(0, Math.round(basePower.summary.heatStressDays + tempDelta * 12))
    },
    monthlySeries: basePower.monthlySeries.map((pt) => ({
      ...pt,
      avgTempC: pt.avgTempC != null ? Math.round((pt.avgTempC + tempDelta) * 10) / 10 : null,
      maxTempC: pt.maxTempC != null ? Math.round((pt.maxTempC + tempDelta) * 10) / 10 : null,
      minTempC: pt.minTempC != null ? Math.round((pt.minTempC + tempDelta) * 10) / 10 : null,
      precipitationMm: pt.precipitationMm != null ? Math.round(pt.precipitationMm * rainMultiplier * 10) / 10 : null
    }))
  };

  const perturbedFarm: Farm = {
    ...farm,
    irrigationAvailable: input.irrigationAvailableOverride,
    waterAvailability: input.waterAvailabilityOverride
  };

  const simSuitability = evaluateCropSuitability(perturbedFarm, perturbedPower);
  const simRotations = generateRotationStrategies(perturbedFarm, perturbedPower, simSuitability, input.weights);

  const baselineMap = new Map(baselineSuitability.map((s) => [s.cropId, s.score]));
  const suitabilityChanges = simSuitability.map((s) => {
    const baseScore = baselineMap.get(s.cropId) ?? s.score;
    return {
      cropId: s.cropId,
      cropName: s.cropName,
      baselineScore: baseScore,
      simulatedScore: s.score,
      delta: s.score - baseScore
    };
  });

  const baselineTop = [...baselineRotations.strategies].sort((a, b) => b.totalScore - a.totalScore)[0];
  const simulatedTop = [...simRotations.strategies].sort((a, b) => b.totalScore - a.totalScore)[0];

  return {
    scenario: input,
    isSimulatedAssumption: true,
    simulatedAt: new Date().toISOString(),
    disclaimer:
      'SIMULATED USER SCENARIO: These outputs reflect user-adjusted rainfall, temperature, and irrigation assumptions applied to the deterministic scoring model—not official NASA climate forecasts.',
    baselineTopStrategy: `${baselineTop.code}: ${baselineTop.sequenceDisplay} (${baselineTop.totalScore}/100)`,
    simulatedTopStrategy: `${simulatedTop.code}: ${simulatedTop.sequenceDisplay} (${simulatedTop.totalScore}/100)`,
    suitabilityChanges,
    rotationComparison: simRotations
  };
}
