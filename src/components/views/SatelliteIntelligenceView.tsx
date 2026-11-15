import { useState } from 'react';
import { Layers, MapPin } from 'lucide-react';
import { useFarms } from '../../contexts/FarmContext';
import { FarmLeafletMap } from '../maps/FarmLeafletMap';

export function SatelliteIntelligenceView() {
  const { activeFarm, datasets, assessment, nasaPower } = useFarms();
  const [baseLayer, setBaseLayer] = useState<'street' | 'satellite'>('satellite');
  const [showBoundary, setShowBoundary] = useState(true);
  const [showRegionalGrid, setShowRegionalGrid] = useState(true);
  const [showRiskZone, setShowRiskZone] = useState(true);
  const [opacity, setOpacity] = useState(0.5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#111C15]">
          Satellite & Geospatial Intelligence
        </h1>
        <p className="text-sm text-[#4A5D50]">
          Inspect parcel boundaries, spatial resolutions, and live vs unconfigured NASA Earth observation feeds. Unavailable raster layers are never fabricated.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map Viewport */}
        <div className="lg:col-span-8 space-y-3">
          <FarmLeafletMap
            farm={activeFarm}
            heightClass="h-[460px]"
            baseLayer={baseLayer}
            showBoundary={showBoundary}
            showRegionalGridOverlay={showRegionalGrid}
            showRiskZoneOverlay={showRiskZone}
            overlayOpacity={opacity}
            riskLevel={assessment?.overallRiskLevel ?? 'Moderate'}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#4A5D50]">
            <span>
              Parcel Center: <strong className="font-mono-num text-[#111C15]">{activeFarm.latitude.toFixed(4)}° N, {activeFarm.longitude.toFixed(4)}° E</strong>
            </span>
            <span>
              Blue dashed ring: ~8 km sub-regional context · Solid green polygon: Farm GeoJSON boundary
            </span>
          </div>
        </div>

        {/* Map Layer Controls & Legend */}
        <div className="lg:col-span-4 rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-5">
          <div className="flex items-center gap-2 font-display text-base font-semibold text-[#111C15]">
            <Layers className="w-4 h-4 text-[#1B4D3E]" />
            <span>Map Layers & Provenance</span>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#111C15]">Base Imagery</div>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-[#F6F8F5] border border-[#DCE3DC]">
              <button
                type="button"
                onClick={() => setBaseLayer('satellite')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  baseLayer === 'satellite' ? 'bg-[#1B4D3E] text-white' : 'text-[#4A5D50]'
                }`}
              >
                Aerial Imagery
              </button>
              <button
                type="button"
                onClick={() => setBaseLayer('street')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  baseLayer === 'street' ? 'bg-[#1B4D3E] text-white' : 'text-[#4A5D50]'
                }`}
              >
                Topographic Street
              </button>
            </div>
          </div>

          <div className="space-y-2.5 border-t border-[#DCE3DC] pt-4 text-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-medium text-[#111C15]">Farm Boundary Polygon</span>
              <input type="checkbox" checked={showBoundary} onChange={(e) => setShowBoundary(e.target.checked)} className="accent-[#1B4D3E]" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-medium text-[#111C15]">Environmental Risk Zone</span>
              <input type="checkbox" checked={showRiskZone} onChange={(e) => setShowRiskZone(e.target.checked)} className="accent-[#1B4D3E]" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-medium text-[#111C15]">NASA Grid Resolution Context</span>
              <input type="checkbox" checked={showRegionalGrid} onChange={(e) => setShowRegionalGrid(e.target.checked)} className="accent-[#1B4D3E]" />
            </label>
          </div>

          <div className="space-y-1.5 border-t border-[#DCE3DC] pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#111C15]">Overlay Opacity</span>
              <span className="font-mono-num text-[#4A5D50]">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              aria-label="Overlay opacity"
              className="w-full accent-[#1B4D3E]"
            />
          </div>

          <div className="border-t border-[#DCE3DC] pt-4 space-y-2 text-xs">
            <div className="font-semibold text-[#111C15]">Raster Layer Availability</div>
            <p className="text-[#4A5D50] leading-relaxed">
              Live NASA POWER climate data is active ({nasaPower?.spatialResolution}). High-resolution NDVI (MODIS 250m / Landsat 30m), SMAP Soil Moisture, and SRTM Slope rasters show <strong className="text-[#D97706]">Authentication required / Not configured</strong> until Earthdata or Google Earth Engine credentials are attached on the server.
            </p>
          </div>
        </div>
      </div>

      {/* Full NASA Dataset Registry Table */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#DCE3DC] flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[#111C15]">
            NASA Earth Observation Dataset Status & Spatial Resolution
          </h2>
          <span className="text-xs text-[#4A5D50] flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {activeFarm.district}, {activeFarm.state}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F6F8F5] border-b border-[#DCE3DC] text-[#4A5D50] font-semibold">
                <th className="py-3 px-4">Dataset</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Spatial Resolution</th>
                <th className="py-3 px-4">Temporal</th>
                <th className="py-3 px-4">Coverage & Scientific Caveat</th>
                <th className="py-3 px-4">Configuration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE3DC]">
              {datasets.map((ds) => (
                <tr key={ds.id} className="hover:bg-[#F6F8F5]/60">
                  <td className="py-3.5 px-4 font-semibold text-[#111C15]">
                    {ds.shortName}
                    <div className="font-normal text-[#4A5D50] mt-0.5">{ds.purpose}</div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-semibold">
                    <span
                      className={
                        ds.status === 'Connected'
                          ? 'text-[#16A34A]'
                          : 'text-[#D97706]'
                      }
                    >
                      {ds.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono-num whitespace-nowrap">{ds.spatialResolution}</td>
                  <td className="py-3.5 px-4 whitespace-nowrap">{ds.temporalResolution}</td>
                  <td className="py-3.5 px-4 text-[#4A5D50] max-w-xs">{ds.coverageNote}</td>
                  <td className="py-3.5 px-4 text-[#4A5D50] max-w-xs">{ds.configurationGuide}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
