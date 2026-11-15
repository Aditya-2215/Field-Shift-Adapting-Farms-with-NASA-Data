import { useEffect } from 'react';
import L from 'leaflet';
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  useMap,
  useMapEvents
} from 'react-leaflet';
import type { Farm, RiskLevel } from '../../../shared/types/agri';

const pinIcon = L.divIcon({
  className: 'agrishift-map-pin',
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#1B4D3E;border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

function RecenterController({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: false });
  }, [lat, lng, zoom, map]);
  return null;
}

function ClickSelector({ onSelectPoint }: { onSelectPoint?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onSelectPoint) {
        onSelectPoint(
          Math.round(e.latlng.lat * 100000) / 100000,
          Math.round(e.latlng.lng * 100000) / 100000
        );
      }
    }
  });
  return null;
}

function extractPolygonLatLngs(farm: Farm): [number, number][] {
  const geo = farm.boundaryGeoJson;
  if (!geo) return [];
  const coords = geo.geometry?.coordinates?.[0] || geo.coordinates?.[0];
  if (!Array.isArray(coords)) return [];
  return coords
    .filter((pt) => Array.isArray(pt) && pt.length >= 2)
    .map(([lng, lat]) => [lat, lng] as [number, number]);
}

export interface FarmLeafletMapProps {
  farm: Farm;
  heightClass?: string;
  baseLayer?: 'street' | 'satellite';
  showBoundary?: boolean;
  showRegionalGridOverlay?: boolean;
  showRiskZoneOverlay?: boolean;
  overlayOpacity?: number;
  riskLevel?: RiskLevel;
  interactivePick?: boolean;
  onPickLocation?: (lat: number, lng: number) => void;
}

export function FarmLeafletMap({
  farm,
  heightClass = 'h-96',
  baseLayer = 'street',
  showBoundary = true,
  showRegionalGridOverlay = false,
  showRiskZoneOverlay = false,
  overlayOpacity = 0.45,
  riskLevel = 'Moderate',
  interactivePick = false,
  onPickLocation
}: FarmLeafletMapProps) {
  const polygonCoords = extractPolygonLatLngs(farm);

  const riskColor =
    riskLevel === 'Critical'
      ? '#DC2626'
      : riskLevel === 'High'
      ? '#EA580C'
      : riskLevel === 'Moderate'
      ? '#D97706'
      : '#16A34A';

  const tileUrl =
    baseLayer === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const attribution =
    baseLayer === 'satellite'
      ? 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
      : '&copy; OpenStreetMap contributors';

  return (
    <div className={`w-full ${heightClass} rounded-xl overflow-hidden border border-[#DCE3DC] bg-[#E8EFE9] relative`}>
      <MapContainer
        center={[farm.latitude, farm.longitude]}
        zoom={showRegionalGridOverlay ? 11 : 15}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <RecenterController
          lat={farm.latitude}
          lng={farm.longitude}
          zoom={showRegionalGridOverlay ? 11 : 15}
        />
        {interactivePick && <ClickSelector onSelectPoint={onPickLocation} />}

        <TileLayer attribution={attribution} url={tileUrl} />

        <Marker position={[farm.latitude, farm.longitude]} icon={pinIcon}>
          <Popup>
            <div className="text-xs space-y-1 min-w-[180px]">
              <div className="font-semibold text-[#111C15]">{farm.name}</div>
              <div className="text-[#4A5D50]">
                {farm.district}, {farm.state}
              </div>
              <div className="font-mono text-[11px]">
                {farm.latitude.toFixed(4)}° N, {farm.longitude.toFixed(4)}° E
              </div>
              <div>
                Area: {farm.area} {farm.areaUnit} · {farm.currentCrops.join(' → ')}
              </div>
            </div>
          </Popup>
        </Marker>

        {showBoundary && polygonCoords.length >= 3 && (
          <Polygon
            positions={polygonCoords}
            pathOptions={{
              color: '#1B4D3E',
              weight: 2.5,
              fillColor: '#2E7D32',
              fillOpacity: 0.22
            }}
          />
        )}

        {showRiskZoneOverlay && (
          <Circle
            center={[farm.latitude, farm.longitude]}
            radius={650}
            pathOptions={{
              color: riskColor,
              weight: 1.5,
              fillColor: riskColor,
              fillOpacity: overlayOpacity * 0.45
            }}
          />
        )}

        {showRegionalGridOverlay && (
          <Circle
            center={[farm.latitude, farm.longitude]}
            radius={8000}
            pathOptions={{
              color: '#0284C7',
              weight: 1.5,
              dashArray: '6 4',
              fillColor: '#0284C7',
              fillOpacity: overlayOpacity * 0.25
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
