import { Download } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useFarms } from '../../contexts/FarmContext';
import { exportClimateCsv } from '../../utils/exportReports';
import { LoadingCardGrid } from '../common/StatusAndError';

export function ClimateAnalyticsView() {
  const { activeFarm, nasaPower, isLoadingAnalysis } = useFarms();

  if (isLoadingAnalysis && !nasaPower) {
    return <LoadingCardGrid rows={3} />;
  }

  if (!nasaPower) {
    return <div className="text-sm text-[#4A5D50]">No climate data loaded yet.</div>;
  }

  const s = nasaPower.summary;
  const seasonalData = [
    { season: 'Kharif (Jun–Oct)', rainfallMm: s.kharifRainfallMm },
    { season: 'Rabi (Nov–Mar)', rainfallMm: s.rabiRainfallMm },
    { season: 'Zaid (Apr–May)', rainfallMm: s.zaidRainfallMm }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-[#4A5D50] mb-1">
            {nasaPower.source} · {nasaPower.startDate} to {nasaPower.endDate} ·{' '}
            {nasaPower.isDemonstrationFallback ? 'DEMONSTRATION DATA' : 'Live Observations'}
          </p>
          <h1 className="font-display text-2xl font-bold text-[#111C15]">
            NASA POWER Climate Analytics
          </h1>
        </div>
        <button
          type="button"
          onClick={() => exportClimateCsv(activeFarm.name, nasaPower)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#DCE3DC] bg-white text-xs font-semibold text-[#111C15] hover:bg-[#EDF2EC] whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export Climate CSV</span>
        </button>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#DCE3DC] bg-white p-4">
          <div className="text-xs text-[#4A5D50]">Mean / Max / Min Temp</div>
          <div className="text-xl font-bold font-mono-num text-[#111C15] mt-1">
            {s.meanTempC}°C
          </div>
          <div className="text-xs text-[#4A5D50] font-mono-num mt-0.5">
            Max {s.maxTempC}°C · Min {s.minTempC}°C
          </div>
        </div>
        <div className="rounded-xl border border-[#DCE3DC] bg-white p-4">
          <div className="text-xs text-[#4A5D50]">Annual Rainfall & Departure</div>
          <div className="text-xl font-bold font-mono-num text-[#111C15] mt-1">
            {s.totalPrecipitationMm} mm
          </div>
          <div className="text-xs text-[#4A5D50] font-mono-num mt-0.5">
            {s.rainfallAnomalyPct > 0 ? '+' : ''}{s.rainfallAnomalyPct}% vs 20-yr baseline
          </div>
        </div>
        <div className="rounded-xl border border-[#DCE3DC] bg-white p-4">
          <div className="text-xs text-[#4A5D50]">Dry Days / Extreme Rain</div>
          <div className="text-xl font-bold font-mono-num text-[#111C15] mt-1">
            {s.dryDaysCount} / {s.extremeRainDaysCount}
          </div>
          <div className="text-xs text-[#4A5D50] mt-0.5">&lt;1mm dry days · &gt;=50mm storms</div>
        </div>
        <div className="rounded-xl border border-[#DCE3DC] bg-white p-4">
          <div className="text-xs text-[#4A5D50]">Mean RH / Solar Radiation</div>
          <div className="text-xl font-bold font-mono-num text-[#111C15] mt-1">
            {s.meanHumidityPct}%
          </div>
          <div className="text-xs text-[#4A5D50] font-mono-num mt-0.5">
            {s.meanSolarRadiationMjM2} MJ/m²/day
          </div>
        </div>
      </div>

      {/* Temperature Envelope & Monthly Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#DCE3DC] bg-white p-5">
          <h2 className="font-display text-base font-semibold text-[#111C15] mb-1">
            Monthly Temperature Envelope (°C)
          </h2>
          <p className="text-xs text-[#4A5D50] mb-4">Daily maximum, mean, and minimum temperature progression</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={nasaPower.monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6ECE6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#4A5D50' }} />
                <YAxis tick={{ fontSize: 11, fill: '#4A5D50' }} unit="°C" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="maxTempC" name="Max Temp" stroke="#DC2626" strokeWidth={2} />
                <Line type="monotone" dataKey="avgTempC" name="Mean Temp" stroke="#1B4D3E" strokeWidth={2.5} />
                <Line type="monotone" dataKey="minTempC" name="Min Temp" stroke="#0284C7" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[#DCE3DC] bg-white p-5">
          <h2 className="font-display text-base font-semibold text-[#111C15] mb-1">
            Seasonal Rainfall Distribution & Departure
          </h2>
          <p className="text-xs text-[#4A5D50] mb-4">Kharif, Rabi, and Zaid cumulative rainfall allocation (mm)</p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seasonalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6ECE6" />
                <XAxis dataKey="season" tick={{ fontSize: 11, fill: '#4A5D50' }} />
                <YAxis tick={{ fontSize: 11, fill: '#4A5D50' }} unit="mm" />
                <Tooltip />
                <Bar dataKey="rainfallMm" name="Seasonal Rainfall (mm)" fill="#1B4D3E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Solar Radiation & Temperature Anomaly */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white p-5">
        <h2 className="font-display text-base font-semibold text-[#111C15] mb-1">
          Monthly Temperature Anomaly vs 20-Year Climatology (°C)
        </h2>
        <p className="text-xs text-[#4A5D50] mb-4">{s.baselineReference}</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={nasaPower.monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6ECE6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#4A5D50' }} />
              <YAxis tick={{ fontSize: 11, fill: '#4A5D50' }} unit="°C" />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="tempAnomalyC"
                name="Temp Anomaly (°C)"
                stroke="#D97706"
                fill="#D97706"
                fillOpacity={0.18}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
