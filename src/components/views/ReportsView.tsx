import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileText, History, Trash2 } from 'lucide-react';
import { DEMO_FARM_ID } from '../../../shared/data/demoFarm';
import type { FarmReportPayload } from '../../../shared/types/agri';
import { useAuth } from '../../contexts/AuthContext';
import { useFarms } from '../../contexts/FarmContext';
import { apiClient } from '../../services/api';
import { downloadFarmReportPdf, exportClimateCsv, exportRotationCsv } from '../../utils/exportReports';

export function ReportsView() {
  const { user } = useAuth();
  const { activeFarm, weights, nasaPower, assessment, suitability, rotationComparison } = useFarms();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [reportPreview, setReportPreview] = useState<(FarmReportPayload & { persisted?: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canListReports = Boolean(user);
  const filterFarmId = activeFarm.id === DEMO_FARM_ID ? undefined : activeFarm.id;

  const savedReportsQuery = useQuery({
    queryKey: ['reports', user?.uid ?? 'anon', filterFarmId ?? 'all'],
    enabled: canListReports,
    queryFn: () => apiClient.getReports(filterFarmId)
  });

  const handleGeneratePdf = async () => {
    setGenerating(true);
    setError(null);
    try {
      const payload = await apiClient.generateReport(activeFarm, weights);
      setReportPreview(payload);
      downloadFarmReportPdf(payload);
      if (payload.persisted && user) {
        await queryClient.invalidateQueries({ queryKey: ['reports', user.uid] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      await apiClient.deleteReport(id);
      if (user) {
        await queryClient.invalidateQueries({ queryKey: ['reports', user.uid] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete report');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111C15]">
            Scientific Reports & Data Exports
          </h1>
          <p className="text-sm text-[#4A5D50]">
            Download complete agricultural decision-support PDF reports and raw CSV datasets for Krishi Vigyan Kendra (KVK) consultation.
          </p>
        </div>
        <button
          type="button"
          disabled={generating}
          onClick={handleGeneratePdf}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-white text-sm font-semibold hover:bg-[#143B2F] disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{generating ? 'Generating PDF...' : 'Download PDF Report'}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-[#DC2626]/30 bg-white p-4 text-xs text-[#DC2626]">
          {error}
        </div>
      )}

      {/* CSV & PDF Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-xl border border-[#DCE3DC] bg-white p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="w-9 h-9 rounded-lg bg-[#1B4D3E]/10 text-[#1B4D3E] flex items-center justify-center mb-3">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="font-display text-base font-semibold text-[#111C15]">Full Farm Advisory PDF</h2>
            <p className="text-xs text-[#4A5D50] mt-1">
              Includes farm boundary metadata, NASA datasets, environmental risk methodology, soil gaps, crop suitability, and rotation comparisons.
            </p>
          </div>
          <button
            type="button"
            disabled={generating}
            onClick={handleGeneratePdf}
            className="w-full py-2 rounded-lg bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#143B2F]"
          >
            Generate & Download PDF
          </button>
        </div>

        <div className="rounded-xl border border-[#DCE3DC] bg-white p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="w-9 h-9 rounded-lg bg-[#1B4D3E]/10 text-[#1B4D3E] flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h2 className="font-display text-base font-semibold text-[#111C15]">NASA POWER Climate CSV</h2>
            <p className="text-xs text-[#4A5D50] mt-1">
              Monthly mean/max/min temperatures, precipitation, solar radiation, relative humidity, and climatology anomalies.
            </p>
          </div>
          <button
            type="button"
            disabled={!nasaPower}
            onClick={() => nasaPower && exportClimateCsv(activeFarm.name, nasaPower)}
            className="w-full py-2 rounded-lg border border-[#DCE3DC] text-xs font-semibold text-[#111C15] hover:bg-[#F6F8F5] disabled:opacity-50"
          >
            Export Climate Time-Series CSV
          </button>
        </div>

        <div className="rounded-xl border border-[#DCE3DC] bg-white p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="w-9 h-9 rounded-lg bg-[#1B4D3E]/10 text-[#1B4D3E] flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h2 className="font-display text-base font-semibold text-[#111C15]">Rotation Comparison CSV</h2>
            <p className="text-xs text-[#4A5D50] mt-1">
              All generated rotation sequences with normalized 0–100 component scores, water demand, and net nitrogen balances.
            </p>
          </div>
          <button
            type="button"
            disabled={!rotationComparison}
            onClick={() => rotationComparison && exportRotationCsv(activeFarm.name, rotationComparison)}
            className="w-full py-2 rounded-lg border border-[#DCE3DC] text-xs font-semibold text-[#111C15] hover:bg-[#F6F8F5] disabled:opacity-50"
          >
            Export Rotation Comparison CSV
          </button>
        </div>
      </div>

      {/* Live Report Contents Preview */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white p-6 space-y-5">
        <div className="border-b border-[#DCE3DC] pb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[#111C15]">
              Report Contents Preview · {activeFarm.name}
            </h2>
            <p className="text-xs text-[#4A5D50]">
              {reportPreview
                ? `Last generated at ${new Date(reportPreview.generatedAt).toLocaleString()}${
                    reportPreview.persisted ? ' · Saved to PostgreSQL' : ' · Demo export (not persisted)'
                  }`
                : 'Ready to export with live farm and NASA POWER metrics'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-2">
            <h3 className="font-semibold text-[#111C15] text-sm">1–6. Farm, NASA & Soil Summary</h3>
            <p className="text-[#4A5D50]">
              <strong>Location:</strong> {activeFarm.district}, {activeFarm.state} ({activeFarm.latitude.toFixed(4)}°N, {activeFarm.longitude.toFixed(4)}°E)
            </p>
            <p className="text-[#4A5D50]">
              <strong>Environmental Risk:</strong> {assessment?.overallRiskLevel ?? '--'} ({assessment?.overallRiskScore ?? '--'}/100) · Completeness {assessment?.dataCompletenessPct ?? '--'}%
            </p>
            <p className="text-[#4A5D50]">
              <strong>Top Suitable Crops:</strong> {suitability.slice(0, 4).map((c) => `${c.cropName} (${c.score})`).join(', ')}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-[#111C15] text-sm">7–13. Rotation Strategies & Validation</h3>
            <ul className="space-y-1 text-[#4A5D50]">
              {(rotationComparison?.strategies ?? []).map((st) => (
                <li key={st.id}>
                  <strong>{st.code}:</strong> {st.sequenceDisplay} ({st.totalScore}/100)
                </li>
              ))}
            </ul>
            <p className="text-[#4A5D50] pt-1">
              <strong>Data Gaps Noted:</strong> {assessment?.missingInputs.join('; ') || 'None'}
            </p>
          </div>
        </div>
      </div>

      {/* Persisted Report Archive */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-display text-base font-semibold text-[#111C15]">
            <History className="w-4 h-4 text-[#1B4D3E]" />
            <span>Saved Decision Reports</span>
          </div>
          {!canListReports && (
            <span className="text-xs text-[#4A5D50]">
              PDF downloads work in demo mode. Sign in with Google to archive reports on registered farms.
            </span>
          )}
        </div>

        {canListReports && savedReportsQuery.isLoading && (
          <p className="text-xs text-[#4A5D50]">Loading saved reports...</p>
        )}

        {canListReports && !savedReportsQuery.isLoading && (savedReportsQuery.data?.length ?? 0) === 0 && (
          <p className="text-xs text-[#4A5D50]">
            No archived reports found yet. Generating a PDF report for a registered user farm saves it automatically via the backend API.
          </p>
        )}

        {canListReports && (savedReportsQuery.data?.length ?? 0) > 0 && (
          <div className="divide-y divide-[#DCE3DC]">
            {savedReportsQuery.data!.map((rep) => (
              <div key={rep.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-[#111C15]">{rep.title}</div>
                  {rep.recommendedStrategy && (
                    <div className="text-[#1B4D3E] font-medium">Recommended: {rep.recommendedStrategy}</div>
                  )}
                  <div className="text-[#4A5D50]">
                    {new Date(rep.createdAt).toLocaleString()} {rep.summary ? `· ${rep.summary}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteReport(rep.id)}
                  className="inline-flex items-center gap-1 text-[#DC2626] hover:underline self-start sm:self-center shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
