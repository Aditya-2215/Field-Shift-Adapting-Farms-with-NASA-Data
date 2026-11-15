import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus, CheckCircle2, Download, History, RotateCcw, Trash2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { DEMO_FARM_ID } from '../../../shared/data/demoFarm';
import type { RotationWeights } from '../../../shared/types/agri';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_WEIGHTS, useFarms } from '../../contexts/FarmContext';
import { apiClient } from '../../services/api';
import { exportRotationCsv } from '../../utils/exportReports';
import { LoadingCardGrid } from '../common/StatusAndError';

const WEIGHT_LABELS: { key: keyof RotationWeights; label: string }[] = [
  { key: 'waterEfficiency', label: 'Water Efficiency' },
  { key: 'climateResilience', label: 'Climate Resilience' },
  { key: 'soilImprovement', label: 'Soil Improvement & N' },
  { key: 'erosionProtection', label: 'Erosion Protection' },
  { key: 'marketSuitability', label: 'Market Suitability' }
];

export function RotationPlannerView() {
  const { user } = useAuth();
  const { activeFarm, weights, setWeights, rotationComparison, isLoadingAnalysis } = useFarms();
  const queryClient = useQueryClient();
  const [scenarioTitle, setScenarioTitle] = useState('');
  const [savingScenario, setSavingScenario] = useState(false);
  const [scenarioFeedback, setScenarioFeedback] = useState<string | null>(null);

  const canPersist = Boolean(user && activeFarm.id !== DEMO_FARM_ID);

  const savedScenariosQuery = useQuery({
    queryKey: ['rotations', user?.uid ?? 'anon', activeFarm.id],
    enabled: canPersist,
    queryFn: () => apiClient.getRotationScenarios(activeFarm.id)
  });

  const handleSaveScenario = async () => {
    if (!canPersist || savingScenario) return;
    setSavingScenario(true);
    setScenarioFeedback(null);
    const title = scenarioTitle.trim() || `${activeFarm.name} Plan (${new Date().toLocaleDateString()})`;
    try {
      await apiClient.saveRotationScenario(activeFarm.id, title, weights);
      setScenarioTitle('');
      await queryClient.invalidateQueries({ queryKey: ['rotations', user?.uid ?? 'anon', activeFarm.id] });
      setScenarioFeedback(`Saved rotation scenario "${title}" to PostgreSQL.`);
    } catch (err) {
      setScenarioFeedback(err instanceof Error ? err.message : 'Unable to save rotation scenario.');
    } finally {
      setSavingScenario(false);
    }
  };

  const handleDeleteScenario = async (id: string) => {
    try {
      await apiClient.deleteRotationScenario(id);
      await queryClient.invalidateQueries({ queryKey: ['rotations', user?.uid ?? 'anon', activeFarm.id] });
    } catch (err) {
      setScenarioFeedback(err instanceof Error ? err.message : 'Unable to delete rotation scenario.');
    }
  };

  if (isLoadingAnalysis && !rotationComparison) {
    return <LoadingCardGrid rows={4} />;
  }

  const strategies = rotationComparison?.strategies ?? [];
  const totalWeightSum =
    weights.waterEfficiency +
    weights.climateResilience +
    weights.soilImprovement +
    weights.erosionProtection +
    weights.marketSuitability;

  const radarData = [
    {
      metric: 'Water',
      ...Object.fromEntries(strategies.map((s) => [s.code, s.componentScores.waterEfficiency]))
    },
    {
      metric: 'Climate',
      ...Object.fromEntries(strategies.map((s) => [s.code, s.componentScores.climateResilience]))
    },
    {
      metric: 'Soil',
      ...Object.fromEntries(strategies.map((s) => [s.code, s.componentScores.soilImprovement]))
    },
    {
      metric: 'Erosion',
      ...Object.fromEntries(strategies.map((s) => [s.code, s.componentScores.erosionProtection]))
    },
    {
      metric: 'Market',
      ...Object.fromEntries(strategies.map((s) => [s.code, s.componentScores.marketSuitability]))
    }
  ];

  const barData = strategies.map((s) => ({
    name: s.code,
    score: s.totalScore,
    water: s.componentScores.waterEfficiency,
    soil: s.componentScores.soilImprovement,
    climate: s.componentScores.climateResilience
  }));

  const applyPreset = (preset: 'balanced' | 'soil' | 'water') => {
    if (preset === 'balanced') setWeights(DEFAULT_WEIGHTS);
    if (preset === 'soil') {
      setWeights({
        waterEfficiency: 20,
        climateResilience: 20,
        soilImprovement: 40,
        erosionProtection: 15,
        marketSuitability: 5
      });
    }
    if (preset === 'water') {
      setWeights({
        waterEfficiency: 45,
        climateResilience: 30,
        soilImprovement: 15,
        erosionProtection: 5,
        marketSuitability: 5
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111C15]">
            Explainable Crop Rotation Planner
          </h1>
          <p className="text-sm text-[#4A5D50]">
            Adjust priority weights to compare your existing rotation (Strategy A) against soil-restoring and climate-resilient strategies for {activeFarm.name}.
          </p>
        </div>
        {rotationComparison && (
          <button
            type="button"
            onClick={() => exportRotationCsv(activeFarm.name, rotationComparison)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#DCE3DC] bg-white text-xs font-semibold text-[#111C15] hover:bg-[#EDF2EC] whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Export Rotation CSV</span>
          </button>
        )}
      </div>

      {scenarioFeedback && (
        <div className="rounded-lg border border-[#1B4D3E]/30 bg-white px-4 py-2.5 text-xs font-medium text-[#1B4D3E]">
          {scenarioFeedback}
        </div>
      )}

      {/* Interactive Farmer Priority Weight Sliders + Radar Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-[#111C15]">Farmer Priority Weights</h2>
            <button
              type="button"
              onClick={() => applyPreset('balanced')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#1B4D3E] hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset('balanced')}
              className="px-2.5 py-1 rounded-md border border-[#DCE3DC] text-xs font-medium hover:bg-[#F6F8F5]"
            >
              Balanced
            </button>
            <button
              type="button"
              onClick={() => applyPreset('soil')}
              className="px-2.5 py-1 rounded-md border border-[#DCE3DC] text-xs font-medium hover:bg-[#F6F8F5]"
            >
              Prioritize Soil Health
            </button>
            <button
              type="button"
              onClick={() => applyPreset('water')}
              className="px-2.5 py-1 rounded-md border border-[#DCE3DC] text-xs font-medium hover:bg-[#F6F8F5]"
            >
              Prioritize Water Saving
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {WEIGHT_LABELS.map(({ key, label }) => {
              const pct = totalWeightSum > 0 ? Math.round((weights[key] / totalWeightSum) * 100) : 20;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor={`weight-${key}`} className="font-medium text-[#111C15]">
                      {label}
                    </label>
                    <span className="font-mono-num text-[#4A5D50]">
                      {weights[key]} ({pct}% norm.)
                    </span>
                  </div>
                  <input
                    id={`weight-${key}`}
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={weights[key]}
                    onChange={(e) =>
                      setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                    }
                    className="w-full accent-[#1B4D3E]"
                  />
                </div>
              );
            })}
          </div>
          <div className="text-xs text-[#4A5D50] border-t border-[#DCE3DC] pt-3">
            {rotationComparison?.methodologyNote}
          </div>

          {canPersist && (
            <div className="border-t border-[#DCE3DC] pt-3 flex items-center gap-2">
              <input
                type="text"
                value={scenarioTitle}
                onChange={(e) => setScenarioTitle(e.target.value)}
                placeholder="Scenario title (optional)"
                className="flex-1 rounded-lg border border-[#DCE3DC] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]"
              />
              <button
                type="button"
                disabled={savingScenario}
                onClick={handleSaveScenario}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#143B2F] disabled:opacity-60 whitespace-nowrap"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>{savingScenario ? 'Saving...' : 'Save Scenario'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-7 rounded-xl border border-[#DCE3DC] bg-white p-5">
          <h2 className="font-display text-base font-semibold text-[#111C15] mb-1">
            Multi-Criteria Strategy Profile
          </h2>
          <p className="text-xs text-[#4A5D50] mb-3">Normalized 0–100 component scores across generated strategies</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="68%" margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <PolarGrid stroke="#DCE3DC" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#4A5D50' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name="Strategy A" dataKey="Strategy A" stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.2} />
                <Radar name="Strategy B" dataKey="Strategy B" stroke="#1B4D3E" fill="#1B4D3E" fillOpacity={0.25} />
                <Radar name="Strategy C" dataKey="Strategy C" stroke="#D97706" fill="#D97706" fillOpacity={0.2} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6ECE6" />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 10, fill: '#111C15' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#4A5D50' }} />
                <Tooltip />
                <Bar dataKey="score" name="Weighted Total Score" fill="#1B4D3E" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {strategies.map((st) => (
          <div key={st.id} className="rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#DCE3DC] pb-3">
              <div>
                <div className="text-xs font-semibold text-[#1B4D3E]">
                  {st.code} {st.isExistingBaseline ? '· Baseline Reference' : '· Recommended Alternative'}
                </div>
                <h3 className="font-display text-lg font-bold text-[#111C15]">{st.label}</h3>
                <p className="text-xs text-[#4A5D50] mt-0.5">{st.focus}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold font-mono-num text-[#111C15]">{st.totalScore}/100</div>
                <div className="text-[11px] text-[#4A5D50]">Weighted Score</div>
              </div>
            </div>

            <div className="rounded-lg bg-[#F6F8F5] border border-[#DCE3DC] p-3">
              <div className="text-xs font-semibold text-[#111C15] mb-1">Seasonal Crop Sequence</div>
              <div className="text-sm font-semibold text-[#1B4D3E]">{st.sequenceDisplay}</div>
              <div className="text-xs text-[#4A5D50] mt-1 font-mono-num">
                Water Demand: ~{st.annualWaterDemandMm} mm/yr · Net N Balance: {st.netNitrogenEffectKgHa > 0 ? '+' : ''}
                {st.netNitrogenEffectKgHa} kg/ha
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {[
                ['Water', st.componentScores.waterEfficiency],
                ['Climate', st.componentScores.climateResilience],
                ['Soil', st.componentScores.soilImprovement],
                ['Erosion', st.componentScores.erosionProtection],
                ['Market', st.componentScores.marketSuitability]
              ].map(([lbl, val]) => (
                <div key={String(lbl)} className="rounded-lg border border-[#DCE3DC] py-2 px-1">
                  <div className="text-[11px] text-[#4A5D50]">{lbl}</div>
                  <div className="font-mono-num font-bold text-[#111C15]">{val}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="font-semibold text-[#16A34A] mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Expected Agronomic Benefits</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[#4A5D50]">
                  {st.expectedBenefits.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="font-semibold text-[#D97706] mb-1">Trade-Offs & Constraints</div>
                <ul className="list-disc pl-4 space-y-1 text-[#4A5D50]">
                  {st.tradeOffs.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="font-semibold text-[#111C15] mb-1">Uncertainties & Expert Validation</div>
                <ul className="list-disc pl-4 space-y-1 text-[#4A5D50]">
                  {st.uncertainties.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                  {st.expertValidationNotes.map((ev, i) => (
                    <li key={`ev-${i}`}>{ev}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Saved Rotation Scenarios */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-display text-base font-semibold text-[#111C15]">
            <History className="w-4 h-4 text-[#1B4D3E]" />
            <span>Saved Rotation Scenarios</span>
          </div>
          {!canPersist && (
            <span className="text-xs text-[#4A5D50]">
              Sign in and select a registered farm parcel to save custom priority scenarios.
            </span>
          )}
        </div>

        {canPersist && savedScenariosQuery.isLoading && (
          <p className="text-xs text-[#4A5D50]">Loading saved scenarios...</p>
        )}

        {canPersist && !savedScenariosQuery.isLoading && (savedScenariosQuery.data?.length ?? 0) === 0 && (
          <p className="text-xs text-[#4A5D50]">No saved rotation scenarios yet for {activeFarm.name}.</p>
        )}

        {canPersist && (savedScenariosQuery.data?.length ?? 0) > 0 && (
          <div className="divide-y divide-[#DCE3DC]">
            {savedScenariosQuery.data!.map((sc) => (
              <div key={sc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-[#111C15]">{sc.title}</div>
                  <div className="text-[#4A5D50] font-mono-num">
                    Saved {new Date(sc.createdAt).toLocaleString()} · Top:{' '}
                    {sc.strategies[0] ? `${sc.strategies[0].code} (${sc.strategies[0].totalScore}/100)` : 'N/A'}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setWeights(sc.weights)}
                    className="font-semibold text-[#1B4D3E] hover:underline"
                  >
                    Load Weights
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteScenario(sc.id)}
                    className="inline-flex items-center gap-1 text-[#DC2626] hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
