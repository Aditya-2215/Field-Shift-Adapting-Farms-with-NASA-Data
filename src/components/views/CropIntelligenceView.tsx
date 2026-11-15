import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CROP_KNOWLEDGE_BASE } from '../../../shared/data/crops';
import type { CropCategory } from '../../../shared/types/agri';
import { useFarms } from '../../contexts/FarmContext';
import { LoadingCardGrid, SuitabilityIndicator } from '../common/StatusAndError';

const CATEGORIES: ('All' | CropCategory)[] = ['All', 'Cereal', 'Pulse', 'Oilseed', 'Commercial & Tuber'];

export function CropIntelligenceView({ globalSearch }: { globalSearch: string }) {
  const { activeFarm, suitability, isLoadingAnalysis } = useFarms();
  const [category, setCategory] = useState<'All' | CropCategory>('All');
  const [selectedCropId, setSelectedCropId] = useState<string>('chickpea');

  const filtered = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return suitability.filter((c) => {
      const catMatch = category === 'All' || c.category === category;
      const searchMatch =
        !q || c.cropName.toLowerCase().includes(q) || c.scientificName.toLowerCase().includes(q);
      return catMatch && searchMatch;
    });
  }, [suitability, category, globalSearch]);

  const selectedSuit =
    suitability.find((c) => c.cropId === selectedCropId) ?? suitability[0];
  const selectedKnowledge = CROP_KNOWLEDGE_BASE.find((c) => c.id === selectedSuit?.cropId);

  if (isLoadingAnalysis && suitability.length === 0) {
    return <LoadingCardGrid rows={3} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111C15]">
            Crop Intelligence & Suitability Matrix
          </h1>
          <p className="text-sm text-[#4A5D50]">
            Deterministic 0–100 scoring across 17 representative Indian crops for {activeFarm.name}. Not an unvalidated ML prediction.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-white border border-[#DCE3DC]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                category === cat ? 'bg-[#1B4D3E] text-white' : 'text-[#4A5D50] hover:text-[#111C15]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Chart + Selected Crop Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-[#DCE3DC] bg-white p-5">
          <h2 className="font-display text-base font-semibold text-[#111C15] mb-1">
            Suitability Ranking ({filtered.length} crops)
          </h2>
          <p className="text-xs text-[#4A5D50] mb-4">Click any crop in the table below to inspect agronomic evidence</p>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filtered.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6ECE6" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#4A5D50' }} />
                <YAxis type="category" dataKey="cropName" width={95} tick={{ fontSize: 11, fill: '#111C15' }} />
                <Tooltip />
                <Bar dataKey="score" name="Suitability Score" fill="#1B4D3E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {selectedSuit && selectedKnowledge && (
          <div className="lg:col-span-5 rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#DCE3DC] pb-3">
              <div>
                <div className="text-xs text-[#4A5D50]">
                  {selectedKnowledge.category} · {selectedKnowledge.seasons.join(' / ')} ·{' '}
                  {selectedKnowledge.durationDays.min}–{selectedKnowledge.durationDays.max} days
                </div>
                <h2 className="font-display text-xl font-bold text-[#111C15] mt-0.5">
                  {selectedKnowledge.name}{' '}
                  <span className="text-sm font-normal italic text-[#4A5D50]">
                    ({selectedKnowledge.scientificName})
                  </span>
                </h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono-num text-[#111C15]">{selectedSuit.score}/100</div>
                <SuitabilityIndicator classification={selectedSuit.classification} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-[#DCE3DC] p-2.5 bg-[#F6F8F5]">
                <span className="text-[#4A5D50]">Soil Fit</span>
                <div className="font-mono-num font-bold text-[#111C15]">{selectedSuit.breakdown.soilCompatibility}/100</div>
              </div>
              <div className="rounded-lg border border-[#DCE3DC] p-2.5 bg-[#F6F8F5]">
                <span className="text-[#4A5D50]">Climate Fit</span>
                <div className="font-mono-num font-bold text-[#111C15]">{selectedSuit.breakdown.climateCompatibility}/100</div>
              </div>
              <div className="rounded-lg border border-[#DCE3DC] p-2.5 bg-[#F6F8F5]">
                <span className="text-[#4A5D50]">Water Fit</span>
                <div className="font-mono-num font-bold text-[#111C15]">{selectedSuit.breakdown.waterCompatibility}/100</div>
              </div>
              <div className="rounded-lg border border-[#DCE3DC] p-2.5 bg-[#F6F8F5]">
                <span className="text-[#4A5D50]">Nutrient Fit</span>
                <div className="font-mono-num font-bold text-[#111C15]">{selectedSuit.breakdown.nutrientCompatibility}/100</div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              {selectedSuit.supportingEvidence.length > 0 && (
                <div>
                  <div className="font-semibold text-[#16A34A] mb-1">Supporting Evidence</div>
                  <ul className="list-disc pl-4 space-y-1 text-[#4A5D50]">
                    {selectedSuit.supportingEvidence.map((ev, i) => (
                      <li key={i}>{ev}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedSuit.majorLimitations.length > 0 && (
                <div>
                  <div className="font-semibold text-[#D97706] mb-1">Major Limitations</div>
                  <ul className="list-disc pl-4 space-y-1 text-[#4A5D50]">
                    {selectedSuit.majorLimitations.map((lim, i) => (
                      <li key={i}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedSuit.missingInputs.length > 0 && (
                <div className="text-[#DC2626]">
                  <strong>Missing Inputs:</strong> {selectedSuit.missingInputs.join(', ')}
                </div>
              )}
            </div>

            <div className="border-t border-[#DCE3DC] pt-3 text-xs text-[#4A5D50] space-y-1">
              <div>
                <strong className="text-[#111C15]">Nitrogen Fixation / Demand:</strong> Fixes{' '}
                {selectedKnowledge.nitrogenFixingKgHa} kg/ha · Demands {selectedKnowledge.nitrogenDemandKgHa} kg/ha
              </div>
              <div>
                <strong className="text-[#111C15]">Root Depth & Protection:</strong> {selectedKnowledge.rootDepth} roots ·{' '}
                {selectedKnowledge.erosionProtection} erosion protection
              </div>
              <div>
                <strong className="text-[#111C15]">Reference:</strong> {selectedKnowledge.sourceCitation}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full Crop Table */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F6F8F5] border-b border-[#DCE3DC] text-[#4A5D50] font-semibold">
                <th className="py-3 px-4">Crop</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Seasons</th>
                <th className="py-3 px-4 text-right">Score</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Primary Factor</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE3DC]">
              {filtered.map((crop) => (
                <tr
                  key={crop.cropId}
                  className={selectedCropId === crop.cropId ? 'bg-[#1B4D3E]/5' : 'hover:bg-[#F6F8F5]'}
                >
                  <td className="py-3 px-4 font-semibold text-[#111C15]">{crop.cropName}</td>
                  <td className="py-3 px-4 text-[#4A5D50]">{crop.category}</td>
                  <td className="py-3 px-4 text-[#4A5D50]">{crop.seasons.join(', ')}</td>
                  <td className="py-3 px-4 text-right font-mono-num font-bold text-[#111C15]">{crop.score}/100</td>
                  <td className="py-3 px-4">
                    <SuitabilityIndicator classification={crop.classification} />
                  </td>
                  <td className="py-3 px-4 text-[#4A5D50] max-w-xs truncate">
                    {crop.majorLimitations[0] || crop.supportingEvidence[0] || 'Moderate fit'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedCropId(crop.cropId)}
                      className="text-xs font-semibold text-[#1B4D3E] hover:underline whitespace-nowrap"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
