import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  ScaleControl,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents
} from 'react-leaflet';
import {
  Crosshair,
  ExternalLink,
  Layers,
  LocateFixed,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Sprout,
  Target
} from 'lucide-react';
import type { Farm, RiskLevel } from '../../../shared/types/agri';

/* -------------------------------------------------------------------------- */
/*  Copy                                                                       */
/* -------------------------------------------------------------------------- */
type Lang = 'en' | 'hi';
type BaseLayer = 'street' | 'satellite' | 'hybrid';

const COPY = {
  en: {
    map: 'Map',
    satellite: 'Satellite',
    hybrid: 'Labels',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    recenter: 'Back to farm',
    locate: 'My location',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
    legend: 'Legend',
    boundary: 'Farm boundary',
    risk: 'Risk zone',
    grid: 'Regional NASA grid (8 km)',
    you: 'You are here',
    pick: 'Tap the map to set the farm location',
    area: 'Area',
    open: 'Open in Google Maps',
    blocked: 'Location is blocked in your browser settings.',
    failed: 'Could not find your location. Try again outdoors.',
    unsupported: 'This browser cannot share a location.',
    finding: 'Finding you…',
    accuracy: 'accuracy',
    levels: { Critical: 'Critical', High: 'High', Moderate: 'Moderate', Low: 'Low' } as Record<string, string>
  },
  hi: {
    map: 'नक्शा',
    satellite: 'उपग्रह',
    hybrid: 'नाम सहित',
    zoomIn: 'बड़ा करें',
    zoomOut: 'छोटा करें',
    recenter: 'खेत पर लौटें',
    locate: 'मेरी लोकेशन',
    fullscreen: 'पूरी स्क्रीन',
    exitFullscreen: 'पूरी स्क्रीन बंद करें',
    legend: 'संकेत',
    boundary: 'खेत की सीमा',
    risk: 'जोखिम क्षेत्र',
    grid: 'NASA क्षेत्रीय ग्रिड (8 किमी)',
    you: 'आप यहाँ हैं',
    pick: 'खेत की जगह चुनने के लिए नक्शे पर टैप करें',
    area: 'क्षेत्रफल',
    open: 'Google Maps में खोलें',
    blocked: 'ब्राउज़र सेटिंग में लोकेशन बंद है।',
    failed: 'आपकी लोकेशन नहीं मिली। खुले में दोबारा कोशिश करें।',
    unsupported: 'यह ब्राउज़र लोकेशन साझा नहीं कर सकता।',
    finding: 'लोकेशन खोज रहे हैं…',
    accuracy: 'सटीकता',
    levels: { Critical: 'गंभीर', High: 'उच्च', Moderate: 'मध्यम', Low: 'कम' } as Record<string, string>
  }
};

/* -------------------------------------------------------------------------- */
/*  Icons                                                                      */
/* -------------------------------------------------------------------------- */
const farmIcon = L.divIcon({
  className: 'agm-icon',
  html: `<div class="agm-pin"><span class="agm-pin-ring"></span><span class="agm-pin-ring r2"></span><span class="agm-pin-dot"></span></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -14]
});

const pickIcon = L.divIcon({
  className: 'agm-icon',
  html: `<div class="agm-pick"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */
const STYLES = `
.agm { --agm-forest:#1F3D2B; --agm-marigold:#E8A317; --agm-ease:cubic-bezier(.22,1,.36,1);
  font-family:'Public Sans','Noto Sans Devanagari',system-ui,sans-serif; isolation:isolate;
  box-shadow:0 20px 44px -24px rgba(20,45,28,.6), inset 0 0 0 1px rgba(255,255,255,.6); }
.agm.agm-fs { position:fixed; inset:0; z-index:9999; width:100vw; height:100vh; height:100dvh; border-radius:0 !important; }
.agm .leaflet-container { width:100%; height:100%; background:#DDE8DC; font-family:inherit; }
.agm.agm-pick .leaflet-container { cursor:crosshair; }

/* glass */
.agm-glass { background:linear-gradient(145deg,rgba(255,255,255,.72),rgba(255,255,255,.4));
  backdrop-filter:blur(16px) saturate(180%); -webkit-backdrop-filter:blur(16px) saturate(180%);
  border:1px solid rgba(255,255,255,.75); box-shadow:0 12px 28px -14px rgba(15,40,25,.55), inset 0 1px 0 rgba(255,255,255,.9);
  color:#1B2A20; }
.agm-ui { position:absolute; z-index:1000; }

/* control buttons */
.agm-btn { display:grid; place-items:center; width:38px; height:38px; color:var(--agm-forest); transition:background .2s ease, color .2s ease, transform .2s ease;
  touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
.agm-btn:hover { background:rgba(31,61,43,.1); }
.agm-btn:active { transform:scale(.94); }
.agm-btn:focus-visible, .agm-seg button:focus-visible, .agm-legend-head:focus-visible { outline:2px solid var(--agm-marigold); outline-offset:-2px; }
.agm-btn[aria-pressed='true'] { background:var(--agm-forest); color:#FBF7EC; }
.agm-stack { display:flex; flex-direction:column; border-radius:12px; overflow:hidden; }
.agm-stack .agm-btn + .agm-btn { border-top:1px solid rgba(31,61,43,.12); }
@media (pointer:coarse) { .agm-btn { width:44px; height:44px; } }

/* segmented layer switch */
.agm-seg { display:inline-flex; padding:3px; border-radius:999px; gap:2px; }
.agm-seg button { padding:.32rem .75rem; border-radius:999px; font-size:11.5px; font-weight:600; color:var(--agm-forest); transition:background .25s ease, color .25s ease; touch-action:manipulation; }
.agm-seg button[aria-pressed='true'] { background:var(--agm-forest); color:#FBF7EC; box-shadow:0 4px 10px -4px rgba(15,40,25,.7); }

/* farm chip, legend, readout, toast */
.agm-chip { border-radius:14px; padding:.55rem .8rem; max-width:min(78%,300px); }
.agm-legend { border-radius:14px; font-size:11.5px; min-width:170px; max-width:230px; overflow:hidden; }
.agm-legend-head { width:100%; display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:.45rem .7rem; font-weight:600; font-size:11.5px; }
.agm-legend-body { padding:.1rem .7rem .6rem; display:grid; gap:.35rem; }
.agm-swatch { display:inline-block; width:14px; height:10px; border-radius:3px; margin-right:.5rem; flex:none; }
.agm-readout { border-radius:999px; padding:.22rem .65rem; font-size:10.5px; font-variant-numeric:tabular-nums; color:#2F4A3A; }
.agm-toast { border-radius:12px; padding:.5rem .8rem; font-size:12px; display:flex; align-items:center; gap:.5rem; animation:agmRise .45s var(--agm-ease) both; }

/* loading shimmer */
.agm-loading { position:absolute; inset:0; z-index:900; pointer-events:none; transition:opacity .7s ease;
  background:linear-gradient(110deg,#DDE8DC 30%,#EEF3E9 45%,#DDE8DC 60%); background-size:220% 100%; animation:agmShimmer 1.4s linear infinite; }
.agm-loading.done { opacity:0; }

/* markers */
.agm-icon { background:none !important; border:0 !important; }
.agm-pin { position:relative; width:30px; height:30px; display:grid; place-items:center; }
.agm-pin-dot { width:18px; height:18px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#F3C85B,#E8A317 55%,#C7881C);
  border:3px solid #fff; box-shadow:0 3px 8px rgba(0,0,0,.4); position:relative; z-index:2; }
.agm-pin-ring { position:absolute; inset:2px; border-radius:50%; border:2px solid #E8A317; opacity:0; animation:agmPulse 2.4s var(--agm-ease) infinite; }
.agm-pin-ring.r2 { animation-delay:1.2s; }
.agm-pick { width:22px; height:22px; border-radius:50%; border:3px solid #fff; background:#B5482A; box-shadow:0 0 0 4px rgba(181,72,42,.3), 0 3px 8px rgba(0,0,0,.4); }
.agm-me { width:16px; height:16px; }
.agm-me-dot { width:16px; height:16px; border-radius:50%; background:#2F7DD1; border:3px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,.4); }

/* map shapes */
path.agm-boundary { stroke-dasharray:8 6; animation:agmDash 1.6s linear infinite; }
path.agm-risk { animation:agmRisk 3.2s ease-in-out infinite; }

/* popup */
.agm .leaflet-popup-content-wrapper { background:linear-gradient(145deg,rgba(255,255,255,.86),rgba(251,247,236,.7)); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,.85); border-radius:14px; box-shadow:0 18px 36px -16px rgba(15,40,25,.6); color:#1B2A20; }
.agm .leaflet-popup-tip { background:rgba(251,247,236,.85); }
.agm .leaflet-popup-content { margin:.7rem .85rem; }
.agm .leaflet-popup-close-button { color:#4A5D50; }
.agm .leaflet-tooltip.agm-area { background:rgba(255,255,255,.78); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,.9); border-radius:999px;
  color:#1F3D2B; font-weight:600; font-size:11px; padding:.15rem .6rem; box-shadow:0 6px 14px -8px rgba(15,40,25,.6); }
.agm .leaflet-tooltip.agm-area::before { display:none; }

/* leaflet built-ins, restyled */
.agm .leaflet-control-attribution { background:rgba(255,255,255,.65) !important; backdrop-filter:blur(8px); border-radius:8px 0 0 0; font-size:10px; color:#3C4B40; }
.agm .leaflet-control-attribution a { color:#1F3D2B; }
.agm .leaflet-control-scale-line { background:rgba(255,255,255,.65); backdrop-filter:blur(8px); border-color:#1F3D2B; color:#1F3D2B; font-size:10px; border-radius:0 0 4px 4px; }
.agm .leaflet-bottom.leaflet-left { margin-bottom:0; }

@keyframes agmPulse { 0% { transform:scale(.6); opacity:.9; } 100% { transform:scale(1.9); opacity:0; } }
@keyframes agmDash { to { stroke-dashoffset:-28; } }
@keyframes agmRisk { 0%,100% { fill-opacity:.12; } 50% { fill-opacity:.26; } }
@keyframes agmShimmer { to { background-position:-220% 0; } }
@keyframes agmRise { from { opacity:0; transform:translate3d(0,10px,0); } to { opacity:1; transform:none; } }

@media (max-width:480px) { .agm-chip { max-width:70%; } .agm-legend { min-width:150px; } }
@media (prefers-reduced-motion:reduce) {
  .agm-pin-ring, path.agm-boundary, path.agm-risk, .agm-loading, .agm-toast { animation:none !important; }
  .agm-btn, .agm-seg button { transition:none; }
}
`;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const fmtLat = (v: number) => `${Math.abs(v).toFixed(5)}° ${v >= 0 ? 'N' : 'S'}`;
const fmtLng = (v: number) => `${Math.abs(v).toFixed(5)}° ${v >= 0 ? 'E' : 'W'}`;

function extractPolygonLatLngs(farm: Farm): [number, number][] {
  const geo = farm.boundaryGeoJson;
  if (!geo) return [];
  const coords = geo.geometry?.coordinates?.[0] || geo.coordinates?.[0];
  if (!Array.isArray(coords)) return [];
  return coords
    .filter((pt) => Array.isArray(pt) && pt.length >= 2)
    .map(([lng, lat]) => [lat, lng] as [number, number]);
}

function centroid(pts: [number, number][]): [number, number] {
  const ring = pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? pts.slice(0, -1) : pts;
  const n = ring.length || 1;
  return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
}

const RISK_COLORS: Record<string, string> = {
  Critical: '#DC2626',
  High: '#EA580C',
  Moderate: '#D97706',
  Low: '#16A34A'
};

/* -------------------------------------------------------------------------- */
/*  Map helpers (must render inside <MapContainer>)                            */
/* -------------------------------------------------------------------------- */
function RecenterController({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      map.setView([lat, lng], zoom, { animate: false });
    } else {
      map.flyTo([lat, lng], zoom, { duration: 0.8 });
    }
  }, [lat, lng, zoom, map]);
  return null;
}

function ClickSelector({ onSelectPoint }: { onSelectPoint?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onSelectPoint) {
        onSelectPoint(Math.round(e.latlng.lat * 100000) / 100000, Math.round(e.latlng.lng * 100000) / 100000);
      }
    }
  });
  return null;
}

/** Keeps tiles correct when the container resizes (fullscreen, responsive layouts). */
function SizeSync({ trigger }: { trigger: boolean }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [map]);
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize({ animate: false }), 250);
    return () => window.clearTimeout(id);
  }, [trigger, map]);
  return null;
}

/** Live pointer coordinates. Isolated so mouse moves never re-render the whole map. */
function CoordReadout() {
  const [pt, setPt] = useState<{ lat: number; lng: number } | null>(null);
  const raf = useRef(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
    }
  }, []);
  useMapEvents({
    mousemove(e) {
      const { lat, lng } = e.latlng;
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => setPt({ lat, lng }));
    },
    mouseout() {
      cancelAnimationFrame(raf.current);
      setPt(null);
    }
  });
  if (!pt) return null;
  return (
    <div ref={ref} className="agm-ui agm-glass agm-readout hidden sm:block" style={{ left: 12, bottom: 78 }}>
      {fmtLat(pt.lat)} · {fmtLng(pt.lng)}
    </div>
  );
}

/** Wraps overlay UI so clicks, drags and wheel never reach the map underneath. */
function Overlay({ className = '', style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

interface ControlsProps {
  farm: Farm;
  zoom: number;
  lang: Lang;
  isFs: boolean;
  onToggleFs: () => void;
  onLocated: (pos: { lat: number; lng: number; accuracy: number }) => void;
  onLocError: (msg: string | null) => void;
  locating: boolean;
  setLocating: (v: boolean) => void;
}

function Controls({ farm, zoom, lang, isFs, onToggleFs, onLocated, onLocError, locating, setLocating }: ControlsProps) {
  const map = useMap();
  const t = COPY[lang];

  const locate = () => {
    onLocError(null);
    if (!('geolocation' in navigator)) {
      onLocError(t.unsupported);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) };
        onLocated(pos);
        map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 15), { duration: 1.2 });
      },
      (err) => {
        setLocating(false);
        onLocError(err.code === err.PERMISSION_DENIED ? t.blocked : t.failed);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  return (
    <Overlay className="agm-ui agm-glass agm-stack" style={{ top: 12, right: 12 }}>
      <button type="button" className="agm-btn" onClick={() => map.zoomIn()} aria-label={t.zoomIn} title={t.zoomIn}>
        <Plus className="w-4 h-4" />
      </button>
      <button type="button" className="agm-btn" onClick={() => map.zoomOut()} aria-label={t.zoomOut} title={t.zoomOut}>
        <Minus className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="agm-btn"
        onClick={() => map.flyTo([farm.latitude, farm.longitude], zoom, { duration: 0.9 })}
        aria-label={t.recenter}
        title={t.recenter}
      >
        <Target className="w-4 h-4" />
      </button>
      <button type="button" className="agm-btn" onClick={locate} aria-label={t.locate} title={t.locate} disabled={locating}>
        {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
      </button>
      <button
        type="button"
        className="agm-btn"
        onClick={onToggleFs}
        aria-pressed={isFs}
        aria-label={isFs ? t.exitFullscreen : t.fullscreen}
        title={isFs ? t.exitFullscreen : t.fullscreen}
      >
        {isFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </Overlay>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */
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
  /** Hide the glass controls, layer switch, legend and farm chip for a bare map. */
  showControls?: boolean;
  /** Label language for the map UI. */
  lang?: Lang;
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
  onPickLocation,
  showControls = true,
  lang = 'en'
}: FarmLeafletMapProps) {
  const t = COPY[lang];
  const wrapRef = useRef<HTMLDivElement>(null);

  const [layer, setLayer] = useState<BaseLayer>(baseLayer);
  useEffect(() => setLayer(baseLayer), [baseLayer]);

  const [ready, setReady] = useState(false);
  const [legendOpen, setLegendOpen] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia('(min-width: 640px)').matches));
  const [nativeFs, setNativeFs] = useState(false);
  const [fallbackFs, setFallbackFs] = useState(false);
  const isFs = nativeFs || fallbackFs;

  const [me, setMe] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [picked, setPicked] = useState<[number, number] | null>(null);

  const polygonCoords = useMemo(() => extractPolygonLatLngs(farm), [farm]);
  const labelPoint = useMemo(() => (polygonCoords.length >= 3 ? centroid(polygonCoords) : null), [polygonCoords]);
  const zoom = showRegionalGridOverlay ? 11 : 15;
  const riskColor = RISK_COLORS[riskLevel] || RISK_COLORS.Low;

  const meIcon = useMemo(
    () => L.divIcon({ className: 'agm-icon', html: '<div class="agm-me"><div class="agm-me-dot"></div></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
    []
  );

  /* Fullscreen: native API where available, fixed-position fallback (e.g. iPhone Safari). */
  useEffect(() => {
    const onChange = () => setNativeFs(!!document.fullscreenElement && document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!fallbackFs) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFallbackFs(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [fallbackFs]);

  const toggleFs = async () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (fallbackFs) {
      setFallbackFs(false);
      return;
    }
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* fall through to the CSS fallback */
      }
    }
    setFallbackFs(true);
  };

  useEffect(() => {
    if (!locMsg) return;
    const id = window.setTimeout(() => setLocMsg(null), 5000);
    return () => window.clearTimeout(id);
  }, [locMsg]);

  const tiles: Record<BaseLayer, { url: string; attribution: string; maxNativeZoom: number }> = {
    street: { url: 'https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png'.replace('{y}/{x}', '{x}/{y}').replace('{z}/{x}/{y}', '{z}/{x}/{y}'), attribution: '&copy; OpenStreetMap contributors', maxNativeZoom: 19 },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
      maxNativeZoom: 18
    },
    hybrid: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
      maxNativeZoom: 18
    }
  };
  const active = tiles[layer];

  const legendItems: { color: string; label: string; dashed?: boolean }[] = [];
  if (showBoundary && polygonCoords.length >= 3) legendItems.push({ color: '#1B4D3E', label: t.boundary, dashed: true });
  if (showRiskZoneOverlay) legendItems.push({ color: riskColor, label: `${t.risk}: ${t.levels[riskLevel] || riskLevel}` });
  if (showRegionalGridOverlay) legendItems.push({ color: '#0284C7', label: t.grid, dashed: true });

  const sizeClass = isFs ? 'agm-fs' : `${heightClass} rounded-xl`;

  return (
    <div
      ref={wrapRef}
      className={`agm w-full ${sizeClass} overflow-hidden bg-[#E8EFE9] relative ${interactivePick ? 'agm-pick' : ''}`}
      role="region"
      aria-label={`${t.map}: ${farm.name}`}
    >
      <style>{STYLES}</style>

      <MapContainer
        center={[farm.latitude, farm.longitude]}
        zoom={zoom}
        maxZoom={19}
        scrollWheelZoom={true}
        zoomControl={false}
        zoomSnap={0.5}
        className="w-full h-full"
      >
        <RecenterController lat={farm.latitude} lng={farm.longitude} zoom={zoom} />
        <SizeSync trigger={isFs} />
        {interactivePick && (
          <ClickSelector
            onSelectPoint={(lat, lng) => {
              setPicked([lat, lng]);
              onPickLocation?.(lat, lng);
            }}
          />
        )}

        <TileLayer
          key={layer}
          attribution={active.attribution}
          url={active.url}
          maxNativeZoom={active.maxNativeZoom}
          maxZoom={19}
          keepBuffer={4}
          eventHandlers={{ load: () => setReady(true) }}
        />
        {layer === 'hybrid' && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={18}
            maxZoom={19}
          />
        )}

        <ScaleControl position="bottomleft" imperial={false} />

        <Marker position={[farm.latitude, farm.longitude]} icon={farmIcon}>
          <Popup>
            <div className="text-xs space-y-1.5 min-w-[190px]">
              <div className="flex items-center gap-1.5 font-semibold text-[#111C15] text-sm">
                <Sprout className="w-4 h-4 text-[#2E7D4F]" />
                <span>{farm.name}</span>
              </div>
              <div className="text-[#4A5D50]">
                {farm.district}, {farm.state}
              </div>
              <div className="font-mono text-[11px] text-[#1B2A20]">
                {fmtLat(farm.latitude)}, {fmtLng(farm.longitude)}
              </div>
              <div>
                {t.area}: {farm.area} {farm.areaUnit} · {farm.currentCrops.join(' → ')}
              </div>
              <a
                href={`https://www.google.com/maps?q=${farm.latitude},${farm.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#1F3D2B] hover:underline pt-0.5"
              >
                <ExternalLink className="w-3 h-3" />
                {t.open}
              </a>
            </div>
          </Popup>
        </Marker>

        {showBoundary && polygonCoords.length >= 3 && (
          <Polygon
            positions={polygonCoords}
            pathOptions={{
              className: 'agm-boundary',
              color: layer === 'street' ? '#1B4D3E' : '#FFD25F',
              weight: 2.5,
              fillColor: '#2E7D32',
              fillOpacity: 0.22
            }}
          >
            {labelPoint && (
              <Tooltip permanent direction="center" className="agm-area" opacity={1}>
                {farm.area} {farm.areaUnit}
              </Tooltip>
            )}
          </Polygon>
        )}

        {showRiskZoneOverlay && (
          <Circle
            center={[farm.latitude, farm.longitude]}
            radius={650}
            pathOptions={{
              className: 'agm-risk',
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

        {me && (
          <>
            <Circle
              center={[me.lat, me.lng]}
              radius={Math.max(me.accuracy, 5)}
              pathOptions={{ color: '#2F7DD1', weight: 1, fillColor: '#2F7DD1', fillOpacity: 0.14 }}
            />
            <Marker position={[me.lat, me.lng]} icon={meIcon}>
              <Tooltip direction="top" offset={[0, -8]}>
                {t.you} · {t.accuracy} ±{me.accuracy} m
              </Tooltip>
            </Marker>
          </>
        )}

        {interactivePick && picked && <Marker position={picked} icon={pickIcon} interactive={false} />}
        {interactivePick && picked && <CircleMarker center={picked} radius={0} pathOptions={{ opacity: 0 }} />}

        {showControls && (
          <>
            <Controls
              farm={farm}
              zoom={zoom}
              lang={lang}
              isFs={isFs}
              onToggleFs={toggleFs}
              onLocated={setMe}
              onLocError={setLocMsg}
              locating={locating}
              setLocating={setLocating}
            />
            <CoordReadout />

            {/* Farm chip */}
            <Overlay className="agm-ui agm-glass agm-chip" style={{ top: 12, left: 12 }}>
              <div className="flex items-center gap-2">
                <Sprout className="w-4 h-4 text-[#2E7D4F] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold leading-tight truncate">{farm.name}</div>
                  <div className="text-[11px] text-[#3C4B40] truncate">
                    {farm.district}, {farm.state} · {farm.area} {farm.areaUnit}
                  </div>
                </div>
              </div>
            </Overlay>

            {/* Layer switch */}
            <Overlay className="agm-ui agm-glass agm-seg" style={{ left: 12, bottom: 30 }}>
              <Layers className="w-3.5 h-3.5 self-center ml-2 mr-1 text-[#1F3D2B] hidden min-[420px]:block" aria-hidden="true" />
              {(['street', 'satellite', 'hybrid'] as BaseLayer[]).map((k) => (
                <button key={k} type="button" aria-pressed={layer === k} onClick={() => setLayer(k)}>
                  {k === 'street' ? t.map : k === 'satellite' ? t.satellite : t.hybrid}
                </button>
              ))}
            </Overlay>

            {/* Legend */}
            {legendItems.length > 0 && (
              <Overlay className="agm-ui agm-glass agm-legend" style={{ right: 12, bottom: 30 }}>
                <button type="button" className="agm-legend-head" onClick={() => setLegendOpen(!legendOpen)} aria-expanded={legendOpen}>
                  <span>{t.legend}</span>
                  <span aria-hidden="true">{legendOpen ? '–' : '+'}</span>
                </button>
                {legendOpen && (
                  <div className="agm-legend-body">
                    {legendItems.map((i) => (
                      <div key={i.label} className="flex items-center">
                        <span
                          className="agm-swatch"
                          style={{
                            background: i.dashed ? 'transparent' : `${i.color}66`,
                            border: `2px ${i.dashed ? 'dashed' : 'solid'} ${i.color}`
                          }}
                        />
                        <span>{i.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Overlay>
            )}

            {/* Pick hint */}
            {interactivePick && (
              <Overlay className="agm-ui agm-glass agm-toast" style={{ left: '50%', top: 12, transform: 'translateX(-50%)' }}>
                <Crosshair className="w-4 h-4 text-[#B5482A]" />
                <span className="whitespace-nowrap">{t.pick}</span>
              </Overlay>
            )}

            {/* Location status */}
            {(locating || locMsg) && (
              <Overlay className="agm-ui agm-glass agm-toast" style={{ left: 12, top: 64 }}>
                {locating ? <Loader2 className="w-4 h-4 animate-spin text-[#1F3D2B]" /> : <LocateFixed className="w-4 h-4 text-[#B5482A]" />}
                <span>{locating ? t.finding : locMsg}</span>
              </Overlay>
            )}
          </>
        )}
      </MapContainer>

      <div className={`agm-loading ${ready ? 'done' : ''}`} aria-hidden="true" />
    </div>
  );
}