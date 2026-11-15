import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FarmReportPayload, NasaPowerData, RotationComparison } from '../../shared/types/agri';

export function downloadFarmReportPdf(report: FarmReportPayload): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { farm, nasaPower, assessment, suitability, rotationComparison, datasets } = report;

  doc.setFillColor(27, 77, 62);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('AgriShift AI — Agricultural Decision-Support Report', 14, 13);
  doc.setFontSize(9.5);
  doc.text(
    `Generated: ${new Date(report.generatedAt).toLocaleString()} | NASA Space Apps Challenge 2026`,
    14,
    21
  );

  doc.setTextColor(17, 28, 21);
  let y = 36;

  // 1. Farm Profile
  doc.setFontSize(12);
  doc.text('1. Farm Details & Location', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Attribute', 'Value']],
    body: [
      ['Farm Name', farm.name],
      ['Administrative Location', `${farm.village ? `${farm.village}, ` : ''}${farm.district}, ${farm.state}, ${farm.country}`],
      ['Coordinates', `${farm.latitude.toFixed(4)}° N, ${farm.longitude.toFixed(4)}° E`],
      ['Parcel Area', `${farm.area} ${farm.areaUnit}`],
      ['Irrigation & Water', `${farm.irrigationAvailable ? farm.irrigationMethod || 'Irrigated' : 'Rainfed'} (${farm.waterAvailability})`],
      ['Current Cropping Pattern', farm.currentCrops.join(' → ')],
      ['GeoJSON Boundary', farm.boundaryGeoJson ? 'Polygon geometry recorded' : 'Point coordinates only']
    ],
    theme: 'grid',
    headStyles: { fillColor: [27, 77, 62] },
    styles: { fontSize: 8.5 }
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // 2. Soil Profile & Missing Inputs
  doc.setFontSize(12);
  doc.text('2. Soil Characteristics & Data Gaps', 14, y);
  y += 4;
  const soil = farm.soilProfile || {};
  autoTable(doc, {
    startY: y,
    head: [['Soil Indicator', 'Measured Value', 'Soil Indicator', 'Measured Value']],
    body: [
      ['Soil Type', soil.soilType || 'Not specified', 'pH', soil.ph != null ? String(soil.ph) : 'Missing'],
      ['Texture', soil.texture || 'Not specified', 'Organic Carbon (%)', soil.organicCarbonPct != null ? `${soil.organicCarbonPct}%` : 'Missing'],
      ['Nitrogen (kg/ha)', soil.nitrogenKgHa != null ? String(soil.nitrogenKgHa) : 'Missing', 'Phosphorus (kg/ha)', soil.phosphorusKgHa != null ? String(soil.phosphorusKgHa) : 'Missing'],
      ['Potassium (kg/ha)', soil.potassiumKgHa != null ? String(soil.potassiumKgHa) : 'Missing', 'Drainage', soil.drainage ? soil.drainage.replace(/_/g, ' ') : 'Missing']
    ],
    theme: 'grid',
    headStyles: { fillColor: [27, 77, 62] },
    styles: { fontSize: 8.5 }
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // 3. NASA Datasets & Environmental Risk
  doc.setFontSize(12);
  doc.text('3. NASA Observations & Environmental Risk Analysis', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Observation / Score', 'Reference / Provenance']],
    body: [
      ['Overall Environmental Risk', `${assessment.overallRiskLevel} (${assessment.overallRiskScore}/100)`, `Data Completeness: ${assessment.dataCompletenessPct}%`],
      ['Mean / Max / Min Temp', `${nasaPower.summary.meanTempC}°C / ${nasaPower.summary.maxTempC}°C / ${nasaPower.summary.minTempC}°C`, nasaPower.isDemonstrationFallback ? 'DEMONSTRATION DATA' : 'Live NASA POWER'],
      ['Temp Anomaly vs Baseline', `${nasaPower.summary.tempAnomalyC > 0 ? '+' : ''}${nasaPower.summary.tempAnomalyC}°C`, nasaPower.summary.baselineReference],
      ['Annual Rainfall & Anomaly', `${nasaPower.summary.totalPrecipitationMm} mm (${nasaPower.summary.rainfallAnomalyPct}%)`, `Heat Days >=38°C: ${nasaPower.summary.heatStressDays}`],
      ...assessment.riskMetrics.map((m) => [m.name, `${m.level} (${m.score}/100)`, m.interpretation])
    ],
    theme: 'grid',
    headStyles: { fillColor: [27, 77, 62] },
    styles: { fontSize: 8 }
  });

  doc.addPage();
  y = 18;

  // 4. Crop Suitability Top 8
  doc.setFontSize(12);
  doc.text('4. Top Crop Suitability Evaluations', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Crop', 'Category', 'Seasons', 'Score', 'Classification', 'Key Limitation / Evidence']],
    body: suitability.slice(0, 8).map((c) => [
      c.cropName,
      c.category,
      c.seasons.join(', '),
      `${c.score}/100`,
      c.classification,
      c.majorLimitations[0] || c.supportingEvidence[0] || 'Standard fit'
    ]),
    theme: 'grid',
    headStyles: { fillColor: [27, 77, 62] },
    styles: { fontSize: 8 }
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // 5. Crop Rotation Strategies Comparison
  doc.setFontSize(12);
  doc.text('5. Crop Rotation Strategies Comparison', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Strategy', 'Sequence', 'Total Score', 'Water Eff.', 'Climate', 'Soil', 'Erosion', 'Market']],
    body: rotationComparison.strategies.map((st) => [
      `${st.code}${st.isExistingBaseline ? ' (Existing)' : ''}`,
      st.sequenceDisplay,
      `${st.totalScore}/100`,
      String(st.componentScores.waterEfficiency),
      String(st.componentScores.climateResilience),
      String(st.componentScores.soilImprovement),
      String(st.componentScores.erosionProtection),
      String(st.componentScores.marketSuitability)
    ]),
    theme: 'grid',
    headStyles: { fillColor: [27, 77, 62] },
    styles: { fontSize: 8 }
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // 6. NASA Dataset Availability & Caveats
  doc.setFontSize(12);
  doc.text('6. NASA Dataset Status & Expert Validation Disclaimer', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Dataset', 'Status', 'Resolution', 'Coverage / Caveat']],
    body: datasets.map((d) => [d.shortName, d.status, d.spatialResolution, d.coverageNote]),
    theme: 'grid',
    headStyles: { fillColor: [27, 77, 62] },
    styles: { fontSize: 7.5 }
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(8.5);
  doc.setTextColor(74, 93, 80);
  const disclaimerLines = doc.splitTextToSize(`DISCLAIMER & EXPERT VALIDATION: ${report.disclaimer}`, 182);
  doc.text(disclaimerLines, 14, Math.min(y, 275));

  const safeName = farm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`agrishift-report-${safeName}.pdf`);
}

function triggerCsvDownload(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportClimateCsv(farmName: string, nasaPower: NasaPowerData): void {
  const headers = [
    'Month',
    'AvgTemp_C',
    'MaxTemp_C',
    'MinTemp_C',
    'Precipitation_mm',
    'Humidity_pct',
    'SolarRadiation_MJ_m2',
    'TempAnomaly_C',
    'RainfallAnomaly_pct',
    'Source'
  ];
  const rows = nasaPower.monthlySeries.map((pt) => [
    pt.month,
    pt.avgTempC ?? '',
    pt.maxTempC ?? '',
    pt.minTempC ?? '',
    pt.precipitationMm ?? '',
    pt.humidityPct ?? '',
    pt.solarRadiationMjM2 ?? '',
    pt.tempAnomalyC ?? '',
    pt.rainfallAnomalyPct ?? '',
    `"${nasaPower.source}"`
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const safeName = farmName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  triggerCsvDownload(`agrishift-climate-${safeName}.csv`, csv);
}

export function exportRotationCsv(farmName: string, comparison: RotationComparison): void {
  const headers = [
    'StrategyCode',
    'Label',
    'Sequence',
    'TotalScore',
    'WaterEfficiency',
    'ClimateResilience',
    'SoilImprovement',
    'ErosionProtection',
    'MarketSuitability',
    'AnnualWaterDemand_mm',
    'NetNitrogenBalance_kgHa'
  ];
  const rows = comparison.strategies.map((st) => [
    st.code,
    `"${st.label}"`,
    `"${st.sequenceDisplay}"`,
    st.totalScore,
    st.componentScores.waterEfficiency,
    st.componentScores.climateResilience,
    st.componentScores.soilImprovement,
    st.componentScores.erosionProtection,
    st.componentScores.marketSuitability,
    st.annualWaterDemandMm,
    st.netNitrogenEffectKgHa
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const safeName = farmName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  triggerCsvDownload(`agrishift-rotations-${safeName}.csv`, csv);
}
