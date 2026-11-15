import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Popup,
  Circle,
  useMap,
  useMapEvents
} from 'react-leaflet';
import * as turf from '@turf/turf';
import {
  MapPin,
  Search,
  Crosshair,
  Layers,
  Check,
  RotateCcw,
  Trash2,
  Info,
  AlertCircle,
  Loader2,
  Mountain,
  Sun,
  CloudRain,
  ShieldCheck,
  Compass,
  X
} from 'lucide-react';
import { apiClient } from '../../services/api';
import type { Farm, GeoJsonPolygon } from '../../../shared/types/agri';

// Sharp custom DivIcons that don't depend on external image files
const centerMarkerIcon = L.divIcon({
  className: 'agrishift-center-pin',
  html: `
    <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:grab;">
      <div style="position:absolute;width:30px;height:30px;background:rgba(27,77,62,0.25);border-radius:50%;"></div>
      <div style="width:20px;height:20px;background:#1B4D3E;border:3px solid #FFFFFF;border-radius:50%;box-shadow:0 3px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
        <div style="width:6px;height:6px;background:#FFFFFF;border-radius:50%;"></div>
      </div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

const vertexMarkerIcon = L.divIcon({
  className: 'agrishift-vertex-pin',
  html: `<div style="width:12px;height:12px;background:#D97706;border:2px solid #FFFFFF;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:crosshair;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

function MapRecenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom || map.getZoom(), { animate: true });
  }, [center[0], center[1], zoom, map]);
  return null;
}

function MapClickHandler({
  mode,
  onMapClick
}: {
  mode: 'pin' | 'boundary';
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(
        Math.round(e.latlng.lat * 100000) / 100000,
        Math.round(e.latlng.lng * 100000) / 100000
      );
    }
  });
  return null;
}

export interface FarmLocationMapEditorProps {
  initialLatitude: number;
  initialLongitude: number;
  initialAccuracy?: number | null;
  initialAddressComponents?: Record<string, unknown> | null;
  initialBoundaryGeoJson?: GeoJsonPolygon | null;
  initialArea?: number;
  initialAreaUnit?: 'hectares' | 'acres';
  farmName?: string;
  farmId?: string;
  isReadOnly?: boolean;
  onSaveLocation?: (location: {
    latitude: number;
    longitude: number;
    locationAccuracy?: number | null;
    addressComponents: Record<string, unknown>;
    village?: string;
    district?: string;
    state?: string;
    country?: string;
  }) => Promise<void> | void;
  onSaveBoundary?: (boundary: {
    boundaryGeoJson: GeoJsonPolygon | null;
    area: number;
    areaUnit: 'hectares' | 'acres';
  }) => Promise<void> | void;
  onClose?: () => void;
  containerHeight?: string;
}

export function FarmLocationMapEditor({
  initialLatitude,
  initialLongitude,
  initialAccuracy = null,
  initialAddressComponents = null,
  initialBoundaryGeoJson = null,
  initialArea = 4.2,
  initialAreaUnit = 'hectares',
  farmName = 'Farm Parcel',
  farmId,
  isReadOnly = false,
  onSaveLocation,
  onSaveBoundary,
  onClose,
  containerHeight = 'h-[520px]'
}: FarmLocationMapEditorProps) {
  // Coordinates state
  const [latitude, setLatitude] = useState<number>(initialLatitude);
  const [longitude, setLongitude] = useState<number>(initialLongitude);
  const [latInput, setLatInput] = useState<string>(String(initialLatitude));
  const [lonInput, setLonInput] = useState<string>(String(initialLongitude));
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(initialAccuracy);

  // Address state
  const [addressComponents, setAddressComponents] = useState<Record<string, unknown>>(
    initialAddressComponents || {}
  );
  const [resolvedAddress, setResolvedAddress] = useState<string>(
    (initialAddressComponents?.formattedAddress as string) || ''
  );
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // Elevation state
  const [elevation, setElevation] = useState<number | null>(null);
  const [elevationSource, setElevationSource] = useState<string>('');

  // Mode state: 'pin' for dragging location pin; 'boundary' for drawing polygon
  const [editorMode, setEditorMode] = useState<'pin' | 'boundary'>('pin');
  const [baseLayer, setBaseLayer] = useState<'street' | 'satellite'>('street');

  // Boundary vertices state: list of [lat, lng]
  const [boundaryPoints, setBoundaryPoints] = useState<[number, number][]>(() => {
    if (!initialBoundaryGeoJson) return [];
    const coords =
      initialBoundaryGeoJson.geometry?.coordinates?.[0] ||
      initialBoundaryGeoJson.coordinates?.[0];
    if (Array.isArray(coords)) {
      return coords
        .filter((pt: any) => Array.isArray(pt) && pt.length >= 2)
        .map((pt: any) => [Number(pt[1]), Number(pt[0])] as [number, number]);
    }
    return [];
  });

  const [calculatedAreaHa, setCalculatedAreaHa] = useState<number>(initialArea);
  const [calculatedAreaAc, setCalculatedAreaAc] = useState<number>(
    Math.round(initialArea * 2.47105 * 100) / 100
  );

  // UI feedback & saving states
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Climate data preview state
  const [previewClimate, setPreviewClimate] = useState<{
    temperature: number;
    rainfall: number;
    radiation: number;
    riskScore: number;
    riskLevel: string;
    source: string;
  } | null>(null);
  const [loadingClimate, setLoadingClimate] = useState<boolean>(false);

  // Calculate polygon area whenever vertices change
  useEffect(() => {
    if (boundaryPoints.length >= 3) {
      try {
        const ring = boundaryPoints.map(([lat, lng]) => [lng, lat]);
        // Close ring
        if (
          ring[0][0] !== ring[ring.length - 1][0] ||
          ring[0][1] !== ring[ring.length - 1][1]
        ) {
          ring.push([...ring[0]]);
        }
        const poly = turf.polygon([ring]);
        const areaSqMeters = turf.area(poly);
        const ha = Math.round((areaSqMeters / 10000) * 100) / 100;
        const ac = Math.round((areaSqMeters / 4046.856) * 100) / 100;
        setCalculatedAreaHa(ha);
        setCalculatedAreaAc(ac);
      } catch {
        // invalid polygon
      }
    }
  }, [boundaryPoints]);

  // Fetch elevation and reverse geocode on initial mount or when coordinates settle
  useEffect(() => {
    let active = true;
    const fetchGeoDetails = async () => {
      try {
        setIsGeocoding(true);
        const [rev, elev] = await Promise.all([
          apiClient.reverseGeocode(latitude, longitude).catch(() => null),
          apiClient.getElevation(latitude, longitude).catch(() => null)
        ]);
        if (!active) return;
        if (rev?.addressComponents) {
          setAddressComponents(rev.addressComponents as any);
          setResolvedAddress(rev.displayName);
        }
        if (elev?.elevationMeters != null) {
          setElevation(elev.elevationMeters);
          setElevationSource(elev.source);
        }
      } finally {
        if (active) setIsGeocoding(false);
      }
    };

    fetchGeoDetails();
    return () => {
      active = false;
    };
  }, [latitude, longitude]);

  // Handle GPS location acquisition
  const handleGetBrowserGps = () => {
    if (!navigator.geolocation) {
      setStatusMessage({
        text: 'Geolocation is not supported by your browser.',
        type: 'error'
      });
      return;
    }

    setGpsLoading(true);
    setStatusMessage({
      text: 'Requesting device GPS position (requires browser permission)...',
      type: 'info'
    });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 100000) / 100000;
        const lng = Math.round(pos.coords.longitude * 100000) / 100000;
        const accuracy = Math.round(pos.coords.accuracy);

        setLatitude(lat);
        setLongitude(lng);
        setLatInput(String(lat));
        setLonInput(String(lng));
        setGpsAccuracy(accuracy);
        setGpsLoading(false);

        setStatusMessage({
          text: `Acquired GPS location with ±${accuracy}m device accuracy.`,
          type: 'success'
        });
      },
      (err) => {
        setGpsLoading(false);
        let errorMsg = 'Failed to acquire location.';
        if (err.code === err.PERMISSION_DENIED) {
          errorMsg = 'GPS permission denied. Please allow location access or pick coordinates on the map.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errorMsg = 'Device GPS position is unavailable.';
        } else if (err.code === err.TIMEOUT) {
          errorMsg = 'GPS request timed out. Please try again or use address search.';
        }
        setStatusMessage({ text: errorMsg, type: 'error' });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  };

  // Handle address search
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q || q.length < 2) return;

    setIsSearching(true);
    setStatusMessage(null);
    try {
      const results = await apiClient.geocode(q);
      setSearchResults(results);
      setShowSearchResults(true);
      if (results.length === 0) {
        setStatusMessage({ text: `No locations found matching "${q}".`, type: 'info' });
      }
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : 'Address search failed.',
        type: 'error'
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Select a search result
  const handleSelectSearchResult = (result: any) => {
    const lat = Math.round(result.latitude * 100000) / 100000;
    const lng = Math.round(result.longitude * 100000) / 100000;

    setLatitude(lat);
    setLongitude(lng);
    setLatInput(String(lat));
    setLonInput(String(lng));
    setGpsAccuracy(null); // Clear hardware accuracy since this was address-geocoded
    setAddressComponents(result.addressComponents || {});
    setResolvedAddress(result.displayName);
    setShowSearchResults(false);
    setSearchQuery('');
    setStatusMessage({
      text: `Centered map on ${result.addressComponents?.district || result.displayName}.`,
      type: 'success'
    });
  };

  // Handle manual coordinate input blur/apply
  const handleManualCoordApply = () => {
    const parsedLat = parseFloat(latInput);
    const parsedLon = parseFloat(lonInput);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setStatusMessage({ text: 'Latitude must be a valid number between -90 and 90.', type: 'error' });
      return;
    }
    if (isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180) {
      setStatusMessage({ text: 'Longitude must be a valid number between -180 and 180.', type: 'error' });
      return;
    }

    const cleanLat = Math.round(parsedLat * 100000) / 100000;
    const cleanLon = Math.round(parsedLon * 100000) / 100000;
    setLatitude(cleanLat);
    setLongitude(cleanLon);
    setGpsAccuracy(null);
    setStatusMessage({ text: `Coordinates updated manually to ${cleanLat}, ${cleanLon}.`, type: 'info' });
  };

  // Handle map click based on mode
  const handleMapClick = (clickLat: number, clickLng: number) => {
    if (editorMode === 'pin') {
      setLatitude(clickLat);
      setLongitude(clickLng);
      setLatInput(String(clickLat));
      setLonInput(String(clickLng));
      setGpsAccuracy(null);
    } else if (editorMode === 'boundary') {
      setBoundaryPoints((prev) => [...prev, [clickLat, clickLng]]);
    }
  };

  // Undo last boundary vertex
  const handleUndoVertex = () => {
    setBoundaryPoints((prev) => prev.slice(0, prev.length - 1));
  };

  // Clear all boundary vertices
  const handleClearBoundary = () => {
    setBoundaryPoints([]);
    setCalculatedAreaHa(0);
    setCalculatedAreaAc(0);
  };

  // Preview live NASA data for coordinates
  const handleFetchPreviewClimate = async () => {
    setLoadingClimate(true);
    try {
      const mockFarm: Farm = {
        id: farmId || 'preview_parcel',
        ownerId: 'preview',
        name: farmName,
        country: (addressComponents?.country as string) || 'India',
        state: (addressComponents?.state as string) || 'State',
        district: (addressComponents?.district as string) || 'District',
        latitude,
        longitude,
        area: calculatedAreaHa || 4.2,
        areaUnit: 'hectares',
        irrigationAvailable: true,
        waterAvailability: 'moderate',
        currentCrops: ['Rice', 'Wheat'],
        cropHistory: [],
        soilProfile: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const res = await apiClient.analyzeEnvironment(mockFarm, false);
      setPreviewClimate({
        temperature: res.nasaPower.summary.meanTempC,
        rainfall: res.nasaPower.summary.totalPrecipitationMm,
        radiation: res.nasaPower.summary.meanSolarRadiationMjM2,
        riskScore: res.assessment.overallRiskScore,
        riskLevel: res.assessment.overallRiskLevel,
        source: res.nasaPower.isDemonstrationFallback
          ? 'NASA POWER Climatology Baseline'
          : 'Live NASA POWER (MERRA-2 Grid)'
      });
      setStatusMessage({
        text: 'Successfully retrieved live NASA POWER climate baseline for coordinates.',
        type: 'success'
      });
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : 'Unable to retrieve NASA POWER preview.',
        type: 'error'
      });
    } finally {
      setLoadingClimate(false);
    }
  };

  // Save changes
  const handleSaveAll = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      // 1. Save location
      if (onSaveLocation) {
        await onSaveLocation({
          latitude,
          longitude,
          locationAccuracy: gpsAccuracy,
          addressComponents: {
            ...addressComponents,
            formattedAddress: resolvedAddress,
            locationAccuracyMeters: gpsAccuracy
          },
          village: (addressComponents.village as string) || undefined,
          district: (addressComponents.district as string) || undefined,
          state: (addressComponents.state as string) || undefined,
          country: (addressComponents.country as string) || 'India'
        });
      }

      // 2. Save boundary if vertices exist
      if (onSaveBoundary) {
        let geoJson: GeoJsonPolygon | null = null;
        if (boundaryPoints.length >= 3) {
          const ring = boundaryPoints.map(([lat, lng]) => [lng, lat]);
          if (
            ring[0][0] !== ring[ring.length - 1][0] ||
            ring[0][1] !== ring[ring.length - 1][1]
          ) {
            ring.push([...ring[0]]);
          }
          geoJson = {
            type: 'Feature',
            properties: {
              areaHectares: calculatedAreaHa,
              areaAcres: calculatedAreaAc
            },
            geometry: {
              type: 'Polygon',
              coordinates: [ring]
            }
          };
        }

        await onSaveBoundary({
          boundaryGeoJson: geoJson,
          area: calculatedAreaHa > 0 ? calculatedAreaHa : initialArea,
          areaUnit: 'hectares'
        });
      }

      setStatusMessage({
        text: 'Location, address components, and farm boundary saved successfully to PostgreSQL.',
        type: 'success'
      });
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : 'Failed to save location updates.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#DCE3DC] shadow-sm overflow-hidden flex flex-col">
      {/* Top Header & Search Bar */}
      <div className="p-4 sm:p-5 border-b border-[#DCE3DC] bg-[#FAFBF9] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1B4D3E]/10 flex items-center justify-center text-[#1B4D3E]">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-[#111C15]">
                Farm Geolocation & Boundary Studio
              </h3>
              <p className="text-xs text-[#4A5D50]">
                Interactive parcel mapping · GPS hardware accuracy · NASA dataset resolution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg border border-[#DCE3DC] text-[#4A5D50] hover:text-[#111C15] hover:bg-[#F0F4F1]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Address Search and GPS bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 relative">
          <form onSubmit={handleSearchSubmit} className="md:col-span-8 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#4A5D50] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search village, district, state, PIN code, or landmark..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#DCE3DC] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
              />
              {isSearching && (
                <Loader2 className="w-3.5 h-3.5 text-[#1B4D3E] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-3.5 py-2 rounded-xl bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#143B2F] disabled:opacity-50 whitespace-nowrap"
            >
              Search
            </button>
          </form>

          <button
            type="button"
            onClick={handleGetBrowserGps}
            disabled={gpsLoading}
            className="md:col-span-4 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#1B4D3E]/5 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {gpsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#1B4D3E]" />
            ) : (
              <Crosshair className="w-4 h-4 text-[#1B4D3E]" />
            )}
            <span>Use Browser GPS</span>
          </button>

          {/* Autocomplete Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-[1000] bg-white rounded-xl border border-[#DCE3DC] shadow-xl max-h-60 overflow-y-auto">
              <div className="px-3 py-2 text-[11px] font-semibold text-[#4A5D50] bg-[#FAFBF9] border-b border-[#DCE3DC]">
                Matching Locations
              </div>
              {searchResults.map((res, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectSearchResult(res)}
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-[#F6F8F5] border-b border-[#DCE3DC]/50 last:border-b-0 flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#1B4D3E] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[#111C15]">
                      {res.addressComponents?.village || res.addressComponents?.district || 'Location'}
                    </div>
                    <div className="text-[11px] text-[#4A5D50] line-clamp-1">{res.displayName}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Toolbar & Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5 p-1 bg-[#E8EFE9] rounded-xl border border-[#DCE3DC]">
            <button
              type="button"
              onClick={() => setEditorMode('pin')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                editorMode === 'pin'
                  ? 'bg-white text-[#1B4D3E] shadow-sm'
                  : 'text-[#4A5D50] hover:text-[#111C15]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Pinpoint Center</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('boundary')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                editorMode === 'boundary'
                  ? 'bg-white text-[#1B4D3E] shadow-sm'
                  : 'text-[#4A5D50] hover:text-[#111C15]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Draw Boundary ({boundaryPoints.length} pts)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {editorMode === 'boundary' && boundaryPoints.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleUndoVertex}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DCE3DC] text-[#4A5D50] hover:bg-white"
                  title="Undo last added boundary vertex"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearBoundary}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DCE3DC] text-[#DC2626] hover:bg-red-50"
                  title="Clear all boundary vertices"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setBaseLayer((prev) => (prev === 'street' ? 'satellite' : 'street'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DCE3DC] text-[#111C15] hover:bg-white bg-[#FAFBF9]"
            >
              <Layers className="w-3.5 h-3.5 text-[#1B4D3E]" />
              <span className="capitalize">{baseLayer === 'street' ? 'Satellite Imagery' : 'Street Map'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Container */}
      <div className={`relative w-full ${containerHeight} bg-[#E8EFE9]`}>
        <MapContainer
          center={[latitude, longitude]}
          zoom={boundaryPoints.length >= 3 ? 15 : 14}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <MapRecenter center={[latitude, longitude]} />
          <MapClickHandler mode={editorMode} onMapClick={handleMapClick} />

          <TileLayer
            attribution={
              baseLayer === 'satellite'
                ? 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
                : '&copy; OpenStreetMap contributors'
            }
            url={
              baseLayer === 'satellite'
                ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            }
          />

          {/* Draggable Center Pin */}
          <Marker
            position={[latitude, longitude]}
            draggable={!isReadOnly && editorMode === 'pin'}
            icon={centerMarkerIcon}
            eventHandlers={{
              dragend: (e) => {
                const pos = e.target.getLatLng();
                const lat = Math.round(pos.lat * 100000) / 100000;
                const lng = Math.round(pos.lng * 100000) / 100000;
                setLatitude(lat);
                setLongitude(lng);
                setLatInput(String(lat));
                setLonInput(String(lng));
                setGpsAccuracy(null);
              }
            }}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <div className="font-bold text-[#111C15]">{farmName}</div>
                <div className="font-mono text-[11px] text-[#4A5D50]">
                  {latitude.toFixed(5)}° N, {longitude.toFixed(5)}° E
                </div>
                <div className="text-[11px] text-[#1B4D3E]">
                  {editorMode === 'pin' ? 'Drag pin to adjust coordinate anchor' : 'Center pin'}
                </div>
              </div>
            </Popup>
          </Marker>

          {/* GPS Accuracy Circle (if acquired via device GPS) */}
          {gpsAccuracy != null && gpsAccuracy > 0 && (
            <Circle
              center={[latitude, longitude]}
              radius={gpsAccuracy}
              pathOptions={{
                color: '#2563EB',
                weight: 1.5,
                fillColor: '#3B82F6',
                fillOpacity: 0.12,
                dashArray: '4 4'
              }}
            />
          )}

          {/* Boundary Polygon */}
          {boundaryPoints.length >= 3 && (
            <Polygon
              positions={boundaryPoints}
              pathOptions={{
                color: '#1B4D3E',
                weight: 2.5,
                fillColor: '#2E7D32',
                fillOpacity: 0.25
              }}
            />
          )}

          {/* Boundary Vertex Pins */}
          {editorMode === 'boundary' &&
            boundaryPoints.map((pt, idx) => (
              <Marker key={idx} position={pt} icon={vertexMarkerIcon} />
            ))}
        </MapContainer>

        {/* Live HUD Overlay (Instruction badge) */}
        <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 border border-[#DCE3DC] shadow-md text-xs space-y-0.5 pointer-events-none">
          <div className="font-bold text-[#111C15] flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                editorMode === 'pin' ? 'bg-[#1B4D3E]' : 'bg-[#D97706] animate-pulse'
              }`}
            />
            <span>
              {editorMode === 'pin' ? 'Pinpoint Mode: Drag pin or click map' : 'Drawing Mode: Click to add vertices'}
            </span>
          </div>
          <div className="text-[11px] text-[#4A5D50]">
            {editorMode === 'boundary'
              ? `${boundaryPoints.length} vertex points · ${calculatedAreaHa} ha (${calculatedAreaAc} ac)`
              : `${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`}
          </div>
        </div>

        {/* Floating Area Card when polygon is drawn */}
        {boundaryPoints.length >= 3 && (
          <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-sm rounded-xl p-3 border border-[#DCE3DC] shadow-md text-xs">
            <div className="text-[11px] font-semibold text-[#4A5D50]">Calculated Parcel Area</div>
            <div className="text-base font-bold text-[#111C15] mt-0.5">
              {calculatedAreaHa} hectares <span className="text-xs font-normal text-[#4A5D50]">({calculatedAreaAc} acres)</span>
            </div>
          </div>
        )}
      </div>

      {/* Manual Coordinate Correction & Location Details */}
      <div className="p-4 sm:p-5 bg-white border-t border-[#DCE3DC] space-y-4">
        {/* Coordinate Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-[#111C15] mb-1">Latitude (°N)</label>
            <input
              type="number"
              step="0.00001"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              onBlur={handleManualCoordApply}
              disabled={isReadOnly}
              className="w-full px-3 py-2 rounded-lg border border-[#DCE3DC] font-mono font-medium focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#111C15] mb-1">Longitude (°E)</label>
            <input
              type="number"
              step="0.00001"
              value={lonInput}
              onChange={(e) => setLonInput(e.target.value)}
              onBlur={handleManualCoordApply}
              disabled={isReadOnly}
              className="w-full px-3 py-2 rounded-lg border border-[#DCE3DC] font-mono font-medium focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#111C15] mb-1">GPS Accuracy</label>
            <div className="px-3 py-2 rounded-lg border border-[#DCE3DC] bg-[#FAFBF9] text-[#4A5D50] flex items-center justify-between">
              <span>{gpsAccuracy != null ? `±${gpsAccuracy} m` : 'Manual / Geocoded'}</span>
              {gpsAccuracy != null && <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
            </div>
          </div>
          <div>
            <label className="block font-semibold text-[#111C15] mb-1">Elevation (SRTM)</label>
            <div className="px-3 py-2 rounded-lg border border-[#DCE3DC] bg-[#FAFBF9] text-[#4A5D50] flex items-center justify-between">
              <span>{elevation != null ? `${elevation} m ASL` : 'Calculating...'}</span>
              <Mountain className="w-3.5 h-3.5 text-[#1B4D3E]" />
            </div>
          </div>
        </div>

        {/* Resolved Address Banner */}
        <div className="rounded-xl bg-[#FAFBF9] border border-[#DCE3DC] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-[#1B4D3E] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[#111C15]">
                {resolvedAddress || `${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`}
              </div>
              <div className="text-[#4A5D50] text-[11px] mt-0.5 flex flex-wrap gap-x-3">
                {Boolean(addressComponents.village) && <span>Village: {String(addressComponents.village)}</span>}
                {Boolean(addressComponents.district) && <span>District: {String(addressComponents.district)}</span>}
                {Boolean(addressComponents.state) && <span>State: {String(addressComponents.state)}</span>}
                {Boolean(addressComponents.country) && <span>Country: {String(addressComponents.country)}</span>}
              </div>
            </div>
          </div>
          {isGeocoding && <span className="text-[11px] text-[#4A5D50] animate-pulse">Resolving address...</span>}
        </div>

        {/* CRITICAL DATA QUALITY NOTICE (Distinguishing GPS vs. NASA Resolution) */}
        <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-[#166534]">
            <Info className="w-4 h-4" />
            <span>Scientific Data Quality & Spatial Resolution Standards</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[#14532D]">
            <div>
              <span className="font-semibold">Device GPS Hardware Accuracy: </span>
              {gpsAccuracy != null ? `±${gpsAccuracy} meters` : 'High-precision coordinate pinning'}
              <p className="text-[11px] text-[#166534]/90 mt-0.5">
                Pinpoints your parcel boundary and centroid coordinates for site-specific record keeping.
              </p>
            </div>
            <div>
              <span className="font-semibold">NASA POWER Climatology Model: </span>
              0.5° × 0.625° (~55 km MERRA-2 Grid)
              <p className="text-[11px] text-[#166534]/90 mt-0.5">
                Regional meteorological observations; not plot-level microclimate sensor readings.
              </p>
            </div>
          </div>
        </div>

        {/* Live Climate Preview Card (if fetched) */}
        {previewClimate && (
          <div className="rounded-xl border border-[#DCE3DC] bg-[#FAFBF9] p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-[#111C15]">
              <span className="flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-500" />
                NASA Climate Baseline for Selected Coordinates
              </span>
              <span className="text-[11px] font-normal text-[#4A5D50]">{previewClimate.source}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2.5 rounded-lg bg-white border border-[#DCE3DC]">
                <div className="text-[11px] text-[#4A5D50]">Mean Temperature</div>
                <div className="text-sm font-bold text-[#111C15] mt-0.5">{previewClimate.temperature}°C</div>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-[#DCE3DC]">
                <div className="text-[11px] text-[#4A5D50]">Annual Rainfall</div>
                <div className="text-sm font-bold text-[#111C15] mt-0.5">{previewClimate.rainfall} mm</div>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-[#DCE3DC]">
                <div className="text-[11px] text-[#4A5D50]">Solar Radiation</div>
                <div className="text-sm font-bold text-[#111C15] mt-0.5">{previewClimate.radiation} MJ/m²</div>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-[#DCE3DC]">
                <div className="text-[11px] text-[#4A5D50]">Pillar Risk Score</div>
                <div className="text-sm font-bold text-[#1B4D3E] mt-0.5">
                  {previewClimate.riskScore}/100 ({previewClimate.riskLevel})
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feedback message */}
        {statusMessage && (
          <div
            className={`px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <Info className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleFetchPreviewClimate}
            disabled={loadingClimate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DCE3DC] text-xs font-semibold text-[#111C15] hover:bg-[#FAFBF9] transition-colors disabled:opacity-50"
          >
            {loadingClimate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudRain className="w-3.5 h-3.5 text-[#1B4D3E]" />}
            <span>Fetch NASA Environmental Preview</span>
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#143B2F] transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Confirm & Save Location</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
