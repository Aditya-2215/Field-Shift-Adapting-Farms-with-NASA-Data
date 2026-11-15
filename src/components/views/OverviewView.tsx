import { ArrowRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useFarms } from '../../contexts/FarmContext';
import { LoadingCardGrid, RiskIndicator, SuitabilityIndicator } from '../common/StatusAndError';

export function OverviewView() {
  const navigate = useNavigate();
  const {
    farms,
    activeFarm,
    nasaPower,
    datasets,
    assessment,
    suitability,
    rotationComparison,
    isLoadingAnalysis,
    analysisError,
    refetchAnalysis
  } = useFarms();

  if (isLoadingAnalysis && !nasaPower) {
    return <LoadingCardGrid rows={6} />;
  }

  if (analysisError && !nasaPower) {
    return (
      <div className="rounded-xl border border-[#DC2626]/30 bg-white p-6">
        <h2 className="text-lg font-semibold text-[#DC2626] mb-1">Analysis Unavailable</h2>
        <p className="text-sm text-[#4A5D50] mb-4">{analysisError}</p>
        <button
          type="button"
          onClick={refetchAnalysis}
          className="px-4 py-2 rounded-lg bg-[#1B4D3E] text-white text-sm font-medium hover:bg-[#143B2F]"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  const s = nasaPower?.summary;
  const connectedDatasetsCount = datasets.filter((d) => d.status === 'Connected').length;
  const topRotations = rotationComparison?.strategies ?? [];
  const bestAlt = [...topRotations]
    .filter((st) => !st.isExistingBaseline)
    .sort((a, b) => b.totalScore - a.totalScore)[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-[#4A5D50] mb-1">
            {activeFarm.district}, {activeFarm.state}, {activeFarm.country} · {activeFarm.area} {activeFarm.areaUnit} ·{' '}
            {nasaPower?.isDemonstrationFallback ? 'DEMONSTRATION DATA' : 'Live NASA POWER'}
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#111C15]">
            {activeFarm.name}
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={refetchAnalysis}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#DCE3DC] bg-white text-xs font-semibold text-[#111C15] hover:bg-[#EDF2EC] whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh NASA Data</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/rotation')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#143B2F] whitespace-nowrap"
          >
            <span>Open Rotation Planner</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {nasaPower?.isDemonstrationFallback && (
        <div className="rounded-xl border border-[#D97706]/40 bg-[#FEF3C7]/40 px-4 py-3 text-xs text-[#92400E]">
          <strong>DEMONSTRATION DATA NOTICE:</strong> {nasaPower.statusMessage}
        </div>
      )}

      {/* 6 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="rounded-xl border border-[#DCE3DC] bg-white p-4">
          <div className="text-xs text-[#4A5D50] mb-1">Farms Monitored</div>
          <div className="text-2xl font-bold font-mono-num text-[#111C15]">{farms.length}</div>
          <div className="text-xs text-[#4A5D50] mt-1">Active parcel selected</div>
        </div>

        <div className="rounded-xl border border-[#DCE3DC] bg-white p-4">
          <div className="text-xs text-[#4A5D50] mb-1">Environmental Risk</div>
          <div className="text-2xl font-bold font-mono-num text-[#111C15]">
            {assessment?.overallRiskScore ?? '--'}/100
          </div>
          <div className="mt-1">
            {assessment && <RiskIndicator level={assessment.overallRiskLevel} />}
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE3DC] bg-white p-4">
          <div className="text-xs text-[#4A5D50] mb-1">Rainfall Anomaly</div>
          <div className="text-2xl font-bold font-mono-num text-[#111C15]">
            {s ? `${s.rainfallAnomalyPct > 0 ? '+' : ''}${s.rainfallAnomalyPct}%` : '--'}
          </div>
          <div className="text-xs text-[#4A5D50] mt-1 font-mono-num">
            {s ? `${s.totalPrecipitationMm} mm total` : 'No data'}
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE3DC] bg-white p-4">
          <div className="text-xs text-[#4A5D50] mb-1">Temperature Anomaly</div>
          <div className="text-2xl font-bold font-mono-num text-[#111C15]">
            {s ? `${s.tempAnomalyC > 0 ? '+' : ''}${s.tempAnomalyC}°C` : '--'}
          </div>
          <div className="text-xs text-[#4A5D50] mt-1 font-mono-num">
            {s ? `${s.heatStressDays} days >= 38°C` : 'No data'}
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE3DC] bg-white p-4">
          <div className="text-xs text-[#4A5D50] whitespace-nowrap truncate">Moisture Balance</div>
          <div className="text-2xl font-bold font-mono-num text-[#111C15]">
            {assessment ? `${assessment.indicators.estimatedMoistureBalanceMm} mm` : '--'}
          </div>
          <div className="text-xs text-[#4A5D50] mt-1">
            {datasets.find((d) => d.id === 'smap')?.status === 'Authentication required'
              ? 'P - ET0 proxy (SMAP off)'
              : 'Observed P - ET0'}
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE3DC] bg-white p-4">
          <div className="text-xs text-[#4A5D50] mb-1">Data Completeness</div>
          <div className="text-2xl font-bold font-mono-num text-[#111C15]">
            {assessment ? `${assessment.dataCompletenessPct}%` : '--'}
          </div>
          <div className="text-xs text-[#4A5D50] mt-1">
            {connectedDatasetsCount}/{datasets.length} NASA adapters active
          </div>
        </div>
      </div>

      {/* A. Environmental Overview Chart + B. Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-[#DCE3DC] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#111C15]">
                Monthly Precipitation & Mean Temperature
              </h2>
              <p className="text-xs text-[#4A5D50]">
                {nasaPower?.source} · {nasaPower?.spatialResolution}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/climate')}
              className="text-xs font-semibold text-[#1B4D3E] hover:underline"
            >
              Full Climate Analytics
            </button>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={nasaPower?.monthlySeries ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6ECE6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#4A5D50' }} />
                <YAxis yAxisId="rain" tick={{ fontSize: 11, fill: '#4A5D50' }} unit="mm" />
                <YAxis yAxisId="temp" orientation="right" tick={{ fontSize: 11, fill: '#4A5D50' }} unit="°C" />
                <Tooltip />
                <Bar yAxisId="rain" dataKey="precipitationMm" name="Rainfall (mm)" fill="#2E7D32" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="avgTempC"
                  name="Mean Temp (°C)"
                  stroke="#D97706"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-xl border border-[#DCE3DC] bg-white p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-semibold text-[#111C15]">Environmental Alerts</h2>
              <button
                type="button"
                onClick={() => navigate('/app/risk')}
                className="text-xs font-semibold text-[#1B4D3E] hover:underline"
              >
                Risk Details
              </button>
            </div>
            <div className="divide-y divide-[#DCE3DC]">
              {(assessment?.alerts ?? []).slice(0, 4).map((al) => (
                <div key={al.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-[#111C15]">{al.title}</span>
                    <RiskIndicator level={al.severity} />
                  </div>
                  <p className="text-xs text-[#4A5D50] leading-relaxed">{al.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-[#DCE3DC] text-xs text-[#4A5D50]">
            Vegetation health (MODIS/Landsat NDVI) requires Earthdata or GEE configuration — view status in Satellite Intelligence.
          </div>
        </div>
      </div>

      {/* C. Crop Suitability & D. Rotation Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-xl border border-[#DCE3DC] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#111C15]">Top Suitable Crops</h2>
              <p className="text-xs text-[#4A5D50]">Evaluated across soil pH, moisture, and seasonal temperature</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/crops')}
              className="text-xs font-semibold text-[#1B4D3E] hover:underline"
            >
              All 17 Crops
            </button>
          </div>
          <div className="h-56 w-full mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={suitability.slice(0, 6)} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6ECE6" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#4A5D50' }} />
                <YAxis type="category" dataKey="cropName" width={90} tick={{ fontSize: 11, fill: '#111C15' }} />
                <Tooltip />
                <Bar dataKey="score" name="Suitability Score" fill="#1B4D3E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="divide-y divide-[#DCE3DC] text-xs">
            {suitability.slice(0, 3).map((c) => (
              <div key={c.cropId} className="py-2 flex items-center justify-between gap-2">
                <span className="font-medium text-[#111C15]">
                  {c.cropName} · <span className="text-[#4A5D50]">{c.seasons.join('/')}</span>
                </span>
                <div className="flex items-center gap-3">
                  <SuitabilityIndicator classification={c.classification} />
                  <span className="font-mono-num font-semibold">{c.score}/100</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 rounded-xl border border-[#DCE3DC] bg-white p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-base font-semibold text-[#111C15]">Rotation Strategy Summary</h2>
                <p className="text-xs text-[#4A5D50]">Comparing existing baseline against alternative pathways</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/app/rotation')}
                className="text-xs font-semibold text-[#1B4D3E] hover:underline"
              >
                Adjust Weights
              </button>
            </div>

            <div className="divide-y divide-[#DCE3DC]">
              {topRotations.map((st) => (
                <div key={st.id} className="py-3 first:pt-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-sm font-semibold text-[#111C15]">
                      {st.code} · {st.label}
                    </div>
                    <div className="font-mono-num text-sm font-bold text-[#1B4D3E]">
                      {st.totalScore}/100
                    </div>
                  </div>
                  <div className="text-xs text-[#111C15] mb-1">{st.sequenceDisplay}</div>
                  <div className="text-xs text-[#4A5D50]">
                    Water: <span className="font-mono-num">{st.annualWaterDemandMm} mm</span> · Net N:{' '}
                    <span className="font-mono-num">{st.netNitrogenEffectKgHa} kg/ha</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {bestAlt && (
            <div className="mt-4 pt-3 border-t border-[#DCE3DC] text-xs text-[#4A5D50]">
              Top alternative under current priorities: <strong className="text-[#111C15]">{bestAlt.code}</strong> ({bestAlt.sequenceDisplay}). Validate locally before adoption.
            </div>
          )}
        </div>
      </div>

      {/* E. NASA Data Status */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#111C15]">NASA Data Integrations</h2>
            <p className="text-xs text-[#4A5D50]">Honest connectivity & spatial resolution status</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/satellite')}
            className="text-xs font-semibold text-[#1B4D3E] hover:underline"
          >
            Satellite Map & Setup
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {datasets.map((ds) => (
            <div key={ds.id} className="rounded-lg border border-[#DCE3DC] p-3 bg-[#F6F8F5]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-[#111C15]">{ds.shortName}</span>
                <span
                  className={`text-[11px] font-semibold ${
                    ds.status === 'Connected'
                      ? 'text-[#16A34A]'
                      : 'text-[#D97706]'
                  }`}
                >
                  {ds.status}
                </span>
              </div>
              <div className="text-[11px] text-[#4A5D50] font-mono-num">{ds.spatialResolution}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
