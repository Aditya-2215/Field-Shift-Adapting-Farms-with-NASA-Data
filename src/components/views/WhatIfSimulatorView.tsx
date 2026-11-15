import { useEffect, useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import type {
  ScenarioPresetId,
  WaterAvailabilityLevel,
  WhatIfSimulationResult
} from '../../../shared/types/agri';
import { useFarms } from '../../contexts/FarmContext';
import { apiClient } from '../../services/api';

const PRESETS: {
  id: ScenarioPresetId;
  label: string;
  rainfallDeltaPct: number;
  temperatureDeltaC: number;
  irrigation: boolean;
  water: WaterAvailabilityLevel;
}[] = [
  { id: 'baseline', label: 'Baseline (Observed)', rainfallDeltaPct: 0, temperatureDeltaC: 0, irrigation: true, water: 'moderate' },
  { id: 'reduced_rainfall', label: 'Reduced Rainfall (-30%)', rainfallDeltaPct: -30, temperatureDeltaC: 0.5, irrigation: true, water: 'limited' },
  { id: 'increased_temperature', label: 'Increased Temp (+2.0°C)', rainfallDeltaPct: -10, temperatureDeltaC: 2.0, irrigation: true, water: 'moderate' },
  { id: 'water_limited', label: 'Water-Limited (Rainfed)', rainfallDeltaPct: -20, temperatureDeltaC: 1.0, irrigation: false, water: 'scarce' }
];

export function WhatIfSimulatorView() {
  const { activeFarm, weights } = useFarms();
  const [presetId, setPresetId] = useState<ScenarioPresetId>('reduced_rainfall');
  const [rainfallDeltaPct, setRainfallDeltaPct] = useState(-30);
  const [temperatureDeltaC, setTemperatureDeltaC] = useState(0.5);
  const [irrigationAvailable, setIrrigationAvailable] = useState(activeFarm.irrigationAvailable);
  const [waterAvailability, setWaterAvailability] = useState<WaterAvailabilityLevel>('limited');
  const [result, setResult] = useState<WhatIfSimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async (overrideParams?: {
    pId: ScenarioPresetId;
    label: string;
    rain: number;
    temp: number;
    irr: boolean;
    water: WaterAvailabilityLevel;
  }) => {
    setRunning(true);
    setError(null);
    const p = overrideParams ?? {
      pId: presetId,
      label: PRESETS.find((x) => x.id === presetId)?.label || 'Custom Scenario',
      rain: rainfallDeltaPct,
      temp: temperatureDeltaC,
      irr: irrigationAvailable,
      water: waterAvailability
    };
    try {
      const sim = await apiClient.runWhatIfSimulation(activeFarm, {
        presetId: p.pId,
        label: p.label,
        rainfallDeltaPct: p.rain,
        temperatureDeltaC: p.temp,
        irrigationAvailableOverride: p.irr,
        waterAvailabilityOverride: p.water,
        weights
      });
      setResult(sim);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    runSimulation({
      pId: 'reduced_rainfall',
      label: 'Reduced Rainfall (-30%)',
      rain: -30,
      temp: 0.5,
      irr: activeFarm.irrigationAvailable,
      water: 'limited'
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFarm.id]);

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setPresetId(p.id);
    setRainfallDeltaPct(p.rainfallDeltaPct);
    setTemperatureDeltaC(p.temperatureDeltaC);
    setIrrigationAvailable(p.id === 'baseline' ? activeFarm.irrigationAvailable : p.irrigation);
    setWaterAvailability(p.id === 'baseline' ? activeFarm.waterAvailability : p.water);
    runSimulation({
      pId: p.id,
      label: p.label,
      rain: p.rainfallDeltaPct,
      temp: p.temperatureDeltaC,
      irr: p.id === 'baseline' ? activeFarm.irrigationAvailable : p.irrigation,
      water: p.id === 'baseline' ? activeFarm.waterAvailability : p.water
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#111C15]">
          What-If Climate & Water Stress Simulator
        </h1>
        <p className="text-sm text-[#4A5D50]">
          Explore how hypothetical rainfall, warming, or irrigation constraints alter crop suitability and rotation rankings on {activeFarm.name}.
        </p>
      </div>

      {/* Explicit Distinction Banner */}
      <div className="rounded-xl border border-[#D97706]/40 bg-[#FEF3C7]/40 px-4 py-3 flex items-start gap-3 text-xs text-[#92400E]">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>SCENARIO ASSUMPTIONS ONLY:</strong> Adjustments below represent user-defined sensitivity tests applied to our deterministic scoring engine—not official NASA climate forecasts or projections.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls */}
        <div className="lg:col-span-4 rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-5">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#111C15]">Scenario Presets</div>
            <div className="grid grid-cols-1 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`text-left px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    presetId === p.id
                      ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                      : 'bg-white text-[#111C15] border-[#DCE3DC] hover:bg-[#F6F8F5]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 border-t border-[#DCE3DC] pt-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="sim-rain" className="font-medium text-[#111C15]">Rainfall Assumption</label>
                <span className="font-mono-num font-semibold text-[#111C15]">
                  {rainfallDeltaPct > 0 ? '+' : ''}{rainfallDeltaPct}%
                </span>
              </div>
              <input
                id="sim-rain"
                type="range"
                min={-50}
                max={40}
                step={5}
                value={rainfallDeltaPct}
                onChange={(e) => {
                  setPresetId('custom');
                  setRainfallDeltaPct(Number(e.target.value));
                }}
                className="w-full accent-[#1B4D3E]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="sim-temp" className="font-medium text-[#111C15]">Temperature Assumption</label>
                <span className="font-mono-num font-semibold text-[#111C15]">
                  {temperatureDeltaC > 0 ? '+' : ''}{temperatureDeltaC.toFixed(1)}°C
                </span>
              </div>
              <input
                id="sim-temp"
                type="range"
                min={-1}
                max={4}
                step={0.5}
                value={temperatureDeltaC}
                onChange={(e) => {
                  setPresetId('custom');
                  setTemperatureDeltaC(Number(e.target.value));
                }}
                className="w-full accent-[#1B4D3E]"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <label htmlFor="sim-irr" className="font-medium text-[#111C15]">Irrigation Available</label>
              <input
                id="sim-irr"
                type="checkbox"
                checked={irrigationAvailable}
                onChange={(e) => {
                  setPresetId('custom');
                  setIrrigationAvailable(e.target.checked);
                }}
                className="w-4 h-4 accent-[#1B4D3E]"
              />
            </div>

            <div>
              <label htmlFor="sim-water" className="block text-xs font-medium text-[#111C15] mb-1">
                Water Availability Assumption
              </label>
              <select
                id="sim-water"
                value={waterAvailability}
                onChange={(e) => {
                  setPresetId('custom');
                  setWaterAvailability(e.target.value as WaterAvailabilityLevel);
                }}
                className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-xs bg-white"
              >
                <option value="abundant">Abundant</option>
                <option value="moderate">Moderate</option>
                <option value="limited">Limited</option>
                <option value="scarce">Scarce</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={running}
            onClick={() => runSimulation()}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#1B4D3E] text-white text-sm font-semibold hover:bg-[#143B2F] disabled:opacity-60"
          >
            <Play className="w-4 h-4" />
            <span>{running ? 'Simulating...' : 'Run Scenario Simulation'}</span>
          </button>
        </div>

        {/* Simulation Outputs */}
        <div className="lg:col-span-8 space-y-6">
          {error && (
            <div className="rounded-xl border border-[#DC2626]/30 bg-white p-4 text-xs text-[#DC2626]">
              {error}
            </div>
          )}

          {result && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#DCE3DC] bg-white p-4">
                  <div className="text-xs text-[#4A5D50] mb-1">Baseline Top Strategy (Observed)</div>
                  <div className="text-sm font-semibold text-[#111C15]">{result.baselineTopStrategy}</div>
                </div>
                <div className="rounded-xl border border-[#1B4D3E] bg-white p-4">
                  <div className="text-xs text-[#1B4D3E] font-semibold mb-1">Simulated Top Strategy</div>
                  <div className="text-sm font-semibold text-[#111C15]">{result.simulatedTopStrategy}</div>
                </div>
              </div>

              <div className="rounded-xl border border-[#DCE3DC] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#DCE3DC]">
                  <h2 className="font-display text-base font-semibold text-[#111C15]">
                    Simulated Rotation Strategy Rankings
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F6F8F5] border-b border-[#DCE3DC] text-[#4A5D50] font-semibold">
                        <th className="py-3 px-4">Strategy</th>
                        <th className="py-3 px-4">Sequence</th>
                        <th className="py-3 px-4 text-right">Sim. Score</th>
                        <th className="py-3 px-4 text-right">Water Eff.</th>
                        <th className="py-3 px-4 text-right">Climate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE3DC]">
                      {result.rotationComparison.strategies.map((st) => (
                        <tr key={st.id}>
                          <td className="py-3 px-4 font-semibold text-[#111C15]">{st.code}</td>
                          <td className="py-3 px-4">{st.sequenceDisplay}</td>
                          <td className="py-3 px-4 text-right font-mono-num font-bold text-[#1B4D3E]">{st.totalScore}/100</td>
                          <td className="py-3 px-4 text-right font-mono-num">{st.componentScores.waterEfficiency}</td>
                          <td className="py-3 px-4 text-right font-mono-num">{st.componentScores.climateResilience}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-[#DCE3DC] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#DCE3DC]">
                  <h2 className="font-display text-base font-semibold text-[#111C15]">
                    Crop Suitability Shift Under Scenario
                  </h2>
                </div>
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F6F8F5] border-b border-[#DCE3DC] text-[#4A5D50] font-semibold">
                        <th className="py-2.5 px-4">Crop</th>
                        <th className="py-2.5 px-4 text-right">Baseline</th>
                        <th className="py-2.5 px-4 text-right">Simulated</th>
                        <th className="py-2.5 px-4 text-right">Shift</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE3DC]">
                      {result.suitabilityChanges.map((ch) => (
                        <tr key={ch.cropId}>
                          <td className="py-2.5 px-4 font-medium text-[#111C15]">{ch.cropName}</td>
                          <td className="py-2.5 px-4 text-right font-mono-num">{ch.baselineScore}</td>
                          <td className="py-2.5 px-4 text-right font-mono-num">{ch.simulatedScore}</td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono-num font-semibold ${
                              ch.delta > 0 ? 'text-[#16A34A]' : ch.delta < 0 ? 'text-[#DC2626]' : 'text-[#4A5D50]'
                            }`}
                          >
                            {ch.delta > 0 ? `+${ch.delta}` : ch.delta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
