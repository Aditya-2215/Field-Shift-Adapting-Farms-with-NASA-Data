import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRight, CloudRain, FileCheck2, FlaskConical, Landmark, LocateFixed, MapPin, Phone, RefreshCw, Smartphone, Wheat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from '../components/auth/AuthModal';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const cv = (vars: Record<string, string | number>, extra: CSSProperties = {}): CSSProperties =>
  ({ ...extra, ...vars } as CSSProperties);

const seeded = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const balance = { textWrap: 'balance' } as CSSProperties;

/* -------------------------------------------------------------------------- */
/*  Live location (browser geolocation + OpenStreetMap reverse geocoding)      */
/* -------------------------------------------------------------------------- */
type LocationStatus = 'idle' | 'locating' | 'naming' | 'ready' | 'denied' | 'unavailable' | 'error';

interface UserLocation {
  status: LocationStatus;
  lat: number | null;
  lon: number | null;
  accuracyM: number | null;
  placeName: string | null;
  retry: () => void;
}

const LOCATION_CACHE_KEY = 'agrishift:location:v1';

const readLocationCache = () => {
  try {
    const raw = sessionStorage.getItem(LOCATION_CACHE_KEY);
    return raw
      ? (JSON.parse(raw) as { lat: number; lon: number; accuracyM: number | null; placeName: string | null })
      : null;
  } catch {
    return null;
  }
};

const writeLocationCache = (v: object) => {
  try {
    sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable: fine */
  }
};

async function reverseGeocode(lat: number, lon: number, signal: AbortSignal): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&addressdetails=1&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('geocode failed');
  const data = await res.json();
  const a = data.address ?? {};
  const locality = a.city || a.town || a.village || a.suburb || a.county || a.state_district;
  const parts = [locality, a.state, a.country].filter(Boolean);
  return parts.length ? parts.join(', ') : data.display_name ?? null;
}

function useUserLocation(): UserLocation {
  const [state, setState] = useState<Omit<UserLocation, 'retry'>>({
    status: 'idle',
    lat: null,
    lon: null,
    accuracyM: null,
    placeName: null,
  });
  const [nonce, setNonce] = useState(0);

  const retry = useCallback(() => {
    try {
      sessionStorage.removeItem(LOCATION_CACHE_KEY);
    } catch {
      /* ignore */
    }
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState((s) => ({ ...s, status: 'unavailable' }));
      return;
    }

    const cached = readLocationCache();
    if (cached) {
      setState({ status: 'ready', ...cached });
      return;
    }

    const ctrl = new AbortController();
    let cancelled = false;
    setState({ status: 'locating', lat: null, lon: null, accuracyM: null, placeName: null });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return;
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        const base = { lat, lon, accuracyM: Math.round(accuracy), placeName: null as string | null };
        setState({ status: 'naming', ...base });
        try {
          const placeName = await reverseGeocode(lat, lon, ctrl.signal);
          if (cancelled) return;
          const done = { ...base, placeName };
          writeLocationCache(done);
          setState({ status: 'ready', ...done });
        } catch {
          if (cancelled) return;
          setState({ status: 'ready', ...base });
        }
      },
      (err) => {
        if (cancelled) return;
        setState((s) => ({ ...s, status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error' }));
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 }
    );

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [nonce]);

  return { ...state, retry };
}

const fmtCoord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;

function LocationCard({ loc, className = '', title = 'Your location' }: { loc: UserLocation; className?: string; title?: string }) {
  const { status, lat, lon, accuracyM, placeName, retry } = loc;
  const busy = status === 'locating' || status === 'naming' || status === 'idle';
  const hasFix = lat !== null && lon !== null;

  return (
    <div className={`glass loc-card rounded-2xl px-4 py-3.5 ${className}`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className={`loc-pin ${busy ? 'is-busy' : ''}`} aria-hidden="true">
          {hasFix ? <MapPin className="w-4 h-4" /> : <LocateFixed className="w-4 h-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#2F4A3A]">{title}</p>

          {busy && !hasFix && <p className="text-sm text-[#24392C] mt-0.5">Finding you… allow location access if your browser asks.</p>}
          {status === 'denied' && <p className="text-sm text-[#24392C] mt-0.5">Location is blocked. Allow it in your browser’s site settings, then try again.</p>}
          {status === 'unavailable' && <p className="text-sm text-[#24392C] mt-0.5">This browser can’t share a location.</p>}
          {status === 'error' && <p className="text-sm text-[#24392C] mt-0.5">Couldn’t get a position fix. Check your connection and try again.</p>}

          {hasFix && (
            <>
              <p className="f-serif text-base leading-snug text-[#14261B] mt-0.5 break-words">
                {placeName ?? (status === 'naming' ? 'Looking up place name…' : 'Place name unavailable')}
              </p>
              <p className="text-xs text-[#2F4A3A] num mt-1">
                {fmtCoord(lat!, 'N', 'S')} · {fmtCoord(lon!, 'E', 'W')}
                {accuracyM !== null && (
                  <span className="text-[#55634F]"> · ±{accuracyM >= 1000 ? `${(accuracyM / 1000).toFixed(1)} km` : `${accuracyM} m`}</span>
                )}
              </p>
            </>
          )}
        </div>

        {(status === 'denied' || status === 'error' || status === 'ready') && (
          <button type="button" onClick={retry} className="loc-retry" aria-label="Refresh my location" title="Refresh my location">
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Real OpenStreetMap embed centred on the visitor. No placeholder coordinates. */
function LiveMap({ loc }: { loc: UserLocation }) {
  const { lat, lon, status } = loc;
  if (lat === null || lon === null) {
    return (
      <div className="map-empty grid place-items-center text-center px-6">
        <div>
          <span className="loc-pin mx-auto mb-3" aria-hidden="true"><LocateFixed className="w-4 h-4" /></span>
          <p className="f-serif text-lg text-[#14261B]">Your map appears here</p>
          <p className="text-sm text-[#44544A] mt-1 max-w-xs mx-auto">
            {status === 'denied'
              ? 'Location is blocked. Allow it in your browser, then refresh your location.'
              : 'Allow location access and we will centre the map on where you are standing.'}
          </p>
        </div>
      </div>
    );
  }
  const d = 0.012;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
  return <iframe title="Map centred on your location" src={src} loading="lazy" className="w-full h-full border-0" referrerPolicy="no-referrer" />;
}

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */
type SeasonKey = 'kharif' | 'rabi' | 'zaid';

const SEASONS: Record<SeasonKey, { name: string; deva: string; window: string; months: number; crops: string[]; note: string; color: string }> = {
  kharif: {
    name: 'Kharif', deva: 'खरीफ', window: 'June to October', months: 5, crops: ['Rice', 'Maize'],
    note: 'Sown with the monsoon. What matters most is how much rain actually arrives, and whether the field drains when it does.',
    color: '#5E9C5A',
  },
  rabi: {
    name: 'Rabi', deva: 'रबी', window: 'November to March', months: 5, crops: ['Wheat', 'Chickpea', 'Mustard'],
    note: 'The cool-season crops. They live off moisture left in the soil plus whatever irrigation you can spare.',
    color: '#D9A441',
  },
  zaid: {
    name: 'Zaid', deva: 'जायद', window: 'April to May', months: 2, crops: ['Green Gram', 'Black Gram'],
    note: 'A short, hot gap between Rabi harvest and the next monsoon. Heat stress and a quick turnaround decide what fits.',
    color: '#CF7A3E',
  },
};

const SEASON_ORDER: SeasonKey[] = ['kharif', 'rabi', 'zaid'];
const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];

const currentSeasonFromDate = (d = new Date()): SeasonKey => {
  const m = d.getMonth();
  if (m >= 5 && m <= 9) return 'kharif';
  if (m === 3 || m === 4) return 'zaid';
  return 'rabi';
};

const DATASETS = [
  { id: 'POWER', name: 'NASA POWER', res: 55000, grid: '0.5° × 0.625°', gives: 'Daily temperature, rainfall, humidity and solar radiation', access: 'Live' },
  { id: 'SMAP', name: 'SMAP', res: 9000, grid: 'about 9 km', gives: 'Regional soil moisture', access: 'Needs Earthdata token' },
  { id: 'GPM', name: 'GPM', res: 10000, grid: 'about 10 km', gives: 'Satellite rainfall estimates', access: 'Needs Earthdata token' },
  { id: 'GRACE-FO', name: 'GRACE-FO', res: 300000, grid: 'about 300 km', gives: 'Basin-scale water storage', access: 'Needs Earthdata token' },
  { id: 'MODIS', name: 'MODIS', res: 250, grid: '250 m to 1 km', gives: 'Vegetation vigor over time', access: 'Adapter' },
  { id: 'ECOSTRESS', name: 'ECOSTRESS', res: 70, grid: 'about 70 m', gives: 'Heat stress in the canopy', access: 'Adapter' },
  { id: 'Landsat', name: 'Landsat', res: 30, grid: '30 m', gives: 'Canopy vigor at field scale', access: 'Adapter' },
  { id: 'SRTM', name: 'SRTM', res: 30, grid: '30 m', gives: 'Elevation and slope', access: 'Adapter' },
] as const;

const LEGUMES = new Set(['Chickpea', 'Green Gram', 'Black Gram']);
const CEREALS = new Set(['Rice', 'Maize', 'Wheat']);

/** Rotations are described by structure only. Every figure shown is derived from these sequences. */
const STRATEGIES = [
  {
    id: 'A',
    title: 'Existing Baseline',
    seq: [
      { crop: 'Rice', season: 'kharif' as SeasonKey },
      { crop: 'Wheat', season: 'rabi' as SeasonKey },
    ],
    tradeoff: 'Two cereals back to back. Familiar to most farmers, but heavy on irrigation and on the nitrogen the soil has to supply.',
  },
  {
    id: 'B',
    title: 'Soil Restoration',
    seq: [
      { crop: 'Rice', season: 'kharif' as SeasonKey },
      { crop: 'Chickpea', season: 'rabi' as SeasonKey },
      { crop: 'Green Gram', season: 'zaid' as SeasonKey },
    ],
    tradeoff: 'Two legume phases put nitrogen and organic matter back, but the turnaround between seasons is tight.',
  },
  {
    id: 'C',
    title: 'Climate & Water Resilience',
    seq: [
      { crop: 'Maize', season: 'kharif' as SeasonKey },
      { crop: 'Mustard', season: 'rabi' as SeasonKey },
      { crop: 'Black Gram', season: 'zaid' as SeasonKey },
    ],
    tradeoff: 'Maize replaces flooded paddy to ease water demand, and it needs well-drained Kharif soil to do well.',
  },
];

const structureOf = (s: (typeof STRATEGIES)[number]) => ({
  crops: s.seq.length,
  legumes: s.seq.filter((x) => LEGUMES.has(x.crop)).length,
  cereals: s.seq.filter((x) => CEREALS.has(x.crop)).length,
  cover: s.seq.reduce((m, x) => m + SEASONS[x.season].months, 0),
  paddy: s.seq.some((x) => x.crop === 'Rice'),
});

const CHECKS = [
  { id: 'boundary', label: 'Farm boundary (GeoJSON)', weight: 20 },
  { id: 'irrigation', label: 'Irrigation constraints', weight: 15 },
  { id: 'history', label: 'Cropping history', weight: 15 },
  { id: 'ph', label: 'Lab soil pH', weight: 15 },
  { id: 'npk', label: 'Lab NPK values', weight: 20 },
  { id: 'token', label: 'NASA Earthdata token', weight: 15 },
];

const STEPS = [
  { title: 'Farm & Soil Intake', desc: 'Capture farm boundary GeoJSON, irrigation constraints, cropping history, and lab soil health values while flagging missing fields.' },
  { title: 'NASA Climate Analysis', desc: 'Retrieve daily NASA POWER time series, compute seasonal rainfall and heat-stress anomalies, and evaluate multi-factor environmental risks.' },
  { title: 'Rotation Scoring', desc: 'Preserve your current rotation as Strategy A and generate soil-building and water-resilient alternatives weighted by your priorities.' },
  { title: 'Simulation & Reports', desc: 'Test reduced-rainfall or heat-wave assumptions in the What-If Simulator, review the guidance notes, and export PDF/CSV reports for KVK review.' },
];

const NAV_IDS = ['#seasons', '#farmers', '#datasets', '#workflow', '#rotations', '#transparency'];

const CROP_HI: Record<string, string> = {
  Rice: 'धान', Maize: 'मक्का', Wheat: 'गेहूँ', Chickpea: 'चना', Mustard: 'सरसों', 'Green Gram': 'मूँग', 'Black Gram': 'उड़द',
};

const I18N = {
  en: {
    nav: ['Seasons', 'For Farmers', 'NASA Data', 'How It Works', 'Rotation Model', 'Transparency'],
    loc: 'Your location',
    h1a: 'Read your farm the way satellites do, then',
    h1b: 'decide what to plant',
    h1c: 'next.',
    sub: 'AgriShift pulls NASA Earth observations for your parcel, sets them beside your soil results, and lays crop rotations out side by side, so you can see what each one asks of your water and your soil before the season starts.',
    cta1: 'Explore Your Farm',
    cta2: 'See what data it reads',
    fKicker: 'Made for Indian farms',
    fTitle: 'Built around how farming in India actually works',
    fSub: 'Seasons, soil cards, MSP, the monsoon and your local KVK are part of every score, not an afterthought.',
    termsTitle: 'Terms you already know',
    termsNote: 'AgriShift is not affiliated with these schemes. They are listed because rotation choices touch them, so check current rules with your local KVK or agriculture office.',
    helpline: 'Kisan Call Centre (toll-free)',
  },
  hi: {
    nav: ['मौसम', 'किसानों के लिए', 'NASA डेटा', 'कैसे काम करता है', 'फसल चक्र', 'पारदर्शिता'],
    loc: 'आपकी लोकेशन',
    h1a: 'अपने खेत को उपग्रह की नज़र से पढ़ें, और',
    h1b: 'तय करें आगे क्या बोना है।',
    h1c: '',
    sub: 'AgriShift आपके खेत के लिए NASA के उपग्रह आँकड़े लाता है, उन्हें आपकी मिट्टी की जाँच के साथ रखता है और फसल चक्र आमने-सामने दिखाता है, ताकि सीज़न शुरू होने से पहले आप जान सकें कि हर विकल्प आपके पानी और मिट्टी से क्या माँगता है।',
    cta1: 'अपना खेत देखें',
    cta2: 'कौन-सा डेटा पढ़ता है',
    fKicker: 'भारतीय खेतों के लिए',
    fTitle: 'भारत की खेती के तरीक़े के हिसाब से बना',
    fSub: 'मौसम, मृदा कार्ड, MSP, मानसून और आपका स्थानीय KVK, हर स्कोर का हिस्सा हैं, बाद की सोच नहीं।',
    termsTitle: 'जो शब्द आप पहले से जानते हैं',
    termsNote: 'AgriShift इन योजनाओं से जुड़ा नहीं है। इन्हें इसलिए दिखाया गया है क्योंकि फसल चक्र के फ़ैसले इनसे जुड़ते हैं। ताज़ा नियम अपने KVK या कृषि कार्यालय से पूछें।',
    helpline: 'किसान कॉल सेंटर (टोल-फ़्री)',
  },
};

const SCHEME_CHIPS = ['MSP', 'Soil Health Card', 'KVK', 'PM-KISAN', 'PMFBY', 'e-NAM'];

const FARMER_CARDS: { Icon: LucideIcon; en: [string, string]; hi: [string, string] }[] = [
  {
    Icon: FlaskConical,
    en: ['Soil Health Card friendly', 'Enter pH and NPK from your Soil Health Card or a lab report. Anything missing is flagged, never guessed.'],
    hi: ['मृदा स्वास्थ्य कार्ड के साथ', 'मृदा स्वास्थ्य कार्ड या लैब रिपोर्ट से pH और NPK भरें। जो कमी हो, वह साफ़ दिखती है, अंदाज़े से नहीं भरी जाती।'],
  },
  {
    Icon: Landmark,
    en: ['MSP in the trade-off', 'Each rotation notes MSP access, so a water-saving plan is never judged on water alone.'],
    hi: ['हर फ़ैसले में MSP', 'हर फसल चक्र में MSP की पहुँच बताई जाती है, ताकि सिर्फ़ पानी बचत देखकर फ़ैसला न हो।'],
  },
  {
    Icon: CloudRain,
    en: ['Monsoon what-if', 'Slide rainfall down 40% and see how many millimetres of irrigation each rotation must make up.'],
    hi: ['मानसून कम हुआ तो?', 'बारिश 40% तक घटाकर देखें कि हर फसल चक्र में कितने मिमी सिंचाई और लगेगी।'],
  },
  {
    Icon: Wheat,
    en: ['Kharif, Rabi, Zaid', 'Scored season by season, with crop names you use at home: धान, गेहूँ, चना, सरसों, मूँग, उड़द.'],
    hi: ['खरीफ, रबी, जायद', 'हर मौसम के हिसाब से जाँच, और फसलों के वही नाम जो आप रोज़ बोलते हैं: धान, गेहूँ, चना, सरसों, मूँग, उड़द।'],
  },
  {
    Icon: FileCheck2,
    en: ['Reports your KVK can check', 'Export PDF or CSV with a verification list for Krishi Vigyan Kendra experts.'],
    hi: ['KVK के लिए रिपोर्ट', 'कृषि विज्ञान केंद्र के विशेषज्ञों के लिए जाँच-सूची के साथ PDF या CSV निकालें।'],
  },
  {
    Icon: Smartphone,
    en: ['Made for the phone in your pocket', 'Large buttons, light pages and Hindi text, so planning works in the field and not only at a desk.'],
    hi: ['जेब के फ़ोन पर चलने वाला', 'बड़े बटन, हल्के पेज और हिंदी में पाठ, ताकि योजना खेत पर भी बने, सिर्फ़ मेज़ पर नहीं।'],
  },
];

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35 0 0 0 0 .28 0 0 0 0 .15 0 0 0 .1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Public+Sans:wght@400;500;600&family=Caveat:wght@500;600&family=Noto+Sans+Devanagari:wght@500;600&display=swap');

@property --hillA { syntax: '<color>'; inherits: true; initial-value: #4E8F5A; }
@property --hillB { syntax: '<color>'; inherits: true; initial-value: #3F7D4C; }
@property --hillC { syntax: '<color>'; inherits: true; initial-value: #5B9A52; }
@property --plane1 { syntax: '<color>'; inherits: true; initial-value: #4C9A4F; }
@property --cloud   { syntax: '<color>'; inherits: true; initial-value: #ffffff; }
@property --stem    { syntax: '<color>'; inherits: true; initial-value: #4F8A3A; }
@property --stem-b  { syntax: '<color>'; inherits: true; initial-value: #7DAF5C; }
@property --grain   { syntax: '<color>'; inherits: true; initial-value: #7FB04A; }
@property --grain-b { syntax: '<color>'; inherits: true; initial-value: #A5CB6B; }
@property --spin { syntax: '<angle>'; inherits: false; initial-value: 0deg; }

/* Fluid root size: comfortable on phones, generous on wide monitors */
html { font-size: clamp(15px, 0.32vw + 13.6px, 19px); scroll-behavior: smooth; scroll-padding-top: 6rem; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; overscroll-behavior-y: none; }
body { margin: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }

.scene {
  --forest: #1F3D2B; --forest-2: #2E5A3F; --paper: #FBF7EC; --edge: #E6DCC2; --ink: #1B2A20; --muted: #55634F;
  --marigold: #E8A317; --clay: #B5482A; --ease: cubic-bezier(.22,1,.36,1);
  font-family: 'Public Sans', 'Noto Sans Devanagari', system-ui, sans-serif;
  color: var(--ink);
  min-height: 100vh; min-height: 100dvh; width: 100%;
  transition: --hillA 2s ease, --hillB 2s ease, --hillC 2s ease, --plane1 2s ease,
              --cloud 2s ease, --stem 2s ease, --stem-b 2s ease, --grain 2s ease, --grain-b 2s ease;
}
.scene img { max-width: 100%; }
.wrap { width: 100%; max-width: 1560px; margin-inline: auto; padding-inline: clamp(1rem, 3.2vw, 3rem); }
.sec  { padding-bottom: clamp(3rem, 8vw, 7rem); }

.scene[data-season='kharif'] { --hillA: #4E8F5A; --hillB: #3F7D4C; --hillC: #5B9A52; --plane1: #4C9A4F; --cloud: #EEF3F6; --stem: #4F8A3A; --stem-b: #7DAF5C; --grain: #7FB04A; --grain-b: #A5CB6B; --stalk-h: .78; --stalk-o: .95; }
.scene[data-season='rabi']   { --hillA: #6A9A55; --hillB: #8AA94A; --hillC: #B7B54A; --plane1: #98A843; --cloud: #FFFFFF; --stem: #5A7D2E; --stem-b: #86A455; --grain: #D9A532; --grain-b: #E8C46A; --stalk-h: 1; --stalk-o: 1; }
.scene[data-season='zaid']   { --hillA: #A99A47; --hillB: #C2A245; --hillC: #D6AE4F; --plane1: #C69A38; --cloud: #FFF3D6; --stem: #8A8440; --stem-b: #B4A867; --grain: #C9A86A; --grain-b: #DCC694; --stalk-h: .6; --stalk-o: .8; }

.f-serif { font-family: 'Fraunces', 'Noto Sans Devanagari', Georgia, serif; font-weight: 600; letter-spacing: -0.015em; }
.f-hand  { font-family: 'Caveat', cursive; font-weight: 600; }
.f-deva  { font-family: 'Noto Sans Devanagari', sans-serif; font-weight: 600; }
.num     { font-variant-numeric: tabular-nums; }

.progress { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 60; pointer-events: none;
  background: linear-gradient(90deg, var(--marigold), #F3C85B); transform-origin: 0 50%;
  transform: scaleX(var(--progress, 0)); will-change: transform; }

/* ---------- Liquid glass surfaces ---------- */
.glass, .glass-soft, .glass-dark, .paper {
  --mx: 50%; --my: 0%;
  position: relative; isolation: isolate;
}
.glass {
  background: linear-gradient(145deg, rgba(255,255,255,0.6), rgba(255,255,255,0.22));
  backdrop-filter: blur(26px) saturate(200%) brightness(1.04);
  -webkit-backdrop-filter: blur(26px) saturate(200%) brightness(1.04);
  border: 1px solid rgba(255,255,255,0.72);
  box-shadow: 0 24px 54px -24px rgba(20,45,28,0.55), inset 0 1.5px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.25), inset 0 0 40px rgba(255,255,255,0.08);
  transition: box-shadow .5s var(--ease), background .5s ease, transform .6s var(--ease);
}
.glass::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; z-index: -1; pointer-events: none;
  background: radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%),
              linear-gradient(315deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 40%);
}
/* cursor-following specular light, set by one delegated pointer listener */
.glass::after, .glass-soft::after, .glass-dark::after, .paper::after {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 0; opacity: 0;
  background: radial-gradient(420px circle at var(--mx) var(--my), rgba(255,255,255,0.5), rgba(255,255,255,0) 60%);
  mix-blend-mode: soft-light; transition: opacity .5s ease;
}
.glass:hover::after, .glass-soft:hover::after, .glass-dark:hover::after, .paper:hover::after { opacity: 1; }
.glass > *, .glass-soft > *, .glass-dark > *, .paper > * { position: relative; z-index: 1; }

.glass-soft {
  background: linear-gradient(150deg, rgba(255,255,255,0.5), rgba(255,255,255,0.3));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.75);
  box-shadow: inset 0 1.5px 0 rgba(255,255,255,0.95), 0 16px 34px -20px rgba(20,45,28,0.5);
  transition: box-shadow .5s var(--ease), background .4s ease, transform .6s var(--ease);
}
.glass-dark {
  background: linear-gradient(150deg, rgba(31,61,43,0.82), rgba(16,38,26,0.64));
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.24);
  box-shadow: 0 28px 50px -24px rgba(8,28,16,0.85), inset 0 1.5px 0 rgba(255,255,255,0.3);
}
.glass-bar {
  background: rgba(251,247,236,0.46);
  backdrop-filter: blur(26px) saturate(200%);
  -webkit-backdrop-filter: blur(26px) saturate(200%);
  border-bottom: 1px solid rgba(255,255,255,0.75);
  padding-top: env(safe-area-inset-top, 0px);
  transition: box-shadow .4s ease, background-color .4s ease;
}
.scene[data-scrolled] .glass-bar { background: rgba(251,247,236,0.8); box-shadow: 0 12px 30px -20px rgba(20,40,25,0.6); }
.glass-cap { background: rgba(20,40,28,0.55); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }
.paper {
  background-color: rgba(251,247,236,0.58);
  background-image: ${GRAIN};
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.74);
  box-shadow: 0 1px 0 rgba(255,255,255,0.95) inset, 0 28px 54px -26px rgba(50,40,20,0.55);
}
/* animated liquid rim on the big hero cards */
.rim::before { /* sits behind content, above background */ }
.rim { --spin: 0deg; }
.rim > .rim-line { position: absolute; inset: -1px; border-radius: inherit; padding: 1.5px; pointer-events: none; z-index: 2;
  background: conic-gradient(from var(--spin), rgba(255,255,255,0) 0deg, rgba(255,255,255,.95) 40deg, rgba(232,163,23,.7) 80deg, rgba(255,255,255,0) 140deg, rgba(255,255,255,0) 360deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  animation: spinRim 9s linear infinite; opacity: .85; }

.rule { border-color: var(--edge); }
.map-frame { border-radius: 18px; overflow: hidden; box-shadow: 0 20px 40px -22px rgba(20,40,25,.6); transition: box-shadow .5s ease, transform .6s var(--ease); }
.map-frame:hover { transform: translateY(-3px); box-shadow: 0 28px 48px -22px rgba(20,40,25,.65); }
.map-box { height: clamp(280px, 42vh, 520px); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,.45); }
.map-empty { height: 100%; }

/* ---------- Scene ---------- */
.scene-sky, .scene-haze { position: fixed; inset: 0; z-index: 0; pointer-events: none; transition: opacity 2s ease; will-change: opacity; }
.scene-sunwrap { position: fixed; top: 0; right: 0; width: 0; height: 0; z-index: 0; pointer-events: none; transition: transform 2.4s cubic-bezier(.45,0,.2,1); will-change: transform; transform: translate3d(0,0,0); }
.scene-sun { position: absolute; top: -50px; right: 9vw; width: clamp(90px, 9vw, 160px); height: clamp(90px, 9vw, 160px); border-radius: 50%; transition: opacity 2s ease; will-change: opacity; }
.scene[data-season='kharif'] .scene-sunwrap { transform: translate3d(-4vw, 30px, 0) scale(.9); }
.scene[data-season='rabi']   .scene-sunwrap { transform: translate3d(-34vw, 150px, 0) scale(1.05); }
.scene[data-season='zaid']   .scene-sunwrap { transform: translate3d(-14vw, 20px, 0) scale(1.3); }

.scene-cloud { position: fixed; left: 0; z-index: 0; pointer-events: none; animation: cloudFly linear infinite; transition: opacity 2s ease; will-change: transform, opacity; }
.scene-hill { position: fixed; left: 0; right: 0; bottom: 0; width: 100%; z-index: 0; pointer-events: none;
  transform: translate3d(0, calc(var(--sy, 0) * var(--k, 0) * 1px), 0); will-change: transform; }
.scene-plane { position: fixed; left: -60%; right: -60%; bottom: -5vh; height: 52vh; z-index: 0; pointer-events: none;
  transform-origin: 50% 100%; transform: perspective(520px) rotateX(62deg);
  background: repeating-linear-gradient(90deg, rgba(20,60,30,0) 0 38px, rgba(20,60,30,0.2) 38px 44px), linear-gradient(to top, var(--plane1), rgba(255,255,255,0) 85%);
  -webkit-mask-image: linear-gradient(to top, #000 40%, transparent 100%); mask-image: linear-gradient(to top, #000 40%, transparent 100%); }
.scene-rain { position: fixed; left: -10%; top: -20%; width: 120%; height: 140%; z-index: 0; pointer-events: none;
  background: repeating-linear-gradient(105deg, rgba(255,255,255,0) 0 22px, rgba(255,255,255,.9) 22px 23px, rgba(255,255,255,0) 23px 46px);
  transition: opacity 2s ease; animation: rainDrift 1.6s linear infinite; will-change: transform, opacity; }
.scene-stalks { position: fixed; left: 0; right: 0; bottom: -6px; height: 140px; z-index: 0; pointer-events: none;
  transform-origin: 50% 100%; transform: scaleY(var(--stalk-h, 1)); transition: transform 2s cubic-bezier(.45,0,.2,1), opacity 2s ease; will-change: transform; }
.scene-stalks.back  { opacity: calc(var(--stalk-o, 1) * .55); }
.scene-stalks.front { opacity: calc(var(--stalk-o, 1) * .9); }
.stalk { position: absolute; bottom: 0; transform-origin: 50% 100%; animation: sway ease-in-out infinite; }

/* floating liquid light blobs */
.blob { position: fixed; z-index: 0; pointer-events: none; filter: blur(60px); opacity: .5; mix-blend-mode: soft-light; will-change: transform, border-radius;
  animation: blobMorph 18s ease-in-out infinite, blobDrift 28s ease-in-out infinite; }
.blob.b1 { width: 38vw; height: 38vw; left: -8vw; top: 12vh; background: radial-gradient(circle, #fff, rgba(255,255,255,0) 70%); }
.blob.b2 { width: 32vw; height: 32vw; right: -6vw; top: 48vh; background: radial-gradient(circle, #FFE9A8, rgba(255,233,168,0) 70%); animation-delay: -7s, -11s; }

/* ---------- Buttons ---------- */
.btn-primary, .btn-ghost, .seg, .row-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.btn-primary { position: relative; overflow: hidden; isolation: isolate; background: var(--forest); color: var(--paper); border-radius: 999px;
  box-shadow: inset 0 1.5px 0 rgba(255,255,255,0.25), 0 12px 24px -10px rgba(20,50,30,0.85); transition: transform .3s var(--ease), box-shadow .3s ease, color .3s ease; }
.btn-primary::before { content: ''; position: absolute; inset: 0; z-index: -1; background: var(--marigold); border-radius: 50%;
  transform: translateY(101%) scale(1.4); transition: transform .55s cubic-bezier(.65,0,.35,1); }
.btn-primary::after { content: ''; position: absolute; top: 0; left: -60%; width: 40%; height: 100%; z-index: 0; pointer-events: none;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent); transform: skewX(-18deg); transition: left .7s ease; }
.btn-primary:hover { transform: translateY(-2px); color: var(--ink); box-shadow: inset 0 1.5px 0 rgba(255,255,255,0.4), 0 16px 28px -10px rgba(20,50,30,0.8); }
.btn-primary:hover::before { transform: translateY(0) scale(1.4); }
.btn-primary:hover::after { left: 120%; }
.btn-primary:active { transform: translateY(0) scale(.98); }
.btn-ghost { position: relative; overflow: hidden; isolation: isolate; border: 1.5px solid var(--forest); color: var(--forest); background: rgba(255,255,255,0.4); border-radius: 999px;
  transition: transform .3s var(--ease), color .3s ease; }
.btn-ghost::before { content: ''; position: absolute; inset: 0; z-index: -1; background: var(--forest); border-radius: 50%; transform: translateY(101%) scale(1.4); transition: transform .55s cubic-bezier(.65,0,.35,1); }
.btn-ghost:hover { transform: translateY(-2px); color: var(--paper); }
.btn-ghost:hover::before { transform: translateY(0) scale(1.4); }
.btn-primary:focus-visible, .btn-ghost:focus-visible, .u-link:focus-visible, .seg:focus-visible, .row-btn:focus-visible { outline: 2px solid var(--marigold); outline-offset: 3px; }
.arrow { transition: transform .25s ease; }
.btn-primary:hover .arrow, .btn-ghost:hover .arrow, .u-link:hover .arrow { transform: translateX(4px); }
.u-link { position: relative; }
.u-link::after { content: ''; position: absolute; left: 0; right: 0; bottom: -3px; height: 1.5px; background: currentColor; transform: scaleX(0); transform-origin: left; transition: transform .3s ease; }
.u-link:hover::after { transform: scaleX(1); }

.draw { stroke-dasharray: 260; stroke-dashoffset: 260; animation: draw 1.3s ease forwards; animation-delay: var(--d, 0.9s); }
.tape { position: absolute; width: 78px; height: 24px; background: rgba(226,205,140,0.72); box-shadow: 0 1px 2px rgba(0,0,0,0.18); }
.print { box-shadow: 0 2px 4px rgba(0,0,0,0.18), 0 28px 40px -20px rgba(20,30,20,0.55); }
.float-slow { animation: floatY 7s ease-in-out infinite; }

/* ---------- Controls ---------- */
.seg { transition: background .3s ease, color .3s ease, box-shadow .3s ease, transform .2s ease, flex .6s var(--ease); }
.seg:active, .row-btn:active { transform: scale(.985); }
.bar-fill { transition: width .9s cubic-bezier(.2,.8,.2,1), background .4s ease; }
.row-btn { transition: background .25s ease; }
.field { width: 100%; padding: .65rem .9rem; border-radius: 12px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.35); color: #F4EEDC; font: inherit; outline: none; transition: border-color .25s, background .25s; }
.field:focus { border-color: var(--marigold); background: rgba(255,255,255,.2); }

.lens-field { background: repeating-linear-gradient(90deg, rgba(10,50,25,0) 0 13px, rgba(10,50,25,0.22) 13px 16px), linear-gradient(160deg, #8DBF63, #3F8A4D 70%, #2E6E3E); }
.lens-grid { transition: background-size .8s cubic-bezier(.2,.8,.2,1), opacity .4s ease; }

/* ---------- Location card ---------- */
.loc-card { transition: transform .5s var(--ease), box-shadow .5s var(--ease); }
.loc-card:hover { transform: translateY(-2px); }
.loc-pin { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 999px; background: var(--forest); color: var(--paper); position: relative; }
.loc-pin.is-busy::after { content: ''; position: absolute; inset: -4px; border-radius: inherit; border: 2px solid var(--marigold); opacity: 0; animation: locPulse 1.6s var(--ease) infinite; }
.loc-retry { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 999px; color: var(--forest); transition: background .25s ease, transform .4s var(--ease); }
.loc-retry:hover { background: rgba(31,61,43,.1); transform: rotate(90deg); }
.loc-retry:focus-visible { outline: 2px solid var(--marigold); outline-offset: 2px; }

/* ---------- Reveal ---------- */
.reveal { opacity: 0; transform: translate3d(0,28px,0) scale(.985); filter: blur(6px); transition: opacity .9s var(--ease), transform .9s var(--ease), filter .9s var(--ease); transition-delay: var(--d, 0ms); }
.reveal.is-visible { opacity: 1; transform: none; filter: none; }
.hero-in { opacity: 0; animation: heroIn .9s var(--ease) forwards; animation-delay: var(--d, 0ms); }

/* ---------- Fit to every screen ---------- */
.hero-fit { min-height: calc(100vh - 5rem); min-height: calc(100dvh - 5rem); display: flex; align-items: center; }
.hero-fit > * { width: 100%; }
section[id] { scroll-margin-top: 6rem; }
#datasets, #workflow, #rotations, #transparency { content-visibility: auto; contain-intrinsic-size: auto 900px; }
footer { padding-bottom: env(safe-area-inset-bottom, 0px); }
.mobile-nav { display: flex; gap: 1.25rem; overflow-x: auto; scrollbar-width: none; padding: 0 1.25rem .65rem; font-size: .8rem; font-weight: 600; color: #3C4B40; -webkit-overflow-scrolling: touch; scroll-snap-type: x proximity; }
.mobile-nav::-webkit-scrollbar { display: none; }
.mobile-nav a { white-space: nowrap; padding: .25rem 0; scroll-snap-align: start; }
@media (min-width: 1024px) { .mobile-nav { display: none; } }
@media (pointer: coarse) { .btn-primary, .btn-ghost { min-height: 44px; } }

/* ---------- Marquee of data sources ---------- */
.marquee { overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.marquee-track { display: flex; gap: .75rem; width: max-content; animation: marquee 38s linear infinite; }
.marquee:hover .marquee-track { animation-play-state: paused; }

/* ---------- Tractor ---------- */
.scene-tractor { position: fixed; left: 0; bottom: 7vh; width: clamp(105px, 10vw, 170px); z-index: 0; pointer-events: none; animation: tractorDrive 56s linear infinite; will-change: transform; filter: drop-shadow(0 8px 6px rgba(20,40,20,0.35)); }
.scene-tractor svg { width: 100%; height: auto; display: block; }
.tractor-body { animation: tractorBob .55s ease-in-out infinite; }
.tractor-wheel { animation: wheelSpin 2.2s linear infinite; }
.tractor-puff { transform-box: fill-box; transform-origin: center; opacity: 0; animation: puffUp 2.4s ease-out infinite; }
.tractor-puff.p2 { animation-delay: .8s; }
.tractor-puff.p3 { animation-delay: 1.6s; }

/* ---------- Indian touches ---------- */
.motif { height: 14px; opacity: .95; background-repeat: repeat-x; background-position: center;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='14'><path d='M14 1 L21 7 L14 13 L7 7Z' fill='none' stroke='%23E8A317' stroke-width='1.6'/><circle cx='14' cy='7' r='1.8' fill='%232E7D4F'/><circle cx='0' cy='7' r='1.4' fill='%23E8A317'/><circle cx='28' cy='7' r='1.4' fill='%23E8A317'/></svg>"); }
.tricolour { display: inline-flex; width: 36px; height: 12px; border-radius: 2px; overflow: hidden; border: 1px solid rgba(255,255,255,0.3); }
.tricolour i { flex: 1; display: block; }
.tricolour i:nth-child(1) { background: #FF9933; }
.tricolour i:nth-child(2) { background: #FFFFFF; }
.tricolour i:nth-child(3) { background: #138808; }
.chip { display: inline-flex; align-items: center; padding: .3rem .8rem; border-radius: 999px; font-size: .78rem; font-weight: 600; color: var(--forest);
  background: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); white-space: nowrap; box-shadow: inset 0 1px 0 #fff; }
.farmer-ico { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 14px; color: var(--paper);
  background: linear-gradient(145deg, var(--forest-2), var(--forest)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 8px 16px -8px rgba(20,50,30,0.8); }
.farmer-card:hover { background: rgba(255,255,255,0.64); box-shadow: inset 0 1px 0 #fff, 0 22px 38px -20px rgba(20,45,28,0.6); transform: translateY(-4px); }
.lang-toggle { display: inline-flex; padding: 2px; border-radius: 999px; border: 1px solid rgba(31,61,43,0.35); background: rgba(255,255,255,0.5); font-size: 11px; font-weight: 600; color: var(--forest); touch-action: manipulation; }
.lang-toggle span { padding: .22rem .55rem; border-radius: 999px; transition: background .3s ease, color .3s ease; }
.lang-toggle span.on { background: var(--forest); color: var(--paper); }
.lang-toggle:focus-visible { outline: 2px solid var(--marigold); outline-offset: 3px; }

/* ---------- Keyframes ---------- */
@keyframes tractorDrive { from { transform: translate3d(-25vw,0,0); } to { transform: translate3d(110vw,0,0); } }
@keyframes tractorBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(1.6px); } }
@keyframes wheelSpin { to { transform: rotate(360deg); } }
@keyframes puffUp { 0% { opacity: .75; transform: translate(0,0) scale(.5); } 100% { opacity: 0; transform: translate(-16px,-34px) scale(1.8); } }
@keyframes sway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes cloudFly { from { transform: translate3d(-35vw,0,0); } to { transform: translate3d(120vw,0,0); } }
@keyframes heroIn { from { opacity: 0; transform: translate3d(0,18px,0); } to { opacity: 1; transform: none; } }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes rainDrift { from { transform: translate3d(0,-60px,0); } to { transform: translate3d(-16px,0,0); } }
@keyframes locPulse { 0% { transform: scale(.8); opacity: .9; } 100% { transform: scale(1.5); opacity: 0; } }
@keyframes spinRim { to { --spin: 360deg; } }
@keyframes marquee { to { transform: translate3d(-50%,0,0); } }
@keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes blobMorph { 0%,100% { border-radius: 60% 40% 55% 45% / 50% 60% 40% 50%; } 50% { border-radius: 40% 60% 45% 55% / 60% 40% 60% 40%; } }
@keyframes blobDrift { 0%,100% { transform: translate3d(0,0,0) rotate(0deg); } 50% { transform: translate3d(6vw,-4vh,0) rotate(30deg); } }

/* ---------- Responsive ---------- */
@media (max-width: 1023px) { .scene-sunwrap { transform: translate3d(0,0,0) scale(.8) !important; } }
@media (max-width: 640px) {
  .scene-stalks.back, .scene-rain, .blob { display: none; }
  .map-frame:hover { transform: none; }
  .glass, .glass-bar, .glass-cap, .glass-soft, .paper { backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
  .hero-fit { align-items: flex-start; }
  table { font-size: 12.5px; }
}
@media (hover: none) { .glass::after, .glass-soft::after, .glass-dark::after, .paper::after { display: none; } }

/* ---------- Reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .scene-cloud, .stalk, .scene-rain, .loc-pin.is-busy::after, .blob, .rim > .rim-line, .marquee-track, .float-slow { animation: none !important; }
  .scene-rain, .progress, .blob { display: none; }
  .scene-sunwrap, .scene-stalks, .scene-hill { transition: none !important; transform: none !important; }
  .scene-sky, .scene-haze, .scene-sun, .scene-cloud { transition-duration: .4s; }
  .map-frame:hover, .loc-card:hover, .farmer-card:hover { transform: none; }
  .draw { animation: none !important; stroke-dashoffset: 0; }
  .reveal, .hero-in { opacity: 1 !important; transform: none !important; filter: none !important; animation: none !important; transition: none !important; }
  html { scroll-behavior: auto; }
  .scene-tractor { animation: none !important; transform: translate3d(62vw,0,0) !important; }
  .tractor-wheel, .tractor-body, .tractor-puff { animation: none !important; }
}
`;

/* -------------------------------------------------------------------------- */
/*  Scroll-driven season                                                       */
/* -------------------------------------------------------------------------- */
function useSeasonScroll(sceneRef: { current: HTMLElement | null }, initial: SeasonKey): [SeasonKey, (s: SeasonKey) => void] {
  const [season, setSeason] = useState<SeasonKey>(initial);
  const base = useRef(SEASON_ORDER.indexOf(initial));
  const step = useRef(0);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      const y = window.scrollY;
      el.style.setProperty('--sy', String(y));
      if (y > 24) el.setAttribute('data-scrolled', '');
      else el.removeAttribute('data-scrolled');

      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, y / max));
      el.style.setProperty('--progress', p.toFixed(4));
      const next = p < 0.3 ? 0 : p < 0.64 ? 1 : 2;
      if (next !== step.current) {
        step.current = next;
        setSeason(SEASON_ORDER[(base.current + next) % 3]);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sceneRef]);

  const choose = useCallback((s: SeasonKey) => {
    base.current = (SEASON_ORDER.indexOf(s) - step.current + 3) % 3;
    setSeason(s);
  }, []);

  return [season, choose];
}

/** One delegated pointer listener drives the liquid specular highlight on every glass surface. */
function useLiquidPointer(sceneRef: { current: HTMLElement | null }) {
  useEffect(() => {
    const el = sceneRef.current;
    if (!el || !window.matchMedia('(hover: hover)').matches) return;
    let raf = 0;
    let ev: PointerEvent | null = null;
    const apply = () => {
      raf = 0;
      if (!ev) return;
      const t = (ev.target as HTMLElement | null)?.closest<HTMLElement>('.glass, .glass-soft, .glass-dark, .paper');
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty('--mx', `${ev.clientX - r.left}px`);
      t.style.setProperty('--my', `${ev.clientY - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      ev = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    el.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      el.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sceneRef]);
}

/* -------------------------------------------------------------------------- */
/*  Scene                                                                      */
/* -------------------------------------------------------------------------- */
const SKIES: Record<SeasonKey, string> = {
  kharif: 'linear-gradient(180deg,#5E9FC9 0%,#A9CBD8 52%,#DCEBD9 100%)',
  rabi: 'linear-gradient(180deg,#7FB9E6 0%,#D7E8EC 50%,#F6EBC8 100%)',
  zaid: 'linear-gradient(180deg,#8DB9E0 0%,#F3D9AE 55%,#F7E3B8 100%)',
};
const HAZE: Record<SeasonKey, string> = {
  kharif: 'linear-gradient(to top, rgba(214,238,226,0.55), rgba(214,238,226,0) 55%)',
  rabi: 'linear-gradient(to top, rgba(255,230,170,0.42), rgba(255,230,170,0) 50%)',
  zaid: 'linear-gradient(to top, rgba(255,196,120,0.40), rgba(255,196,120,0) 60%)',
};
const SUNS: Record<SeasonKey, { bg: string; glow: string }> = {
  kharif: { bg: 'radial-gradient(circle,#FFFFFF 0 40%,rgba(235,244,250,0.7) 62%,transparent 72%)', glow: '0 0 80px 36px rgba(235,244,250,0.35)' },
  rabi: { bg: 'radial-gradient(circle,#FFF6D6 0 45%,rgba(255,226,150,0.85) 62%,transparent 72%)', glow: '0 0 100px 46px rgba(255,214,130,0.5)' },
  zaid: { bg: 'radial-gradient(circle,#FFFFFF 0 48%,rgba(255,236,170,0.9) 64%,transparent 74%)', glow: '0 0 130px 70px rgba(255,226,140,0.6)' },
};
const CLOUDS: { top: string; w: number; dur: number; delay: number; op: Record<SeasonKey, number> }[] = [
  { top: '7%', w: 240, dur: 170, delay: -50, op: { kharif: 0.95, rabi: 0.75, zaid: 0.35 } },
  { top: '20%', w: 380, dur: 230, delay: -150, op: { kharif: 0.85, rabi: 0.55, zaid: 0.25 } },
  { top: '13%', w: 300, dur: 260, delay: -90, op: { kharif: 0.9, rabi: 0.2, zaid: 0 } },
  { top: '30%', w: 220, dur: 200, delay: -20, op: { kharif: 0.7, rabi: 0, zaid: 0 } },
];
const STALKS = Array.from({ length: 56 }, (_, i) => ({
  left: (i / 56) * 100 + (seeded(i) - 0.5) * 2,
  height: 60 + seeded(i + 9) * 70,
  dur: 4.5 + seeded(i + 3) * 3.5,
  delay: -seeded(i + 21) * 6,
  front: i % 2 === 0,
}));

function WheatStalk({ height, front }: { height: number; front: boolean }) {
  const stem = front ? 'var(--stem)' : 'var(--stem-b)';
  const grain = front ? 'var(--grain)' : 'var(--grain-b)';
  return (
    <svg width="14" height={height} viewBox="0 0 16 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M8 100 C8 70 9 42 8 16" style={{ stroke: stem }} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((k) => (
        <g key={k}>
          <ellipse cx="5" cy={14 + k * 6} rx="2.2" ry="3.4" style={{ fill: grain }} transform={`rotate(-24 5 ${14 + k * 6})`} />
          <ellipse cx="11" cy={14 + k * 6} rx="2.2" ry="3.4" style={{ fill: grain }} transform={`rotate(24 11 ${14 + k * 6})`} />
        </g>
      ))}
      <ellipse cx="8" cy="9" rx="2" ry="4" style={{ fill: grain }} />
    </svg>
  );
}

function Hill({ d, k, h, v }: { d: string; k: number; h: string; v: string }) {
  return (
    <svg className="scene-hill" style={cv({ '--k': k }, { height: h })} viewBox="0 0 1440 600" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} style={{ fill: `var(${v})` }} />
    </svg>
  );
}

function SceneBackground({ season }: { season: SeasonKey }) {
  return (
    <div aria-hidden="true">
      {SEASON_ORDER.map((k) => (
        <div key={`sky-${k}`} className="scene-sky" style={{ background: SKIES[k], opacity: season === k ? 1 : 0 }} />
      ))}
      <div className="scene-sunwrap">
        {SEASON_ORDER.map((k) => (
          <div key={`sun-${k}`} className="scene-sun" style={{ background: SUNS[k].bg, boxShadow: SUNS[k].glow, opacity: season === k ? 1 : 0 }} />
        ))}
      </div>

      {CLOUDS.map((c, i) => (
        <div key={i} className="scene-cloud" style={{ top: c.top, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s`, opacity: c.op[season] }}>
          <svg width={c.w} height={c.w / 3} viewBox="0 0 260 90">
            <g style={{ fill: 'var(--cloud)' }}>
              <circle cx="70" cy="58" r="28" />
              <circle cx="110" cy="42" r="34" />
              <circle cx="155" cy="50" r="30" />
              <circle cx="195" cy="60" r="24" />
              <rect x="62" y="58" width="150" height="26" rx="13" />
            </g>
          </svg>
        </div>
      ))}

      <Hill k={-0.02} h="60vh" v="--hillA" d="M0 300 C180 240 360 330 560 280 S960 220 1180 290 S1360 270 1440 250 L1440 600 L0 600Z" />
      <Hill k={-0.04} h="55vh" v="--hillB" d="M0 370 C220 320 420 410 700 360 S1100 310 1440 370 L1440 600 L0 600Z" />
      <Hill k={-0.07} h="48vh" v="--hillC" d="M0 440 C260 410 520 480 800 440 S1200 410 1440 450 L1440 600 L0 600Z" />

      {SEASON_ORDER.map((k) => (
        <div key={`haze-${k}`} className="scene-haze" style={{ background: HAZE[k], opacity: season === k ? 1 : 0 }} />
      ))}
      <div className="scene-rain" style={{ opacity: season === 'kharif' ? 0.11 : 0 }} />
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="scene-plane" />

      <div className="scene-stalks back">
        {STALKS.filter((s) => !s.front).map((s, i) => (
          <span key={i} className="stalk" style={{ left: `${s.left}%`, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}>
            <WheatStalk height={s.height * 0.85} front={false} />
          </span>
        ))}
      </div>
      <div className="scene-stalks front">
        {STALKS.filter((s) => s.front).map((s, i) => (
          <span key={i} className="stalk" style={{ left: `${s.left}%`, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}>
            <WheatStalk height={s.height} front />
          </span>
        ))}
      </div>

      <div className="scene-tractor">
        <Tractor />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small bits                                                                 */
/* -------------------------------------------------------------------------- */
function Tractor({ className = '', animated = true }: { className?: string; animated?: boolean }) {
  const wheel = animated ? 'tractor-wheel' : undefined;
  return (
    <svg viewBox="0 0 200 125" className={className} fill="none" aria-hidden="true">
      {animated && (
        <g>
          <circle className="tractor-puff p1" cx="150" cy="26" r="4" fill="#fff" />
          <circle className="tractor-puff p2" cx="150" cy="26" r="4" fill="#fff" />
          <circle className="tractor-puff p3" cx="150" cy="26" r="4" fill="#fff" />
        </g>
      )}
      <g className={animated ? 'tractor-body' : undefined}>
        <rect x="147" y="30" width="6" height="28" rx="2" fill="#3A3A3A" />
        <rect x="144" y="27" width="12" height="5" rx="2" fill="#2B2B2B" />
        <rect x="64" y="72" width="104" height="11" rx="4" fill="#8A2A1A" />
        <path d="M98 58 h58 a8 8 0 0 1 8 8 v16 h-66z" fill="#D2452B" />
        <rect x="104" y="51" width="50" height="9" rx="3" fill="#B53A22" />
        <rect x="160" y="66" width="8" height="14" rx="2" fill="#E8A317" />
        <path d="M100 66 h50 M100 72 h50" stroke="#9E3220" strokeWidth="1.6" />
        <rect x="44" y="38" width="50" height="36" rx="4" fill="rgba(214,238,250,0.8)" stroke="#1F3D2B" strokeWidth="3" />
        <path d="M69 38 V74" stroke="#1F3D2B" strokeWidth="2.5" />
        <rect x="38" y="28" width="62" height="8" rx="4" fill="#1F3D2B" />
        <rect x="52" y="62" width="14" height="8" rx="2" fill="#5A3A22" />
      </g>
      <g className={wheel} style={{ transformOrigin: '62px 88px' }}>
        <circle cx="62" cy="88" r="32" fill="#1C1C1C" />
        <circle cx="62" cy="88" r="32" stroke="#4A4A4A" strokeWidth="5" strokeDasharray="6 5" />
        <circle cx="62" cy="88" r="21" fill="#E8A317" />
        <path d="M62 69 V107 M43 88 H81 M49 75 L75 101 M75 75 L49 101" stroke="#1C1C1C" strokeWidth="3" />
        <circle cx="62" cy="88" r="6" fill="#1C1C1C" />
      </g>
      <g className={wheel} style={{ transformOrigin: '160px 102px' }}>
        <circle cx="160" cy="102" r="18" fill="#1C1C1C" />
        <circle cx="160" cy="102" r="18" stroke="#4A4A4A" strokeWidth="4" strokeDasharray="5 4" />
        <circle cx="160" cy="102" r="11" fill="#E8A317" />
        <path d="M160 91 V113 M149 102 H171" stroke="#1C1C1C" strokeWidth="2.5" />
        <circle cx="160" cy="102" r="3.5" fill="#1C1C1C" />
      </g>
    </svg>
  );
}

function Sprout({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 28 V14" />
      <path d="M16 15 C16 9 11 6 5 6 C5 12 9 15 16 15Z" />
      <path d="M16 12 C16 7 20 4 27 4 C27 10 23 12 16 12Z" />
    </svg>
  );
}

function Kicker({ n, children }: { n: string; children: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#55634F] mb-3">
      <span className="text-[#B5482A] mr-2">{n}</span>
      {children}
    </p>
  );
}

const Rim = () => <span className="rim-line" aria-hidden="true" />;

const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString('en-IN') : n >= 10 ? n.toFixed(0) : n >= 1 ? n.toFixed(1) : n.toFixed(2));
const sizeLabel = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${m} m`);

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */
export function LandingPage() {
  const navigate = useNavigate();
  const { signInWithGoogle, enterDemoMode, user } = useAuth();
  const sceneRef = useRef<HTMLDivElement>(null);
  const loc = useUserLocation();

  const today = new Date();
  const [season, setSeason] = useSeasonScroll(sceneRef, currentSeasonFromDate());
  useLiquidPointer(sceneRef);

  const [strategyIdx, setStrategyIdx] = useState(0);
  const [lensId, setLensId] = useState<(typeof DATASETS)[number]['id']>('POWER');
  const [parcelInput, setParcelInput] = useState('1');
  const [checks, setChecks] = useState<Record<string, boolean>>({
    boundary: false, irrigation: false, history: false, ph: false, npk: false, token: false,
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  const handleExploreFarm = () => {
    enterDemoMode();
    navigate('/app/overview');
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      navigate('/app/overview');
    } catch {
      enterDemoMode();
      navigate('/app/overview');
    }
  };

  // Scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ---- derived (no invented numbers: everything comes from the tables above) ---- */
  const todayMonthIdx = (today.getMonth() + 7) % 12;
  const todaySeason = currentSeasonFromDate(today);
  const S = SEASONS[season];

  const cropCount = useMemo(() => new Set(SEASON_ORDER.flatMap((k) => SEASONS[k].crops)).size, []);
  const strategy = STRATEGIES[strategyIdx];
  const st = structureOf(strategy);

  const lens = DATASETS.find((d) => d.id === lensId)!;
  const parsedParcel = Number(parcelInput);
  const parcelHa = Number.isFinite(parsedParcel) && parsedParcel > 0 ? parsedParcel : 1;
  const pixelHa = Math.pow(lens.res / 1000, 2) * 100;
  const ratio = pixelHa / parcelHa;
  const cellPct = (lens.res / 60000) * 100;
  const cellShown = Math.min(100, Math.max(cellPct, 2.6));
  const enlarged = cellPct < 2.6;
  const coversView = cellPct >= 100;

  const score = CHECKS.reduce((s, c) => s + (checks[c.id] ? c.weight : 0), 0);
  const missing = CHECKS.filter((c) => !checks[c.id]);

  const t = I18N[lang];
  const navLinks = NAV_IDS.map((id, i) => [t.nav[i], id]);
  const marquee = [...DATASETS, ...DATASETS];

  const heroStats: [string, string, string][] = [
    [String(cropCount), 'crops', 'Across Kharif, Rabi and Zaid'],
    [String(DATASETS.length), 'NASA datasets', 'Live POWER + Earthdata adapters'],
    [String(STRATEGIES.length), 'rotations', 'Your baseline vs soil & water plans'],
  ];

  return (
    <div ref={sceneRef} className="scene relative overflow-x-hidden" data-season={season} data-lang={lang}>
      <style>{STYLES}</style>
      <div className="progress" aria-hidden="true" />
      <SceneBackground season={season} />

      <div className="relative z-10">
        {/* ------------------------------ Header ------------------------------ */}
        <header className="sticky top-0 z-30 glass-bar">
          <div className="wrap py-3 sm:py-3.5 flex items-center justify-between gap-4 md:gap-8">
            <a href="#top" className="flex items-center gap-2 text-[#1F3D2B] whitespace-nowrap shrink-0">
              <Sprout className="w-6 h-6" />
              <span className="f-serif text-xl">AgriShift</span>
            </a>

            <nav aria-label="Primary" className="hidden lg:flex items-center gap-5 xl:gap-8 text-sm font-medium text-[#3C4B40]">
              {navLinks.map(([l, h]) => (
                <a key={h} href={h} className="u-link hover:text-[#1B2A20] whitespace-nowrap shrink-0">{l}</a>
              ))}
            </nav>

            <div className="shrink-0 flex items-center gap-2 sm:gap-3">
              <button type="button" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className="lang-toggle" aria-label="Switch language between English and Hindi">
                <span className={lang === 'en' ? 'on' : ''}>EN</span>
                <span className={`f-deva ${lang === 'hi' ? 'on' : ''}`}>हिं</span>
              </button>
              {user ? (
                <>
                  <span className="hidden sm:inline text-xs font-medium text-[#1F3D2B] max-w-[10rem] truncate">{user.name || user.email}</span>
                  <button type="button" onClick={() => navigate('/app/overview')} className="btn-primary px-4 py-2 text-sm font-medium whitespace-nowrap">
                    Go to Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setAuthModalMode('login'); setAuthModalOpen(true); }}
                    className="px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-[#1F3D2B] hover:text-[#111C15] hover:bg-black/5 rounded-full transition-colors whitespace-nowrap"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthModalMode('register'); setAuthModalOpen(true); }}
                    className="px-3.5 py-1.5 text-xs font-semibold border border-[#1F3D2B] text-[#1F3D2B] hover:bg-[#1F3D2B] hover:text-white rounded-full transition-colors whitespace-nowrap hidden sm:inline-block"
                  >
                    Register
                  </button>
                  <button type="button" onClick={handleExploreFarm} className="btn-primary px-3.5 py-1.5 text-xs font-medium whitespace-nowrap">
                    Explore Farm
                  </button>
                </>
              )}
            </div>
          </div>

          <nav aria-label="Sections" className="mobile-nav">
            {navLinks.map(([l, h]) => (
              <a key={h} href={h}>{l}</a>
            ))}
          </nav>
        </header>

        <main id="top">
          {/* ------------------------------- Hero ------------------------------- */}
          <section className="hero-fit wrap pt-8 pb-14 lg:pt-10 lg:pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              <div className="lg:col-span-7">
                <p className="hero-in glass-soft inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm text-[#1F3D2B] mb-4" style={cv({ '--d': '0ms' })}>
                  <span aria-hidden="true">🙏</span>
                  <span className="f-deva">नमस्ते किसान भाई</span>
                </p>
                <p className="hero-in text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2F4A3A] mb-2" style={cv({ '--d': '40ms' })}>
                  NASA Space Apps Challenge 2026 · Field Shift
                </p>
                <p className="hero-in f-deva text-lg text-[#1F3D2B] mb-5" style={cv({ '--d': '100ms' })}>
                  खेत की बात, आसमान से
                </p>
                <h1 className="hero-in f-serif text-[#14261B] leading-[1.05] mb-6" style={cv({ '--d': '160ms' }, { fontSize: 'clamp(2.2rem, 1.2rem + 3.6vw, 4.8rem)', ...balance })}>
                  {t.h1a}{' '}
                  <span className="relative inline-block">
                    {t.h1b}
                    <svg className="absolute left-0 -bottom-2 w-full h-3" viewBox="0 0 240 12" preserveAspectRatio="none" aria-hidden="true">
                      <path className="draw" d="M2 8 C 40 2, 80 11, 120 5 S 195 9, 238 4" stroke="#E8A317" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                    </svg>
                  </span>{' '}
                  {t.h1c}
                </h1>
                <p className="hero-in text-base lg:text-lg text-[#24392C] leading-relaxed max-w-2xl mb-8" style={cv({ '--d': '260ms' })}>
                  {t.sub}
                </p>

                <div className="hero-in flex flex-wrap items-center gap-3 mb-4" style={cv({ '--d': '340ms' })}>
                  <button type="button" onClick={handleExploreFarm} className="btn-primary inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold whitespace-nowrap">
                    <span>{t.cta1}</span>
                    <ArrowRight className="arrow w-4 h-4" />
                  </button>
                  <a href="#datasets" className="btn-ghost inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold whitespace-nowrap">
                    {t.cta2}
                  </a>
                </div>
                {!user && (
                  <p className="hero-in text-sm text-[#2F4A3A] mb-8" style={cv({ '--d': '400ms' })}>
                    Want cloud-synced farm boundaries?{' '}
                    <button type="button" onClick={handleGoogleSignIn} className="u-link font-semibold text-[#1F3D2B]">
                      Sign in with Google
                    </button>
                  </p>
                )}

                <dl className="hero-in glass rim rounded-2xl px-4 sm:px-6 py-4 grid grid-cols-3 gap-3 sm:gap-5 max-w-2xl" style={cv({ '--d': '480ms' })}>
                  <Rim />
                  {heroStats.map(([n, l, s]) => (
                    <div key={l} className="border-l border-[#1F3D2B]/20 pl-3 sm:pl-5 first:border-l-0 first:pl-0 min-w-0">
                      <dt className="text-xs sm:text-sm text-[#1B2A20]">
                        <span className="f-serif text-2xl sm:text-3xl num mr-1.5 text-[#1F3D2B]">{n}</span>
                        {l}
                      </dt>
                      <dd className="text-[11px] sm:text-xs text-[#4A5A4E] mt-1">{s}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Printed photo with the visitor's live location on the caption */}
              <div className="lg:col-span-5 hero-in relative lg:pl-4" style={cv({ '--d': '280ms' })}>
                <div className="float-slow">
                  <div className="relative mx-auto max-w-[17rem] sm:max-w-sm lg:max-w-md" style={{ transform: 'rotate(1.6deg)' }}>
                    <span className="tape -top-3 left-6" style={{ transform: 'rotate(-5deg)' }} />
                    <span className="tape -top-3 right-6" style={{ transform: 'rotate(4deg)' }} />
                    <div className="print bg-white p-3 pb-14 relative rounded-sm">
                      <div className="aspect-[4/5] overflow-hidden bg-[#163026]">
                        <img
                          src="/src/assets/images/hero_agri_satellite_1794669905794.jpg"
                          alt="Aerial Earth observation view of geometric green crop fields and irrigation channels"
                          referrerPolicy="no-referrer"
                          loading="eager"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="f-hand text-xl text-[#2B3A2F] mt-3 absolute bottom-3 left-5 right-5 leading-tight truncate">
                        {loc.lat !== null && loc.lon !== null
                          ? loc.placeName ?? `${fmtCoord(loc.lat, 'N', 'S')}, ${fmtCoord(loc.lon, 'E', 'W')}`
                          : 'your field, from above'}
                      </p>
                    </div>
                  </div>
                </div>

                <LocationCard loc={loc} title={t.loc} className="mt-7 max-w-md mx-auto lg:mx-0 relative" />
              </div>
            </div>
          </section>

          {/* ------------------------------ Seasons ------------------------------ */}
          <section id="seasons" className="wrap sec">
            <div className="glass rim rounded-3xl p-5 sm:p-8 md:p-12 reveal">
              <Rim />
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 mb-8">
                <div className="md:col-span-7">
                  <Kicker n="01">Seasons</Kicker>
                  <h2 className="f-serif text-[clamp(1.6rem,1rem+2vw,3rem)] text-[#14261B] leading-tight" style={balance}>
                    The cropping year, counted the way farmers count it
                  </h2>
                </div>
                <p className="md:col-span-5 text-sm text-[#2F4A3A] leading-relaxed md:pt-6">
                  Every rotation in AgriShift is scored season by season. Pick one below and the sky behind this page will follow.
                </p>
              </div>

              <div className="relative pt-9">
                <div className="absolute top-0 flex flex-col items-center -translate-x-1/2 transition-all duration-500" style={{ left: `${((todayMonthIdx + 0.5) / 12) * 100}%` }} aria-hidden="true">
                  <span className="f-hand text-lg leading-none text-[#B5482A]">today</span>
                  <span className="block w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-[#B5482A]" />
                </div>

                <div className="flex h-14 sm:h-16 rounded-2xl overflow-hidden border border-white/80 shadow-sm" role="tablist" aria-label="Season">
                  {SEASON_ORDER.map((k) => {
                    const s = SEASONS[k];
                    const active = season === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSeason(k)}
                        className="seg relative flex items-center justify-center gap-2 px-2 text-xs sm:text-sm font-semibold border-r border-white/70 last:border-r-0"
                        style={{
                          flex: s.months,
                          background: active ? s.color : `${s.color}55`,
                          color: active ? (k === 'rabi' ? '#2A1E05' : '#fff') : '#1B2A20',
                          boxShadow: active ? 'inset 0 -4px 0 rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,.35)' : 'none',
                        }}
                      >
                        <span>{s.name}</span>
                        <span className="f-deva text-xs opacity-90 hidden sm:inline">{s.deva}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-12 mt-2 text-[9px] sm:text-[11px] text-[#4A5A4E] num">
                  {MONTHS.map((m) => (<span key={m} className="text-center">{m}</span>))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 mt-9 pt-8 border-t border-[#1F3D2B]/15">
                <div className="md:col-span-5">
                  <div className="f-serif text-4xl sm:text-5xl text-[#14261B] leading-none">{S.name}</div>
                  <div className="f-deva text-2xl text-[#1F3D2B] mt-2">{S.deva}</div>
                  <div className="text-sm text-[#4A5A4E] mt-2">{S.window}{season === todaySeason ? ' · this is the current season' : ''}</div>
                </div>
                <div className="md:col-span-7">
                  <p className="text-[#24392C] leading-relaxed">{S.note}</p>
                  <p className="text-sm mt-4">
                    <span className="font-semibold text-[#1B2A20]">Crops in the model:</span>{' '}
                    <span className="text-[#2F4A3A]">{S.crops.map((c) => `${c} (${CROP_HI[c]})`).join(', ')}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------------ For Indian farmers ------------------------------ */}
          <section id="farmers" className="wrap sec">
            <div className="glass rounded-3xl p-5 sm:p-8 md:p-12">
              <div className="reveal">
                <Kicker n="भारत">{t.fKicker}</Kicker>
                <h2 className="f-serif text-[clamp(1.6rem,1rem+2vw,3rem)] text-[#14261B] leading-tight max-w-3xl" style={balance}>{t.fTitle}</h2>
                <p className="text-sm sm:text-base text-[#2F4A3A] leading-relaxed max-w-2xl mt-4">{t.fSub}</p>
              </div>

              <div className="motif my-8" aria-hidden="true" />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                {FARMER_CARDS.map(({ Icon, en, hi }, i) => {
                  const [h, b] = lang === 'hi' ? hi : en;
                  return (
                    <article key={en[0]} className="farmer-card glass-soft rounded-2xl p-5 sm:p-6 reveal" style={cv({ '--d': `${i * 70}ms` })}>
                      <span className="farmer-ico"><Icon className="w-5 h-5" /></span>
                      <h3 className="f-serif text-lg mt-3 mb-1.5 text-[#14261B]">{h}</h3>
                      <p className="text-sm text-[#2F4A3A] leading-relaxed">{b}</p>
                    </article>
                  );
                })}
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-5 items-center reveal">
                <div className="md:col-span-7">
                  <p className="text-xs font-semibold text-[#2F4A3A] mb-2">{t.termsTitle}</p>
                  <div className="flex flex-wrap gap-2">
                    {SCHEME_CHIPS.map((c) => (<span key={c} className="chip">{c}</span>))}
                  </div>
                  <p className="text-[11px] text-[#55634F] mt-3 leading-relaxed max-w-xl">{t.termsNote}</p>
                </div>
                <a href="tel:18001801551" className="md:col-span-5 glass-soft loc-card rounded-2xl px-4 py-3.5 flex items-center gap-3">
                  <span className="loc-pin"><Phone className="w-4 h-4" /></span>
                  <span>
                    <span className="block text-xs font-semibold text-[#2F4A3A]">{t.helpline}</span>
                    <span className="f-serif text-xl num text-[#14261B]">1800-180-1551</span>
                  </span>
                </a>
              </div>
            </div>
          </section>

          {/* ------------------------- Data: map + lens + table ------------------------- */}
          <section id="datasets" className="wrap sec">
            <div className="paper rounded-3xl p-5 sm:p-8 md:p-12">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 mb-8 reveal">
                <div className="md:col-span-7">
                  <Kicker n="02">Earth observation</Kicker>
                  <h2 className="f-serif text-[clamp(1.6rem,1rem+2vw,3rem)] text-[#14261B] leading-tight" style={balance}>
                    {DATASETS.length === 8 ? 'Eight' : DATASETS.length} NASA sources, and each one sees the ground at a different size
                  </h2>
                </div>
                <p className="md:col-span-5 text-sm text-[#44544A] leading-relaxed md:pt-6">
                  AgriShift connects directly to the NASA POWER agroclimatology API for daily weather, solar radiation,
                  and 20-year anomaly baselines, alongside modular adapters for SMAP, GPM, MODIS, Landsat, ECOSTRESS, GRACE-FO, and SRTM.
                </p>
              </div>

              {/* Marquee of sources */}
              <div className="marquee mb-10 reveal" aria-hidden="true">
                <div className="marquee-track">
                  {marquee.map((d, i) => (<span key={`${d.id}-${i}`} className="chip">{d.name} · {d.grid}</span>))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 reveal min-w-0">
                  <div className="map-frame glass-soft p-2">
                    <div className="map-box"><LiveMap loc={loc} /></div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-[#55634F] pt-3">
                    <span>{loc.lat !== null ? `Map centred on ${loc.placeName ?? 'your location'}` : 'Map centres on your location once you allow access'}</span>
                    <span>© OpenStreetMap contributors</span>
                  </div>
                </div>

                {/* Lens instrument */}
                <div className="lg:col-span-5 reveal rounded-2xl glass-dark text-[#F4EEDC] p-5 sm:p-6 min-w-0" style={cv({ '--d': '120ms' })}>
                  <div className="flex items-baseline justify-between mb-3 gap-3">
                    <h3 className="f-serif text-lg">Pixel size over your parcel</h3>
                    <span className="f-hand text-lg text-[#E8C46A] whitespace-nowrap">60 km window</span>
                  </div>

                  <label className="block text-xs text-[#D9D3BE] mb-1.5" htmlFor="parcel">Your parcel size (hectares)</label>
                  <input id="parcel" className="field num mb-4" type="number" inputMode="decimal" min="0.01" step="0.1" value={parcelInput} onChange={(e) => setParcelInput(e.target.value)} />

                  <div className="lens-field relative aspect-square w-full max-w-[320px] mx-auto rounded-xl border border-white/40 overflow-hidden">
                    <div
                      className="lens-grid absolute inset-0"
                      style={{
                        opacity: coversView ? 0 : 1,
                        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.85) 1.5px, transparent 1.5px), linear-gradient(to bottom, rgba(255,255,255,0.85) 1.5px, transparent 1.5px)',
                        backgroundSize: `${cellShown}% ${cellShown}%`,
                        backgroundPosition: 'center',
                      }}
                    />
                    {coversView && <div className="absolute inset-0 border-4 border-white/80" />}
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-3.5 h-3.5 rounded-full bg-[#E8A317] border-2 border-white shadow-md" />
                  </div>

                  <div className="mt-4 text-sm leading-relaxed">
                    <div className="font-semibold">{lens.name} · pixel {sizeLabel(lens.res)}</div>
                    <div className="text-[#D9D3BE] mt-1">
                      {ratio >= 1 ? (
                        <>One pixel covers about <strong className="text-[#E8C46A] num">{fmt(ratio)}×</strong> your {parcelHa} ha parcel.</>
                      ) : (
                        <>Your {parcelHa} ha parcel spans about <strong className="text-[#E8C46A] num">{fmt(1 / ratio)}</strong> pixels.</>
                      )}
                    </div>
                    {(enlarged || coversView) && (
                      <div className="text-xs text-[#B9C2B0] mt-1.5">
                        {coversView ? 'This pixel is larger than the window shown.' : 'Grid drawn larger than true scale so you can see it.'}
                      </div>
                    )}
                    <div className="f-hand text-lg text-[#E8C46A] mt-3">pick another source from the table below</div>
                  </div>
                </div>
              </div>

              {/* Sources table */}
              <div className="mt-10 overflow-x-auto reveal">
                <table className="w-full text-left text-sm border-collapse min-w-[640px]">
                  <caption className="sr-only">NASA datasets, their pixel size and what they provide</caption>
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.12em] text-[#55634F] border-b-2 border-[#1F3D2B]">
                      <th className="py-2.5 pr-4 font-semibold">Dataset</th>
                      <th className="py-2.5 pr-4 font-semibold">Pixel</th>
                      <th className="py-2.5 pr-4 font-semibold">What it tells us</th>
                      <th className="py-2.5 font-semibold">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DATASETS.map((d) => {
                      const sel = d.id === lensId;
                      return (
                        <tr key={d.id} onClick={() => setLensId(d.id)} className="row-btn cursor-pointer border-b border-[#E6DCC2] hover:bg-white/40" style={{ background: sel ? 'rgba(232,163,23,0.18)' : undefined }}>
                          <td className="py-3 pr-4 font-semibold text-[#14261B]">
                            <button type="button" aria-pressed={sel} onClick={() => setLensId(d.id)} className="row-btn text-left">{d.name}</button>
                          </td>
                          <td className="py-3 pr-4 num text-[#2F4A3A] whitespace-nowrap">{d.grid}</td>
                          <td className="py-3 pr-4 text-[#44544A]">{d.gives}</td>
                          <td className="py-3 text-[#44544A] whitespace-nowrap"><span className={d.access === 'Live' ? 'font-semibold text-[#3F7D4C]' : ''}>{d.access}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ------------------------------ Workflow ------------------------------ */}
          <section id="workflow" className="wrap sec">
            <div className="glass rounded-3xl p-5 sm:p-8 md:p-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                <div className="lg:col-span-4 reveal">
                  <Kicker n="03">How it works</Kicker>
                  <h2 className="f-serif text-[clamp(1.6rem,1rem+2vw,3rem)] text-[#14261B] leading-tight lg:sticky lg:top-28" style={balance}>
                    From farm coordinates to a rotation you can explain
                  </h2>
                </div>
                <ol className="lg:col-span-8 divide-y divide-[#1F3D2B]/15">
                  {STEPS.map((s, i) => (
                    <li key={s.title} className="reveal grid grid-cols-[2.75rem_1fr] sm:grid-cols-[3.5rem_1fr] gap-4 py-6 first:pt-0 last:pb-0" style={cv({ '--d': `${i * 90}ms` })}>
                      <span className="f-serif text-4xl sm:text-5xl text-[#E8A317] leading-none num">{i + 1}</span>
                      <div>
                        <h3 className="f-serif text-xl text-[#14261B] mb-1.5">{s.title}</h3>
                        <p className="text-[#2F4A3A] leading-relaxed text-[15px]">{s.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          {/* ------------------------------ Rotations ------------------------------ */}
          <section id="rotations" className="wrap sec">
            <div className="paper rounded-3xl p-5 sm:p-8 md:p-12">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 reveal">
                <div className="md:max-w-2xl">
                  <Kicker n="04">Rotation model</Kicker>
                  <h2 className="f-serif text-[clamp(1.6rem,1rem+2vw,3rem)] text-[#14261B] leading-tight" style={balance}>
                    Three ways to run the same field
                  </h2>
                </div>
                <button type="button" onClick={handleExploreFarm} className="u-link inline-flex items-center gap-2 text-sm font-semibold text-[#1F3D2B] self-start md:self-auto">
                  <span>Adjust weights in Rotation Planner</span>
                  <ArrowRight className="arrow w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 reveal min-w-0">
                  <div className="inline-flex max-w-full border border-[#1F3D2B] rounded-full overflow-hidden mb-6" role="tablist" aria-label="Rotation strategy">
                    {STRATEGIES.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={strategyIdx === i}
                        onClick={() => setStrategyIdx(i)}
                        className="seg px-3 sm:px-5 py-2 text-sm font-semibold border-r border-[#1F3D2B] last:border-r-0"
                        style={{ background: strategyIdx === i ? '#1F3D2B' : 'transparent', color: strategyIdx === i ? '#FBF7EC' : '#1F3D2B' }}
                      >
                        Strategy {s.id}
                      </button>
                    ))}
                  </div>

                  <h3 className="f-serif text-2xl text-[#14261B] mb-3">{strategy.title}</h3>

                  <p className="text-[#2F4A3A] mb-6 leading-loose">
                    {strategy.seq.map((s, i) => (
                      <span key={`${strategy.id}-${s.crop}`}>
                        <span className="font-semibold text-[#14261B]">{s.crop}</span>{' '}<span className="f-deva text-xs text-[#55634F]">{CROP_HI[s.crop]}</span>{' '}
                        <span className="text-sm text-[#55634F]">({SEASONS[s.season].name})</span>
                        {i < strategy.seq.length - 1 && <span className="mx-2 text-[#B5482A]">→</span>}
                      </span>
                    ))}
                  </p>

                  {/* Structure measured straight from the sequence above */}
                  <div className="space-y-5 max-w-md">
                    {[
                      { label: 'Months with a crop in the field', value: `${st.cover} of 12`, pct: (st.cover / 12) * 100, color: '#3C7FA8' },
                      { label: 'Legume phases (put nitrogen back)', value: `${st.legumes} of ${st.crops}`, pct: (st.legumes / st.crops) * 100, color: '#3F7D4C' },
                      { label: 'Cereal phases (draw nitrogen)', value: `${st.cereals} of ${st.crops}`, pct: (st.cereals / st.crops) * 100, color: '#C7881C' },
                    ].map((b) => (
                      <div key={b.label}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-medium text-[#1B2A20]">{b.label}</span>
                          <span className="num font-semibold">{b.value}</span>
                        </div>
                        <div className="h-2.5 bg-[#E9E0C7] rounded-full overflow-hidden">
                          <div className="bar-fill h-full rounded-full" style={{ width: `${b.pct}%`, background: b.color }} />
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-[#55634F]">
                      Counted from the crop sequence. Real water and nitrogen figures for your parcel are calculated in the app from your NASA POWER series and soil values.
                    </p>
                  </div>

                  <p className="mt-6 text-[15px] text-[#2F4A3A] leading-relaxed max-w-lg border-l-2 border-[#E8A317] pl-4">
                    <span className="font-semibold text-[#14261B]">The catch:</span> {strategy.tradeoff}
                  </p>
                </div>

                {/* In-app simulator pitch (no placeholder numbers) */}
                <div className="lg:col-span-5 reveal glass-dark rounded-2xl p-6 md:p-7 relative min-w-0 text-[#F4EEDC]" style={cv({ '--d': '120ms' })}>
                  <span className="farmer-ico mb-4"><CloudRain className="w-5 h-5" /></span>
                  <h3 className="f-serif text-xl mb-2">What if the rain falls short?</h3>
                  <p className="text-sm text-[#D9D3BE] leading-relaxed mb-5">
                    The What-If Simulator lowers rainfall or adds a heat wave to your own parcel’s NASA POWER record, then shows how much irrigation each rotation would have to make up.
                  </p>
                  <ul className="text-sm space-y-2 mb-6 text-[#EDE7D2]">
                    <li className="flex gap-2"><span className="text-[#E8C46A]">→</span> Uses your location, not a sample farm</li>
                    <li className="flex gap-2"><span className="text-[#E8C46A]">→</span> {STRATEGIES.length} rotations side by side</li>
                    <li className="flex gap-2"><span className="text-[#E8C46A]">→</span> Missing inputs are flagged, never guessed</li>
                  </ul>
                  <button type="button" onClick={handleExploreFarm} className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold whitespace-nowrap">
                    <span>Open the simulator</span>
                    <ArrowRight className="arrow w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Full table, derived from the same data */}
              <div className="mt-12 overflow-x-auto reveal">
                <table className="w-full text-left border-collapse text-sm min-w-[760px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.12em] text-[#55634F] border-b-2 border-[#1F3D2B]">
                      <th className="py-2.5 pr-4 font-semibold">Strategy</th>
                      <th className="py-2.5 pr-4 font-semibold">Seasonal Sequence</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Months in crop</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Legume phases</th>
                      <th className="py-2.5 font-semibold">Primary Trade-Off</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STRATEGIES.map((s) => {
                      const m = structureOf(s);
                      return (
                        <tr key={s.id} className="border-b border-[#E6DCC2] hover:bg-white/40 transition-colors">
                          <td className="py-3.5 pr-4 font-semibold text-[#14261B]">Strategy {s.id} · {s.title}</td>
                          <td className="py-3.5 pr-4">{s.seq.map((x) => `${x.crop} (${SEASONS[x.season].name})`).join(' → ')}</td>
                          <td className="py-3.5 pr-4 text-right num">{m.cover} / 12</td>
                          <td className="py-3.5 pr-4 text-right num">{m.legumes}</td>
                          <td className="py-3.5 text-[#44544A]">{s.tradeoff}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ------------------------------ Transparency ------------------------------ */}
          <section id="transparency" className="wrap sec">
            <div className="glass rounded-3xl p-5 sm:p-8 md:p-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                <div className="lg:col-span-5 reveal">
                  <div className="relative max-w-[17rem] sm:max-w-sm mx-auto lg:mx-0" style={{ transform: 'rotate(-1.4deg)' }}>
                    <span className="tape -top-3 left-1/2 -translate-x-1/2" style={{ transform: 'translateX(-50%) rotate(2deg)' }} />
                    <div className="print bg-white p-3 pb-12 relative rounded-sm">
                      <div className="aspect-[4/5] overflow-hidden">
                        <img
                          src="/src/assets/images/soil_health_field_1794669906877.jpg"
                          alt="Healthy agricultural soil with young chickpea and wheat seedlings"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="f-hand text-xl text-[#2B3A2F] absolute bottom-2.5 left-5">chickpea and wheat, young</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 reveal min-w-0" style={cv({ '--d': '100ms' })}>
                  <Kicker n="05">Scientific transparency &amp; limitations</Kicker>
                  <h2 className="f-serif text-[clamp(1.6rem,1rem+2vw,3rem)] text-[#14261B] leading-tight mb-5" style={balance}>
                    Decision support, never unverified claims
                  </h2>
                  <p className="text-[#24392C] leading-relaxed mb-5">
                    AgriShift never invents satellite observations, never treats coarse 55 km climate pixels or NDVI canopy
                    greenness as direct field soil tests, and never guarantees crop yield or profit. Every score exposes its
                    methodology, missing inputs, and expert validation checklist.
                  </p>
                  <p className="text-sm text-[#2F4A3A] leading-relaxed mb-7">
                    <span className="font-semibold text-[#14261B]">Local agronomist alignment:</span>{' '}
                    generated PDF reports include specific verification items for Krishi Vigyan Kendra (KVK) experts.
                  </p>

                  <div className="paper rounded-2xl p-5 sm:p-6">
                    <h3 className="f-serif text-lg text-[#14261B] mb-1">What do you have on hand?</h3>
                    <p className="text-xs text-[#55634F] mb-4">
                      Tick what you already have. Missing lab pH, NPK, or unconfigured NASA Earthdata layers are flagged explicitly rather than silently imputed.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-5">
                      {CHECKS.map((c) => (
                        <label key={c.id} className="flex items-center gap-2.5 text-sm text-[#1B2A20] cursor-pointer select-none py-0.5">
                          <input type="checkbox" checked={checks[c.id]} onChange={() => setChecks((p) => ({ ...p, [c.id]: !p[c.id] }))} className="w-4 h-4 accent-[#1F3D2B]" />
                          {c.label}
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-[#E9E0C7] rounded-full overflow-hidden">
                        <div className="bar-fill h-full rounded-full" style={{ width: `${score}%`, background: score >= 80 ? '#3F7D4C' : score >= 50 ? '#C7881C' : '#B5482A' }} />
                      </div>
                      <span className="f-serif text-xl num text-[#14261B] w-14 text-right">{score}%</span>
                    </div>
                    <p className="text-xs text-[#44544A] mt-3 leading-relaxed">
                      {missing.length === 0 ? 'Nothing flagged. Every score can show its full inputs.' : `Flagged as missing: ${missing.map((m) => m.label.toLowerCase()).join(', ')}.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------- CTA ---------------------------------- */}
          <section className="wrap pb-32 sm:pb-44">
            <div className="glass rim rounded-3xl px-5 py-8 sm:px-8 sm:py-12 md:px-14 grid grid-cols-1 md:grid-cols-12 gap-8 items-center reveal">
              <Rim />
              <div className="md:col-span-8">
                <h2 className="f-serif text-[clamp(1.6rem,1rem+2vw,3rem)] text-[#14261B] leading-tight mb-3" style={balance}>
                  Walk through the whole cropping year
                </h2>
                <p className="text-[#24392C] max-w-xl">
                  Open the workspace, compare the rotations, and test a dry season before you plant anything.
                </p>
              </div>
              <div className="md:col-span-4 flex flex-col items-start md:items-end gap-3">
                <Tractor className="w-36 sm:w-44 -mb-1" />
                <button type="button" onClick={handleExploreFarm} className="btn-primary inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold whitespace-nowrap">
                  <span>{t.cta1}</span>
                  <ArrowRight className="arrow w-4 h-4" />
                </button>
                <span className="f-hand text-xl text-[#B5482A]">no sign-up needed to look around</span>
              </div>
            </div>
          </section>
        </main>

        {/* ------------------------------ Footer ------------------------------ */}
        <footer className="bg-[#17301F]/80 backdrop-blur-xl text-[#E9E3CE] relative border-t border-white/15">
          <div className="motif pt-0" aria-hidden="true" />
          <div className="wrap py-12 grid grid-cols-1 md:grid-cols-12 gap-8 text-sm">
            <div className="md:col-span-5">
              <div className="flex items-center gap-2 text-[#E8C46A] mb-3">
                <Sprout className="w-6 h-6" />
                <span className="f-serif text-xl text-[#F4EEDC]">AgriShift</span>
              </div>
              <p className="text-[#B9C2B0] leading-relaxed max-w-sm">A NASA Space Apps Challenge 2026 project (Field Shift): satellite data and soil results, turned into rotation choices farmers can explain.</p>
            </div>
            <div className="md:col-span-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#8FA08F] mb-3">On this page</div>
              <ul className="space-y-2">
                {navLinks.map(([l, h]) => (<li key={h}><a href={h} className="u-link hover:text-white">{l}</a></li>))}
              </ul>
            </div>
            <div className="md:col-span-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#8FA08F] mb-3">Credits</div>
              <p className="text-[#B9C2B0] leading-relaxed">
                Climate data sourced from NASA POWER (Langley Research Center). Agronomic baselines from ICAR &amp; FAO CropWat.
                Place names from OpenStreetMap Nominatim.
              </p>
            </div>
          </div>
          <div className="border-t border-white/10">
            <div className="wrap py-4 text-xs text-[#8FA08F]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>NASA Space Apps Challenge 2026 (Field Shift)</span>
                <span className="inline-flex items-center gap-2 f-deva text-[#E8C46A] text-sm">
                  <span className="tricolour" aria-hidden="true"><i /><i /><i /></span>
                  जय जवान, जय किसान
                </span>
              </div>
            </div>
          </div>
        </footer>

        <AuthModal
          isOpen={authModalOpen}
          initialMode={authModalMode}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => {
            setAuthModalOpen(false);
            navigate('/app/overview');
          }}
        />
      </div>
    </div>
  );
}