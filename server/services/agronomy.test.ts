import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_FARM, DEMO_NASA_POWER_FALLBACK } from '../../shared/data/demoFarm';
import { CROP_KNOWLEDGE_BASE } from '../../shared/data/crops';
import { computeEnvironmentalAssessment } from './environmental/environmentalEngine';
import { evaluateCropSuitability } from './crops/cropSuitabilityEngine';
import { generateRotationStrategies, DEFAULT_ROTATION_WEIGHTS } from './rotation/rotationEngine';
import { runWhatIfSimulation } from './simulator/whatIfSimulator';
import { analyzeGeoJsonBoundary } from './geospatial/geoUtils';
import { validateCoordinates, validateDateRange } from './nasa/nasaPowerService';

test('Crop knowledge base includes all 17 representative crops', () => {
  assert.equal(CROP_KNOWLEDGE_BASE.length, 17);
  const names = CROP_KNOWLEDGE_BASE.map((c) => c.name);
  assert.ok(names.includes('Rice'));
  assert.ok(names.includes('Wheat'));
  assert.ok(names.includes('Chickpea'));
  assert.ok(names.includes('Mustard'));
  assert.ok(names.includes('Potato'));
});

test('NASA POWER validators reject invalid coordinates and inverted dates', () => {
  assert.throws(() => validateCoordinates(95, 81), /Invalid latitude/);
  assert.throws(() => validateCoordinates(26.9, 185), /Invalid longitude/);
  assert.throws(() => validateDateRange('2026-05-01', '2026-01-01'), /before or equal/);
  assert.doesNotThrow(() => validateCoordinates(26.924, 81.189));
  assert.doesNotThrow(() => validateDateRange('2025-11-01', '2026-10-31'));
});

test('Environmental assessment detects missing inputs and produces transparent methodology', () => {
  const assessment = computeEnvironmentalAssessment(DEMO_FARM, DEMO_NASA_POWER_FALLBACK);
  assert.ok(assessment.overallRiskScore >= 0 && assessment.overallRiskScore <= 100);
  assert.equal(assessment.riskMetrics.length, 4);
  assert.ok(assessment.scientificCaveats.length >= 2);

  // Farm with missing soil lab metrics should have lower completeness and explicit missingInputs
  const sparseFarm = {
    ...DEMO_FARM,
    id: 'sparse_farm',
    soilProfile: {}
  };
  const sparseAssessment = computeEnvironmentalAssessment(sparseFarm, DEMO_NASA_POWER_FALLBACK);
  assert.ok(sparseAssessment.dataCompletenessPct < assessment.dataCompletenessPct);
  assert.ok(sparseAssessment.missingInputs.includes('Soil pH (lab test)'));
  assert.ok(sparseAssessment.missingInputs.includes('Available Nitrogen (kg/ha)'));
});

test('Crop suitability scores all 17 crops within 0-100 and penalizes water-scarce rice', () => {
  const results = evaluateCropSuitability(DEMO_FARM, DEMO_NASA_POWER_FALLBACK);
  assert.equal(results.length, 17);
  results.forEach((r) => {
    assert.ok(r.score >= 0 && r.score <= 100, `Invalid score for ${r.cropName}: ${r.score}`);
  });

  const scarceFarm = {
    ...DEMO_FARM,
    irrigationAvailable: false,
    waterAvailability: 'scarce' as const
  };
  const scarceResults = evaluateCropSuitability(scarceFarm, DEMO_NASA_POWER_FALLBACK);
  const riceScarce = scarceResults.find((c) => c.cropId === 'rice')!;
  const pearlMilletScarce = scarceResults.find((c) => c.cropId === 'pearl_millet')!;
  assert.ok(pearlMilletScarce.score > riceScarce.score);
  assert.ok(riceScarce.score <= 45);
});

test('Rotation engine preserves existing baseline (Strategy A) and generates >= 3 strategies', () => {
  const suitability = evaluateCropSuitability(DEMO_FARM, DEMO_NASA_POWER_FALLBACK);
  const comparison = generateRotationStrategies(
    DEMO_FARM,
    DEMO_NASA_POWER_FALLBACK,
    suitability,
    DEFAULT_ROTATION_WEIGHTS
  );

  assert.ok(comparison.strategies.length >= 3);
  const stratA = comparison.strategies.find((s) => s.code === 'Strategy A');
  const stratB = comparison.strategies.find((s) => s.code === 'Strategy B');
  const stratC = comparison.strategies.find((s) => s.code === 'Strategy C');

  assert.ok(stratA && stratA.isExistingBaseline);
  assert.ok(stratA.sequenceDisplay.includes('Rice'));
  assert.ok(stratA.sequenceDisplay.includes('Wheat'));
  assert.ok(stratB && stratB.componentScores.soilImprovement > stratA.componentScores.soilImprovement);
  assert.ok(stratC && stratC.componentScores.waterEfficiency > stratA.componentScores.waterEfficiency);
});

test('What-If Simulator recalculates scores under reduced rainfall without mutating baseline', () => {
  const baseRainBefore = DEMO_NASA_POWER_FALLBACK.summary.totalPrecipitationMm;
  const simResult = runWhatIfSimulation(DEMO_FARM, DEMO_NASA_POWER_FALLBACK, {
    presetId: 'reduced_rainfall',
    label: 'Reduced Rainfall (-30%)',
    rainfallDeltaPct: -30,
    temperatureDeltaC: 1.0,
    irrigationAvailableOverride: false,
    waterAvailabilityOverride: 'limited',
    weights: DEFAULT_ROTATION_WEIGHTS
  });

  assert.equal(simResult.isSimulatedAssumption, true);
  assert.equal(DEMO_NASA_POWER_FALLBACK.summary.totalPrecipitationMm, baseRainBefore);
  const riceDelta = simResult.suitabilityChanges.find((c) => c.cropId === 'rice')!;
  assert.ok(riceDelta.delta < 0, 'Rice suitability should drop under reduced rainfall and no irrigation');
});

test('Turf.js GeoJSON analyzer validates polygons and computes area in hectares', () => {
  const analyzed = analyzeGeoJsonBoundary(DEMO_FARM.boundaryGeoJson);
  assert.equal(analyzed.valid, true);
  assert.ok(analyzed.areaHectares > 1 && analyzed.areaHectares < 20);
  assert.ok(Math.abs(analyzed.centroidLat - 26.924) < 0.01);
  assert.throws(() => analyzeGeoJsonBoundary({ type: 'Point', coordinates: [81, 26] }), /Unsupported GeoJSON/);
});
