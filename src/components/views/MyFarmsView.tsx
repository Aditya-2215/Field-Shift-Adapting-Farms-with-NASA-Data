import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Edit3, Lock, LogIn, MapPin, Plus, Trash2, Upload } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CROP_KNOWLEDGE_BASE } from '../../../shared/data/crops';
import { DEMO_FARM_ID } from '../../../shared/data/demoFarm';
import type { CropHistoryEntry, DrainageClass, Farm, GeoJsonPolygon } from '../../../shared/types/agri';
import { useAuth } from '../../contexts/AuthContext';
import { useFarms } from '../../contexts/FarmContext';
import { apiClient } from '../../services/api';
import { FarmLeafletMap } from '../maps/FarmLeafletMap';
import { FarmLocationMapEditor } from '../maps/FarmLocationMapEditor';

const farmFormSchema = z.object({
  name: z.string().min(2, 'Farm name must be at least 2 characters').max(140),
  country: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  district: z.string().min(2).max(80),
  village: z.string().max(80).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  area: z.number().positive('Area must be positive'),
  areaUnit: z.enum(['hectares', 'acres']),
  irrigationAvailable: z.boolean(),
  irrigationMethod: z.string().max(80).optional(),
  waterAvailability: z.enum(['abundant', 'moderate', 'limited', 'scarce']),
  waterConstraints: z.string().max(400).optional(),
  soilType: z.string().max(80).optional(),
  texture: z.string().max(80).optional(),
  drainage: z.string().optional(),
  ph: z.string().optional(),
  nitrogenKgHa: z.string().optional(),
  phosphorusKgHa: z.string().optional(),
  potassiumKgHa: z.string().optional(),
  organicCarbonPct: z.string().optional(),
  organicMatterPct: z.string().optional(),
  soilNotes: z.string().max(400).optional()
});

type FarmFormValues = z.infer<typeof farmFormSchema>;

function parseOptionalNumber(val?: string): number | null {
  if (!val || val.trim() === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

export function MyFarmsView() {
  const { user, signInWithGoogle } = useAuth();
  const { farms, activeFarm, setActiveFarmId, saveFarm, deleteFarm, updateLocation, updateBoundary } = useFarms();
  const isReadOnlyDemo = !user;
  const [editingFarmId, setEditingFarmId] = useState<string | null>(null);
  const [mapEditorFarm, setMapEditorFarm] = useState<Farm | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedCrops, setSelectedCrops] = useState<string[]>(['Rice', 'Wheat']);
  const [cropHistory, setCropHistory] = useState<CropHistoryEntry[]>([]);
  const [histYear, setHistYear] = useState('2025');
  const [histSeason, setHistSeason] = useState<'Kharif' | 'Rabi' | 'Zaid' | 'Annual'>('Kharif');
  const [histCrop, setHistCrop] = useState('Rice');
  const [geoJsonText, setGeoJsonText] = useState('');
  const [parsedBoundary, setParsedBoundary] = useState<GeoJsonPolygon | null>(null);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [labFileName, setLabFileName] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<FarmFormValues>({
    resolver: zodResolver(farmFormSchema),
    defaultValues: {
      name: '',
      country: 'India',
      state: 'Uttar Pradesh',
      district: '',
      village: '',
      latitude: 26.924,
      longitude: 81.189,
      area: 2.5,
      areaUnit: 'hectares',
      irrigationAvailable: true,
      irrigationMethod: 'Tubewell',
      waterAvailability: 'moderate',
      waterConstraints: '',
      soilType: '',
      texture: '',
      drainage: '',
      ph: '',
      nitrogenKgHa: '',
      phosphorusKgHa: '',
      potassiumKgHa: '',
      organicCarbonPct: '',
      organicMatterPct: '',
      soilNotes: ''
    }
  });

  const watchedLat = watch('latitude');
  const watchedLng = watch('longitude');

  const startNewFarm = () => {
    setEditingFarmId(null);
    setSelectedCrops(['Rice', 'Wheat']);
    setCropHistory([]);
    setParsedBoundary(null);
    setGeoJsonText('');
    setGeoMessage(null);
    setLabFileName(null);
    setStatusFeedback(null);
    reset({
      name: '',
      country: 'India',
      state: 'Uttar Pradesh',
      district: '',
      village: '',
      latitude: 26.85,
      longitude: 80.95,
      area: 2.5,
      areaUnit: 'hectares',
      irrigationAvailable: true,
      irrigationMethod: 'Tubewell',
      waterAvailability: 'moderate',
      waterConstraints: '',
      soilType: '',
      texture: '',
      drainage: '',
      ph: '',
      nitrogenKgHa: '',
      phosphorusKgHa: '',
      potassiumKgHa: '',
      organicCarbonPct: '',
      organicMatterPct: '',
      soilNotes: ''
    });
    setShowForm(true);
  };

  const startEditFarm = (farm: Farm) => {
    setEditingFarmId(farm.id);
    setSelectedCrops(farm.currentCrops.length ? farm.currentCrops : ['Rice', 'Wheat']);
    setCropHistory(farm.cropHistory || []);
    setParsedBoundary(farm.boundaryGeoJson ?? null);
    setGeoJsonText(farm.boundaryGeoJson ? JSON.stringify(farm.boundaryGeoJson, null, 2) : '');
    setGeoMessage(null);
    setLabFileName(farm.soilProfile?.labReportFileName ?? null);
    setStatusFeedback(null);
    reset({
      name: farm.name,
      country: farm.country,
      state: farm.state,
      district: farm.district,
      village: farm.village || '',
      latitude: farm.latitude,
      longitude: farm.longitude,
      area: farm.area,
      areaUnit: farm.areaUnit,
      irrigationAvailable: farm.irrigationAvailable,
      irrigationMethod: farm.irrigationMethod || '',
      waterAvailability: farm.waterAvailability,
      waterConstraints: farm.waterConstraints || '',
      soilType: farm.soilProfile?.soilType || '',
      texture: farm.soilProfile?.texture || '',
      drainage: farm.soilProfile?.drainage || '',
      ph: farm.soilProfile?.ph != null ? String(farm.soilProfile.ph) : '',
      nitrogenKgHa: farm.soilProfile?.nitrogenKgHa != null ? String(farm.soilProfile.nitrogenKgHa) : '',
      phosphorusKgHa: farm.soilProfile?.phosphorusKgHa != null ? String(farm.soilProfile.phosphorusKgHa) : '',
      potassiumKgHa: farm.soilProfile?.potassiumKgHa != null ? String(farm.soilProfile.potassiumKgHa) : '',
      organicCarbonPct: farm.soilProfile?.organicCarbonPct != null ? String(farm.soilProfile.organicCarbonPct) : '',
      organicMatterPct: farm.soilProfile?.organicMatterPct != null ? String(farm.soilProfile.organicMatterPct) : '',
      soilNotes: farm.soilProfile?.notes || ''
    });
    setShowForm(true);
  };

  const handleValidateGeoJson = async () => {
    setGeoMessage(null);
    try {
      const json = JSON.parse(geoJsonText);
      const analyzed = await apiClient.analyzeGeoJson(json);
      setParsedBoundary(analyzed.normalizedFeature as GeoJsonPolygon);
      setValue('latitude', analyzed.centroidLat);
      setValue('longitude', analyzed.centroidLng);
      setValue('area', analyzed.areaHectares);
      setValue('areaUnit', 'hectares');
      setGeoMessage(
        `Valid Polygon: ${analyzed.areaHectares} ha (${analyzed.areaAcres} acres) centered at ${analyzed.centroidLat}, ${analyzed.centroidLng}.`
      );
    } catch (err) {
      setGeoMessage(err instanceof Error ? err.message : 'Invalid GeoJSON syntax');
    }
  };

  const handleGeoJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setGeoJsonText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleSoilReportUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatusFeedback('Soil report file must be under 5 MB.');
      return;
    }
    setLabFileName(file.name);
  };

  const toggleCrop = (cropName: string) => {
    setSelectedCrops((prev) =>
      prev.includes(cropName) ? prev.filter((c) => c !== cropName) : [...prev, cropName]
    );
  };

  const addHistoryRow = () => {
    const y = Number(histYear);
    if (!Number.isFinite(y) || y < 1980 || y > 2035) return;
    setCropHistory((prev) => [...prev, { year: y, season: histSeason, cropName: histCrop }]);
  };

  const onSubmit = async (values: FarmFormValues) => {
    setSaving(true);
    setStatusFeedback(null);
    try {
      const saved = await saveFarm({
        id: editingFarmId ?? undefined,
        name: values.name,
        country: values.country,
        state: values.state,
        district: values.district,
        village: values.village || undefined,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
        area: Number(values.area),
        areaUnit: values.areaUnit,
        irrigationAvailable: values.irrigationAvailable,
        irrigationMethod: values.irrigationMethod || undefined,
        waterAvailability: values.waterAvailability,
        waterConstraints: values.waterConstraints || undefined,
        currentCrops: selectedCrops.length ? selectedCrops : ['Rice', 'Wheat'],
        cropHistory,
        soilProfile: {
          soilType: values.soilType || undefined,
          texture: values.texture || undefined,
          drainage: (values.drainage || null) as DrainageClass | null,
          ph: parseOptionalNumber(values.ph),
          nitrogenKgHa: parseOptionalNumber(values.nitrogenKgHa),
          phosphorusKgHa: parseOptionalNumber(values.phosphorusKgHa),
          potassiumKgHa: parseOptionalNumber(values.potassiumKgHa),
          organicCarbonPct: parseOptionalNumber(values.organicCarbonPct),
          organicMatterPct: parseOptionalNumber(values.organicMatterPct),
          labReportFileName: labFileName,
          notes: values.soilNotes || undefined
        },
        boundaryGeoJson: parsedBoundary
      });
      setStatusFeedback(`Saved "${saved.name}" and updated environmental analysis.`);
      setShowForm(false);
    } catch (err) {
      setStatusFeedback(err instanceof Error ? err.message : 'Failed to save farm');
    } finally {
      setSaving(false);
    }
  };

  const previewFarmForPicker: Farm = {
    ...activeFarm,
    latitude: Number.isFinite(Number(watchedLat)) ? Number(watchedLat) : activeFarm.latitude,
    longitude: Number.isFinite(Number(watchedLng)) ? Number(watchedLng) : activeFarm.longitude,
    boundaryGeoJson: parsedBoundary
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111C15]">My Farms & Soil Profiles</h1>
          <p className="text-sm text-[#4A5D50]">
            Manage farm coordinates, GeoJSON boundaries, water constraints, and lab soil health values. Missing soil values are never fabricated.
          </p>
        </div>
        <button
          type="button"
          disabled={isReadOnlyDemo}
          onClick={startNewFarm}
          title={isReadOnlyDemo ? 'Sign in with Google to register new farms' : 'Add a new farm'}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1B4D3E] text-white text-sm font-semibold hover:bg-[#143B2F] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Farm</span>
        </button>
      </div>

      {isReadOnlyDemo && (
        <div className="rounded-xl border border-[#DCE3DC] bg-white px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3 text-xs text-[#4A5D50]">
            <Lock className="w-4 h-4 text-[#1B4D3E] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[#111C15]">Demonstration Mode (Read-Only)</div>
              <p className="mt-0.5">
                You are inspecting the built-in Barabanki demonstration parcel. Sign in to create, edit, or delete persistent farm parcels in PostgreSQL.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signInWithGoogle().catch(() => {})}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#143B2F] whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign in with Google</span>
          </button>
        </div>
      )}

      {statusFeedback && (
        <div className="rounded-lg border border-[#1B4D3E]/30 bg-white px-4 py-3 text-sm text-[#1B4D3E] font-medium">
          {statusFeedback}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-xl border border-[#DCE3DC] bg-white p-6 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-[#DCE3DC] pb-4">
            <h2 className="font-display text-lg font-semibold text-[#111C15]">
              {editingFarmId ? 'Edit Farm Details' : 'Register Agricultural Parcel'}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs font-medium text-[#4A5D50] hover:text-[#111C15]"
            >
              Cancel
            </button>
          </div>

          {/* Location & Geometry */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Farm Name *</label>
                <input
                  {...register('name')}
                  placeholder="e.g., Sitapur North Block"
                  className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]"
                />
                {errors.name && <p className="text-xs text-[#DC2626] mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Country *</label>
                <input {...register('country')} className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">State *</label>
                <input {...register('state')} className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">District *</label>
                <input {...register('district')} placeholder="e.g., Sitapur" className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm" />
                {errors.district && <p className="text-xs text-[#DC2626] mt-1">{errors.district.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Village</label>
                <input {...register('village')} className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Latitude *</label>
                <input type="number" step="0.00001" {...register('latitude', { valueAsNumber: true })} className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm font-mono-num" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Longitude *</label>
                <input type="number" step="0.00001" {...register('longitude', { valueAsNumber: true })} className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm font-mono-num" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Area *</label>
                <input type="number" step="0.1" {...register('area', { valueAsNumber: true })} className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm font-mono-num" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Area Unit</label>
                <select {...register('areaUnit')} className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm bg-white">
                  <option value="hectares">Hectares</option>
                  <option value="acres">Acres</option>
                </select>
              </div>
            </div>

            <div className="lg:col-span-12 space-y-3">
              <FarmLocationMapEditor
                initialLatitude={watch('latitude') || 26.926}
                initialLongitude={watch('longitude') || 81.183}
                initialBoundaryGeoJson={parsedBoundary}
                initialArea={watch('area') || 4.2}
                initialAreaUnit={watch('areaUnit') || 'hectares'}
                farmName={watch('name') || 'New Farm Parcel'}
                farmId={editingFarmId || undefined}
                isReadOnly={false}
                containerHeight="h-80"
                onSaveLocation={(loc) => {
                  setValue('latitude', loc.latitude);
                  setValue('longitude', loc.longitude);
                  if (loc.village) setValue('village', loc.village);
                  if (loc.district) setValue('district', loc.district);
                  if (loc.state) setValue('state', loc.state);
                  if (loc.country) setValue('country', loc.country);
                }}
                onSaveBoundary={(bound) => {
                  setParsedBoundary(bound.boundaryGeoJson);
                  setValue('area', bound.area);
                  setValue('areaUnit', bound.areaUnit);
                  setGeoJsonText(bound.boundaryGeoJson ? JSON.stringify(bound.boundaryGeoJson, null, 2) : '');
                }}
              />
            </div>
          </div>

          {/* Optional Direct GeoJSON Import / Text */}
          <div className="border-t border-[#DCE3DC] pt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[#111C15]">
                Manual GeoJSON Import or Polygon Payload
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1B4D3E] cursor-pointer hover:underline">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload .geojson file</span>
                <input type="file" accept=".json,.geojson" onChange={handleGeoJsonFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              rows={2}
              value={geoJsonText}
              onChange={(e) => setGeoJsonText(e.target.value)}
              placeholder='{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[81.18,26.92],[81.19,26.92],[81.19,26.91],[81.18,26.91],[81.18,26.92]]]}}'
              className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-xs font-mono-num"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleValidateGeoJson}
                className="px-3 py-1.5 rounded-lg border border-[#DCE3DC] text-xs font-semibold text-[#111C15] hover:bg-[#F6F8F5]"
              >
                Validate & Compute Area (Turf.js)
              </button>
              {geoMessage && <span className="text-xs text-[#4A5D50]">{geoMessage}</span>}
            </div>
          </div>

          {/* Water & Irrigation */}
          <div className="border-t border-[#DCE3DC] pt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-2 pt-5">
              <input id="irr-avail" type="checkbox" {...register('irrigationAvailable')} className="w-4 h-4 accent-[#1B4D3E]" />
              <label htmlFor="irr-avail" className="text-sm font-medium text-[#111C15]">Irrigation Available</label>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#111C15] mb-1">Water Availability</label>
              <select {...register('waterAvailability')} className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm bg-white">
                <option value="abundant">Abundant</option>
                <option value="moderate">Moderate</option>
                <option value="limited">Limited</option>
                <option value="scarce">Scarce / Rainfed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#111C15] mb-1">Irrigation Method</label>
              <input {...register('irrigationMethod')} placeholder="e.g., Canal + Tubewell" className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-[#111C15] mb-1">Water Constraints</label>
              <input {...register('waterConstraints')} placeholder="e.g., Pre-monsoon groundwater drawdown in May" className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Current Crops & History */}
          <div className="border-t border-[#DCE3DC] pt-5 space-y-4">
            <div>
              <div className="text-xs font-semibold text-[#111C15] mb-2">Current Crops (Baseline Rotation)</div>
              <div className="flex flex-wrap gap-2">
                {CROP_KNOWLEDGE_BASE.map((c) => {
                  const active = selectedCrops.includes(c.name);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCrop(c.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                          : 'bg-white text-[#4A5D50] border-[#DCE3DC] hover:text-[#111C15]'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-[#111C15] mb-2">Historical Crop Log</div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <input
                  type="number"
                  value={histYear}
                  onChange={(e) => setHistYear(e.target.value)}
                  className="w-24 rounded-lg border border-[#DCE3DC] px-2.5 py-1.5 text-xs font-mono-num"
                />
                <select
                  value={histSeason}
                  onChange={(e) => setHistSeason(e.target.value as CropHistoryEntry['season'])}
                  className="rounded-lg border border-[#DCE3DC] px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value="Kharif">Kharif</option>
                  <option value="Rabi">Rabi</option>
                  <option value="Zaid">Zaid</option>
                  <option value="Annual">Annual</option>
                </select>
                <select
                  value={histCrop}
                  onChange={(e) => setHistCrop(e.target.value)}
                  className="rounded-lg border border-[#DCE3DC] px-2.5 py-1.5 text-xs bg-white"
                >
                  {CROP_KNOWLEDGE_BASE.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addHistoryRow}
                  className="px-3 py-1.5 rounded-lg border border-[#DCE3DC] text-xs font-semibold text-[#111C15] hover:bg-[#F6F8F5]"
                >
                  Add Season
                </button>
              </div>
              {cropHistory.length > 0 && (
                <div className="text-xs text-[#4A5D50] flex flex-wrap gap-3">
                  {cropHistory.map((h, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      <span>{h.year} {h.season}: {h.cropName}</span>
                      <button
                        type="button"
                        onClick={() => setCropHistory((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-[#DC2626] hover:underline"
                      >
                        remove
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Soil Health Profile */}
          <div className="border-t border-[#DCE3DC] pt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#111C15]">Soil Characteristics (Leave blank if unknown)</h3>
                <p className="text-xs text-[#4A5D50]">Unknown soil parameters are flagged explicitly as missing inputs.</p>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1B4D3E] cursor-pointer hover:underline">
                <Upload className="w-3.5 h-3.5" />
                <span>{labFileName ? `Attached: ${labFileName}` : 'Attach Soil Test Report (PDF/CSV)'}</span>
                <input type="file" accept=".pdf,.csv,.txt,.jpg,.png" onChange={handleSoilReportUpload} className="hidden" />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Soil Type</label>
                <input {...register('soilType')} placeholder="Alluvial" className="w-full rounded-lg border border-[#DCE3DC] px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Texture</label>
                <input {...register('texture')} placeholder="Alluvial Loam" className="w-full rounded-lg border border-[#DCE3DC] px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Drainage</label>
                <select {...register('drainage')} className="w-full rounded-lg border border-[#DCE3DC] px-3 py-1.5 text-sm bg-white">
                  <option value="">Unknown</option>
                  <option value="well_drained">Well drained</option>
                  <option value="moderately_drained">Moderately drained</option>
                  <option value="poorly_drained">Poorly drained</option>
                  <option value="excessively_drained">Excessively drained</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">pH</label>
                <input type="number" step="0.1" {...register('ph')} placeholder="e.g., 7.4" className="w-full rounded-lg border border-[#DCE3DC] px-3 py-1.5 text-sm font-mono-num" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Nitrogen (kg/ha)</label>
                <input type="number" step="1" {...register('nitrogenKgHa')} placeholder="e.g., 185" className="w-full rounded-lg border border-[#DCE3DC] px-3 py-1.5 text-sm font-mono-num" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Phosphorus (kg/ha)</label>
                <input type="number" step="1" {...register('phosphorusKgHa')} placeholder="e.g., 16" className="w-full rounded-lg border border-[#DCE3DC] px-3 py-1.5 text-sm font-mono-num" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Potassium (kg/ha)</label>
                <input type="number" step="1" {...register('potassiumKgHa')} placeholder="e.g., 210" className="w-full rounded-lg border border-[#DCE3DC] px-3 py-1.5 text-sm font-mono-num" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Organic Carbon (%)</label>
                <input type="number" step="0.01" {...register('organicCarbonPct')} placeholder="e.g., 0.48" className="w-full rounded-lg border border-[#DCE3DC] px-3 py-1.5 text-sm font-mono-num" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DCE3DC]">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-[#DCE3DC] text-sm font-medium text-[#4A5D50]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#1B4D3E] text-white text-sm font-semibold hover:bg-[#143B2F] disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Farm & Run Analysis'}
            </button>
          </div>
        </form>
      )}

      {/* Farm List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {farms.map((farm) => {
          const isSelected = farm.id === activeFarm.id;
          const soil = farm.soilProfile || {};
          const missingSoil = [
            soil.ph == null ? 'pH' : null,
            soil.organicCarbonPct == null ? 'Organic Carbon' : null,
            soil.nitrogenKgHa == null ? 'Nitrogen' : null,
            !soil.drainage ? 'Drainage' : null
          ].filter(Boolean);

          return (
            <div
              key={farm.id}
              className={`rounded-xl border bg-white p-5 flex flex-col justify-between gap-4 ${
                isSelected ? 'border-[#1B4D3E]' : 'border-[#DCE3DC]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-[#4A5D50] mb-0.5">
                      {farm.district}, {farm.state} · {farm.area} {farm.areaUnit}
                      {farm.isDemo ? ' · Built-in Demo Parcel' : ''}
                    </div>
                    <h2 className="font-display text-lg font-bold text-[#111C15]">{farm.name}</h2>
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B4D3E]">
                      <Check className="w-3.5 h-3.5" />
                      Active
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs border-y border-[#DCE3DC] py-3">
                  <div>
                    <span className="text-[#4A5D50]">Coordinates:</span>{' '}
                    <span className="font-mono-num text-[#111C15]">
                      {farm.latitude.toFixed(4)}°N, {farm.longitude.toFixed(4)}°E
                    </span>
                  </div>
                  <div>
                    <span className="text-[#4A5D50]">Water:</span>{' '}
                    <span className="text-[#111C15] capitalize">
                      {farm.waterAvailability} ({farm.irrigationAvailable ? 'Irrigated' : 'Rainfed'})
                    </span>
                  </div>
                  <div>
                    <span className="text-[#4A5D50]">Current Crops:</span>{' '}
                    <span className="text-[#111C15]">{farm.currentCrops.join(' → ')}</span>
                  </div>
                  <div>
                    <span className="text-[#4A5D50]">Soil pH / OC:</span>{' '}
                    <span className="font-mono-num text-[#111C15]">
                      {soil.ph ?? 'Missing'} / {soil.organicCarbonPct != null ? `${soil.organicCarbonPct}%` : 'Missing'}
                    </span>
                  </div>
                </div>

                {missingSoil.length > 0 && (
                  <div className="text-xs text-[#D97706]">
                    Missing soil fields: {missingSoil.join(', ')}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFarmId(farm.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'bg-[#1B4D3E] text-white'
                      : 'border border-[#DCE3DC] text-[#111C15] hover:bg-[#F6F8F5]'
                  }`}
                >
                  {isSelected ? 'Selected for Analysis' : 'Select Farm'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMapEditorFarm(farm)}
                    aria-label={`Map & boundaries for ${farm.name}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DCE3DC] text-xs font-medium text-[#1B4D3E] hover:bg-[#F6F8F5]"
                  >
                    <MapPin className="w-3.5 h-3.5 text-[#1B4D3E]" />
                    <span>Map & Boundary</span>
                  </button>

                  {farm.id !== DEMO_FARM_ID ? (
                    <>
                      <button
                        type="button"
                        disabled={isReadOnlyDemo}
                        onClick={() => startEditFarm(farm)}
                        aria-label={`Edit ${farm.name}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DCE3DC] text-xs font-medium text-[#111C15] hover:bg-[#F6F8F5] disabled:opacity-50"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        disabled={isReadOnlyDemo}
                        onClick={() => deleteFarm(farm.id)}
                        aria-label={`Delete ${farm.name}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DC2626]/30 text-xs font-medium text-[#DC2626] hover:bg-[#FEE2E2]/50 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] font-medium text-[#4A5D50] px-2 py-1">
                      Read-only demo parcel
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dedicated Location & Boundary Mapping Studio Modal */}
      {mapEditorFarm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto my-auto">
            <FarmLocationMapEditor
              initialLatitude={mapEditorFarm.latitude}
              initialLongitude={mapEditorFarm.longitude}
              initialAccuracy={mapEditorFarm.locationAccuracy}
              initialAddressComponents={mapEditorFarm.addressComponents}
              initialBoundaryGeoJson={mapEditorFarm.boundaryGeoJson}
              initialArea={mapEditorFarm.area}
              initialAreaUnit={mapEditorFarm.areaUnit}
              farmName={mapEditorFarm.name}
              farmId={mapEditorFarm.id}
              isReadOnly={isReadOnlyDemo || mapEditorFarm.id === DEMO_FARM_ID}
              onSaveLocation={async (loc) => {
                await updateLocation(mapEditorFarm.id, loc);
                setStatusFeedback(`Updated location coordinates for "${mapEditorFarm.name}".`);
                setMapEditorFarm(null);
              }}
              onSaveBoundary={async (bound) => {
                await updateBoundary(mapEditorFarm.id, bound);
                setStatusFeedback(`Updated farm boundary and computed area for "${mapEditorFarm.name}".`);
                setMapEditorFarm(null);
              }}
              onClose={() => setMapEditorFarm(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
