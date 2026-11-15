import { CROP_KNOWLEDGE_BASE } from '../../../shared/data/crops';
import type {
  CropKnowledge,
  CropSuitabilityResult,
  Farm,
  NasaPowerData,
  SuitabilityClass
} from '../../../shared/types/agri';

export interface SuitabilityWeights {
  soil: number;
  climate: number;
  water: number;
  nutrient: number;
}

export const DEFAULT_SUITABILITY_WEIGHTS: SuitabilityWeights = {
  soil: 0.28,
  climate: 0.30,
  water: 0.27,
  nutrient: 0.15
};

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function classifySuitability(score: number): SuitabilityClass {
  if (score >= 75) return 'Highly Suitable';
  if (score >= 55) return 'Moderately Suitable';
  if (score >= 35) return 'Marginally Suitable';
  return 'Unsuitable';
}

function getSeasonalTempForCrop(crop: CropKnowledge, power: NasaPowerData): number {
  // Approximate seasonal mean temp from monthly series
  const months = power.monthlySeries;
  if (!months.length) return power.summary.meanTempC;

  const matching = months.filter((m) => {
    const mo = Number(m.month.split('-')[1]);
    if (crop.seasons.includes('Annual')) return true;
    const isKharif = mo >= 6 && mo <= 10;
    const isRabi = mo >= 11 || mo <= 3;
    const isZaid = mo === 4 || mo === 5;
    return (
      (crop.seasons.includes('Kharif') && isKharif) ||
      (crop.seasons.includes('Rabi') && isRabi) ||
      (crop.seasons.includes('Zaid') && isZaid)
    );
  });

  const valid = matching.map((m) => m.avgTempC).filter((v): v is number => v !== null);
  if (!valid.length) return power.summary.meanTempC;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function evaluateCropSuitability(
  farm: Farm,
  power: NasaPowerData,
  weights: SuitabilityWeights = DEFAULT_SUITABILITY_WEIGHTS
): CropSuitabilityResult[] {
  const soil = farm.soilProfile || {};
  const s = power.summary;

  return CROP_KNOWLEDGE_BASE.map((crop) => {
    const evidence: string[] = [];
    const limitations: string[] = [];
    const missingInputs: string[] = [];

    // 1. Soil Compatibility (pH, texture, drainage)
    let soilScore = 65; // neutral baseline when partial soil data exists
    if (soil.ph != null) {
      if (soil.ph >= crop.phRange.optimalMin && soil.ph <= crop.phRange.optimalMax) {
        soilScore += 25;
        evidence.push(`Soil pH (${soil.ph}) is inside optimal range (${crop.phRange.optimalMin}–${crop.phRange.optimalMax}).`);
      } else if (soil.ph >= crop.phRange.min && soil.ph <= crop.phRange.max) {
        soilScore += 8;
        evidence.push(`Soil pH (${soil.ph}) is tolerable (${crop.phRange.min}–${crop.phRange.max}).`);
      } else {
        soilScore -= 40;
        limitations.push(`Soil pH (${soil.ph}) falls outside crop tolerance (${crop.phRange.min}–${crop.phRange.max}).`);
      }
    } else {
      missingInputs.push('Soil pH');
    }

    if (soil.texture) {
      const texLower = soil.texture.toLowerCase();
      const matched = crop.preferredTextures.some((t) => texLower.includes(t) || t.includes(texLower));
      if (matched) {
        soilScore += 10;
        evidence.push(`Soil texture (${soil.texture}) matches crop preference.`);
      } else {
        soilScore -= 12;
        limitations.push(`Soil texture (${soil.texture}) is suboptimal compared to ${crop.preferredTextures.join(', ')}.`);
      }
    } else {
      missingInputs.push('Soil texture');
    }

    if (soil.drainage) {
      if (crop.drainageRequirement.includes(soil.drainage)) {
        soilScore += 8;
      } else {
        soilScore -= 25;
        limitations.push(`Field drainage (${soil.drainage.replace(/_/g, ' ')}) poses waterlogging or moisture-retention risk.`);
      }
    } else {
      missingInputs.push('Drainage class');
    }
    soilScore = clamp(soilScore);

    // 2. Climate Compatibility (seasonal mean temp, extreme heat)
    const seasonalTemp = getSeasonalTempForCrop(crop, power);
    let climateScore = 70;
    if (seasonalTemp >= crop.tempRangeC.optimalMin && seasonalTemp <= crop.tempRangeC.optimalMax) {
      climateScore = 92;
      evidence.push(`Seasonal temperature (${seasonalTemp.toFixed(1)}°C) aligns with optimal band (${crop.tempRangeC.optimalMin}–${crop.tempRangeC.optimalMax}°C).`);
    } else if (seasonalTemp >= crop.tempRangeC.min && seasonalTemp <= crop.tempRangeC.max) {
      climateScore = 66;
      limitations.push(`Seasonal temperature (${seasonalTemp.toFixed(1)}°C) is near edge of optimal thermal window.`);
    } else {
      climateScore = 24;
      limitations.push(`Seasonal temperature (${seasonalTemp.toFixed(1)}°C) exceeds safe thermal envelope (${crop.tempRangeC.min}–${crop.tempRangeC.max}°C).`);
    }

    if (crop.seasons.includes('Rabi') && s.tempAnomalyC > 1.0 && crop.tempRangeC.max <= 32) {
      climateScore -= 10;
      limitations.push(`Positive temperature anomaly (+${s.tempAnomalyC}°C) increases terminal heat sensitivity.`);
    }
    climateScore = clamp(climateScore);

    // 3. Water & Rainfall Compatibility
    let waterScore = 70;
    const seasonalRain = crop.seasons.includes('Kharif')
      ? s.kharifRainfallMm
      : crop.seasons.includes('Rabi')
      ? s.rabiRainfallMm
      : crop.seasons.includes('Zaid')
      ? s.zaidRainfallMm
      : s.totalPrecipitationMm;

    const effectiveWaterSupply = farm.irrigationAvailable
      ? seasonalRain +
        (farm.waterAvailability === 'abundant'
          ? 900
          : farm.waterAvailability === 'moderate'
          ? 500
          : farm.waterAvailability === 'limited'
          ? 240
          : 90)
      : seasonalRain;

    if (effectiveWaterSupply >= crop.waterRequirementMm.optimal) {
      waterScore = 90;
      evidence.push(`Seasonal rainfall (${Math.round(seasonalRain)} mm) plus ${farm.irrigationAvailable ? 'irrigation' : 'rainfed supply'} meets optimal water demand (${crop.waterRequirementMm.optimal} mm).`);
    } else if (effectiveWaterSupply >= crop.waterRequirementMm.min) {
      waterScore = 68;
      limitations.push(`Water supply (${Math.round(effectiveWaterSupply)} mm) is below optimal (${crop.waterRequirementMm.optimal} mm) — supplemental irrigation timing is critical.`);
    } else {
      const deficitRatio = (crop.waterRequirementMm.min - effectiveWaterSupply) / crop.waterRequirementMm.min;
      waterScore = clamp(50 - deficitRatio * 65);
      limitations.push(`High water deficit: crop requires >=${crop.waterRequirementMm.min} mm vs ~${Math.round(effectiveWaterSupply)} mm available.`);
    }

    // Penalize high-water crops on limited/scarce farms even if technically irrigable
    if (crop.waterRequirementMm.optimal >= 1000 && (farm.waterAvailability === 'limited' || farm.waterAvailability === 'scarce')) {
      waterScore = Math.min(waterScore, farm.waterAvailability === 'scarce' ? 28 : 35);
      limitations.push(`High water demand (${crop.waterRequirementMm.optimal} mm) conflicts with ${farm.waterAvailability} water availability.`);
    }
    waterScore = clamp(waterScore);

    // 4. Nutrient & Soil Health Compatibility
    let nutrientScore = 68;
    if (soil.nitrogenKgHa != null) {
      if (crop.nitrogenFixingKgHa > 0 && soil.nitrogenKgHa < 220) {
        nutrientScore = 94;
        evidence.push(`Low soil nitrogen (${soil.nitrogenKgHa} kg/ha) benefits directly from ${crop.name}'s biological N fixation (~${crop.nitrogenFixingKgHa} kg N/ha).`);
      } else if (soil.nitrogenKgHa < 200 && crop.nitrogenDemandKgHa >= 110) {
        nutrientScore = 48;
        limitations.push(`Low available nitrogen (${soil.nitrogenKgHa} kg/ha) will require heavy external fertilizer for high-demand ${crop.name} (${crop.nitrogenDemandKgHa} kg N/ha).`);
      } else {
        nutrientScore = 78;
      }
    } else {
      missingInputs.push('Soil Nitrogen (kg/ha)');
      if (crop.nitrogenFixingKgHa > 0) {
        nutrientScore = 82;
        evidence.push('Legume biological nitrogen fixation reduces synthetic N fertilizer dependency.');
      }
    }

    const rawScore =
      soilScore * weights.soil +
      climateScore * weights.climate +
      waterScore * weights.water +
      nutrientScore * weights.nutrient;

    // Agronomic limiting factor: severe water deficit caps overall suitability
    const totalScore = clamp(waterScore <= 35 ? Math.min(rawScore, waterScore + 12) : rawScore);

    return {
      cropId: crop.id,
      cropName: crop.name,
      scientificName: crop.scientificName,
      category: crop.category,
      seasons: crop.seasons,
      score: totalScore,
      classification: classifySuitability(totalScore),
      breakdown: {
        soilCompatibility: soilScore,
        climateCompatibility: climateScore,
        waterCompatibility: waterScore,
        nutrientCompatibility: nutrientScore
      },
      supportingEvidence: evidence,
      majorLimitations: limitations,
      missingInputs: Array.from(new Set(missingInputs))
    };
  }).sort((a, b) => b.score - a.score);
}
