import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus, History, Info, ShieldAlert, Trash2 } from 'lucide-react';
import { DEMO_FARM_ID } from '../../../shared/data/demoFarm';
import { useAuth } from '../../contexts/AuthContext';
import { useFarms } from '../../contexts/FarmContext';
import { apiClient } from '../../services/api';
import { LoadingCardGrid, RiskIndicator } from '../common/StatusAndError';

export function EnvironmentalRiskView() {
  const { user } = useAuth();
  const { activeFarm, assessment, isLoadingAnalysis } = useFarms();
  const queryClient = useQueryClient();
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshotFeedback, setSnapshotFeedback] = useState<string | null>(null);

  const canPersist = Boolean(user && activeFarm.id !== DEMO_FARM_ID);

  const savedQuery = useQuery({
    queryKey: ['assessments', user?.uid ?? 'anon', activeFarm.id],
    enabled: canPersist,
    queryFn: () => apiClient.getAssessments(activeFarm.id)
  });

  const handleSaveSnapshot = async () => {
    if (!canPersist || savingSnapshot) return;
    setSavingSnapshot(true);
    setSnapshotFeedback(null);
    try {
      await apiClient.saveAssessment(activeFarm.id);
      await queryClient.invalidateQueries({ queryKey: ['assessments', user?.uid ?? 'anon', activeFarm.id] });
      setSnapshotFeedback('Environmental risk snapshot saved to PostgreSQL.');
    } catch (err) {
      setSnapshotFeedback(err instanceof Error ? err.message : 'Unable to save assessment snapshot.');
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    try {
      await apiClient.deleteAssessment(id);
      await queryClient.invalidateQueries({ queryKey: ['assessments', user?.uid ?? 'anon', activeFarm.id] });
    } catch (err) {
      setSnapshotFeedback(err instanceof Error ? err.message : 'Unable to delete assessment snapshot.');
    }
  };

  if (isLoadingAnalysis && !assessment) {
    return <LoadingCardGrid rows={4} />;
  }

  if (!assessment) {
    return <div className="text-sm text-[#4A5D50]">No environmental risk assessment available.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111C15]">
            Environmental Risk & Vulnerability Engine
          </h1>
          <p className="text-sm text-[#4A5D50]">
            Transparent risk scoring for {activeFarm.name} with full methodology, input provenance, and missing-data disclosure.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canPersist && (
            <button
              type="button"
              disabled={savingSnapshot}
              onClick={handleSaveSnapshot}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#143B2F] disabled:opacity-60 whitespace-nowrap"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>{savingSnapshot ? 'Saving...' : 'Save Snapshot'}</span>
            </button>
          )}
          <div className="rounded-xl border border-[#DCE3DC] bg-white px-4 py-3 flex items-center gap-4">
            <div>
              <div className="text-xs text-[#4A5D50]">Composite Risk</div>
              <div className="text-xl font-bold font-mono-num text-[#111C15]">
                {assessment.overallRiskScore}/100
              </div>
            </div>
            <RiskIndicator level={assessment.overallRiskLevel} />
          </div>
        </div>
      </div>

      {snapshotFeedback && (
        <div className="rounded-lg border border-[#1B4D3E]/30 bg-white px-4 py-2.5 text-xs font-medium text-[#1B4D3E]">
          {snapshotFeedback}
        </div>
      )}

      {/* Key Environmental Indicators */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white p-5">
        <h2 className="font-display text-base font-semibold text-[#111C15] mb-3">
          Calculated Environmental Indicators
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="border border-[#DCE3DC] rounded-lg p-3.5 bg-[#F6F8F5]">
            <div className="text-[#4A5D50]">Estimated Moisture Balance (P - ET0)</div>
            <div className="text-lg font-bold font-mono-num text-[#111C15] mt-1">
              {assessment.indicators.estimatedMoistureBalanceMm} mm
            </div>
          </div>
          <div className="border border-[#DCE3DC] rounded-lg p-3.5 bg-[#F6F8F5]">
            <div className="text-[#4A5D50]">Dry-Spell & Bare-Field Exposure</div>
            <div className="text-sm font-semibold text-[#111C15] mt-1">
              {assessment.indicators.drySpellSeverity}
            </div>
            <div className="text-[#4A5D50] mt-0.5">{assessment.indicators.bareFieldRiskWindow}</div>
          </div>
          <div className="border border-[#DCE3DC] rounded-lg p-3.5 bg-[#F6F8F5]">
            <div className="text-[#4A5D50]">Soil Organic Carbon Status</div>
            <div className="text-sm font-semibold text-[#111C15] mt-1">
              {assessment.indicators.soilOrganicCarbonStatus}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Detailed Risk Metrics with Methodology */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {assessment.riskMetrics.map((metric) => (
          <div key={metric.id} className="rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-[#111C15]">{metric.name}</h3>
                <div className="text-xs text-[#4A5D50] mt-0.5">
                  Completeness: <span className="font-mono-num">{metric.dataCompletenessPct}%</span> · Period: {metric.referencePeriod}
                </div>
              </div>
              <RiskIndicator level={metric.level} score={metric.score} />
            </div>

            <div className="w-full h-2 rounded-full bg-[#EDF2EC] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${metric.score}%`,
                  backgroundColor:
                    metric.level === 'Critical'
                      ? '#DC2626'
                      : metric.level === 'High'
                      ? '#EA580C'
                      : metric.level === 'Moderate'
                      ? '#D97706'
                      : '#16A34A'
                }}
              />
            </div>

            <p className="text-sm text-[#111C15]">{metric.interpretation}</p>

            <div className="border-t border-[#DCE3DC] pt-3 space-y-1.5 text-xs text-[#4A5D50]">
              <div>
                <strong className="text-[#111C15]">Methodology:</strong> {metric.methodology}
              </div>
              <div>
                <strong className="text-[#111C15]">Inputs:</strong> {metric.inputVariables.join(', ')}
              </div>
              <div>
                <strong className="text-[#111C15]">Source:</strong> {metric.dataSource}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Missing Inputs & Scientific Caveats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-3">
          <div className="flex items-center gap-2 font-display text-base font-semibold text-[#111C15]">
            <ShieldAlert className="w-4 h-4 text-[#D97706]" />
            <span>Missing Inputs & Data Gaps</span>
          </div>
          {assessment.missingInputs.length === 0 ? (
            <p className="text-sm text-[#16A34A]">All primary soil and climate variables are populated.</p>
          ) : (
            <ul className="space-y-2 text-xs text-[#4A5D50] list-disc pl-4">
              {assessment.missingInputs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-3">
          <div className="flex items-center gap-2 font-display text-base font-semibold text-[#111C15]">
            <Info className="w-4 h-4 text-[#1B4D3E]" />
            <span>Scientific Transparency & Caveats</span>
          </div>
          <ul className="space-y-2 text-xs text-[#4A5D50] list-disc pl-4">
            {assessment.scientificCaveats.map((cav, idx) => (
              <li key={idx}>{cav}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Persisted Assessment History */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-display text-base font-semibold text-[#111C15]">
            <History className="w-4 h-4 text-[#1B4D3E]" />
            <span>Saved Assessment History</span>
          </div>
          {!canPersist && (
            <span className="text-xs text-[#4A5D50]">
              Sign in and select a registered farm parcel to persist snapshots.
            </span>
          )}
        </div>

        {canPersist && savedQuery.isLoading && (
          <p className="text-xs text-[#4A5D50]">Loading saved assessment snapshots...</p>
        )}

        {canPersist && !savedQuery.isLoading && (savedQuery.data?.length ?? 0) === 0 && (
          <p className="text-xs text-[#4A5D50]">
            No assessment snapshots saved yet for {activeFarm.name}. Click &ldquo;Save Snapshot&rdquo; above to record a baseline.
          </p>
        )}

        {canPersist && (savedQuery.data?.length ?? 0) > 0 && (
          <div className="divide-y divide-[#DCE3DC]">
            {savedQuery.data!.map((snap) => (
              <div key={snap.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <RiskIndicator level={snap.overallRiskLevel} score={snap.overallRiskScore} />
                    <span className="font-mono-num text-[#4A5D50]">
                      Completeness {snap.dataCompleteness}% · {new Date(snap.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {snap.summary && <p className="text-[#4A5D50]">{snap.summary}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSnapshot(snap.id)}
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
