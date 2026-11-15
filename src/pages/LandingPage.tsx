import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DEMO_FARM } from '../../shared/data/demoFarm';
import { useAuth } from '../contexts/AuthContext';
import { FarmLeafletMap } from '../components/maps/FarmLeafletMap';
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

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */
type SeasonKey = 'kharif' | 'rabi' | 'zaid';

const SEASONS: Record<
  SeasonKey,
  { name: string; deva: string; window: string; months: number; crops: string[]; note: string; color: string }
> = {
  kharif: {
    name: 'Kharif',
    deva: 'खरीफ',
    window: 'June to October',
    months: 5,
    crops: ['Rice', 'Maize'],
    note: 'Sown with the monsoon. What matters most is how much rain actually arrives, and whether the field drains when it does.',
    color: '#5E9C5A',
  },
  rabi: {
    name: 'Rabi',
    deva: 'रबी',
    window: 'November to March',
    months: 5,
    crops: ['Wheat', 'Chickpea', 'Mustard'],
    note: 'The cool-season crops. They live off moisture left in the soil plus whatever irrigation you can spare.',
    color: '#D9A441',
  },
  zaid: {
    name: 'Zaid',
    deva: 'जायद',
    window: 'April to May',
    months: 2,
    crops: ['Green Gram', 'Black Gram'],
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

const STRATEGIES = [
  {
    id: 'A',
    title: 'Existing Baseline',
    seq: [
      { crop: 'Rice', season: 'kharif' as SeasonKey },
      { crop: 'Wheat', season: 'rabi' as SeasonKey },
    ],
    water: 1650,
    n: -240,
    nTone: '#B5482A',
    tradeoff: 'High irrigation draw & cereal nitrogen depletion; strong MSP access.',
  },
  {
    id: 'B',
    title: 'Soil Restoration',
    seq: [
      { crop: 'Rice', season: 'kharif' as SeasonKey },
      { crop: 'Chickpea', season: 'rabi' as SeasonKey },
      { crop: 'Green Gram', season: 'zaid' as SeasonKey },
    ],
    water: 1760,
    n: -60,
    nTone: '#3F7D4C',
    tradeoff: 'Rebuilds N & organic matter via 2 legume phases; tighter turnaround.',
  },
  {
    id: 'C',
    title: 'Climate & Water Resilience',
    seq: [
      { crop: 'Maize', season: 'kharif' as SeasonKey },
      { crop: 'Mustard', season: 'rabi' as SeasonKey },
      { crop: 'Black Gram', season: 'zaid' as SeasonKey },
    ],
    water: 1110,
    n: -163,
    nTone: '#C7881C',
    tradeoff: 'Saves ~33% water vs flooded paddy; requires well-drained Kharif soil.',
  },
];

// Illustrative assumption for the landing-page slider only
const ASSUMED_EFFECTIVE_RAIN_MM = 620;

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

html { scroll-behavior: smooth; scroll-padding-top: 5rem; }

.scene {
  --forest: #1F3D2B;
  --forest-2: #2E5A3F;
  --paper: #FBF7EC;
  --edge: #E6DCC2;
  --ink: #1B2A20;
  --muted: #55634F;
  --marigold: #E8A317;
  --clay: #B5482A;
  font-family: 'Public Sans', system-ui, sans-serif;
  color: var(--ink);
  transition: --hillA 2s ease, --hillB 2s ease, --hillC 2s ease, --plane1 2s ease,
              --cloud 2s ease, --stem 2s ease, --stem-b 2s ease, --grain 2s ease, --grain-b 2s ease;
}
/* Season palettes: hills, ground, vegetation and clouds all ease between these. */
.scene[data-season='kharif'] { --hillA: #4E8F5A; --hillB: #3F7D4C; --hillC: #5B9A52; --plane1: #4C9A4F; --cloud: #EEF3F6; --stem: #4F8A3A; --stem-b: #7DAF5C; --grain: #7FB04A; --grain-b: #A5CB6B; --stalk-h: .78; --stalk-o: .95; }
.scene[data-season='rabi']   { --hillA: #6A9A55; --hillB: #8AA94A; --hillC: #B7B54A; --plane1: #98A843; --cloud: #FFFFFF; --stem: #5A7D2E; --stem-b: #86A455; --grain: #D9A532; --grain-b: #E8C46A; --stalk-h: 1; --stalk-o: 1; }
.scene[data-season='zaid']   { --hillA: #A99A47; --hillB: #C2A245; --hillC: #D6AE4F; --plane1: #C69A38; --cloud: #FFF3D6; --stem: #8A8440; --stem-b: #B4A867; --grain: #C9A86A; --grain-b: #DCC694; --stalk-h: .6; --stalk-o: .8; }

.f-serif { font-family: 'Fraunces', Georgia, serif; font-weight: 600; letter-spacing: -0.015em; }
.f-hand  { font-family: 'Caveat', cursive; font-weight: 600; }
.f-deva  { font-family: 'Noto Sans Devanagari', sans-serif; font-weight: 600; }
.num     { font-variant-numeric: tabular-nums; }

/* ---------- Surfaces ---------- */
.glass {
  background: rgba(255,255,255,0.56);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  border: 1px solid rgba(255,255,255,0.75);
  box-shadow: 0 14px 34px -18px rgba(25,50,30,0.45), inset 0 1px 0 rgba(255,255,255,0.8);
  transition: box-shadow .5s ease;
}
.glass-bar {
  background: rgba(251,247,236,0.62);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  border-bottom: 1px solid rgba(255,255,255,0.7);
  transition: box-shadow .4s ease, background-color .4s ease;
}
.scene[data-scrolled] .glass-bar { background: rgba(251,247,236,0.82); box-shadow: 0 10px 28px -20px rgba(20,40,25,0.6); }
.glass-cap {
  background: rgba(20,40,28,0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
}
.paper {
  background-color: var(--paper);
  background-image: ${GRAIN};
  border: 1px solid var(--edge);
  box-shadow: 0 1px 0 #fff inset, 0 26px 44px -28px rgba(50,40,20,0.55);
}
.rule { border-color: var(--edge); }
.map-frame { border-radius: 10px; overflow: hidden; box-shadow: 0 18px 36px -22px rgba(20,40,25,.6); transition: box-shadow .5s ease, transform .5s ease; }
.map-frame:hover { transform: translateY(-3px); box-shadow: 0 26px 44px -22px rgba(20,40,25,.65); }

/* ---------- Scene (all animated layers use opacity or transform) ---------- */
.scene-sky, .scene-haze { position: fixed; inset: 0; z-index: 0; pointer-events: none; transition: opacity 2s ease; will-change: opacity; }

.scene-sunwrap { position: fixed; top: 0; right: 0; width: 0; height: 0; z-index: 0; pointer-events: none;
  transition: transform 2.4s cubic-bezier(.45,0,.2,1); will-change: transform; transform: translate3d(0,0,0); }
.scene-sun { position: absolute; top: -50px; right: 9vw; width: 120px; height: 120px; border-radius: 50%; transition: opacity 2s ease; will-change: opacity; }
.scene[data-season='kharif'] .scene-sunwrap { transform: translate3d(-4vw, 30px, 0) scale(.9); }
.scene[data-season='rabi']   .scene-sunwrap { transform: translate3d(-34vw, 150px, 0) scale(1.05); }
.scene[data-season='zaid']   .scene-sunwrap { transform: translate3d(-14vw, 20px, 0) scale(1.3); }

.scene-cloud { position: fixed; left: 0; z-index: 0; pointer-events: none; animation: cloudFly linear infinite; transition: opacity 2s ease; will-change: transform, opacity; }
.scene-hill { position: fixed; left: 0; right: 0; bottom: 0; width: 100%; z-index: 0; pointer-events: none;
  transform: translate3d(0, calc(var(--sy, 0) * var(--k, 0) * 1px), 0); will-change: transform; }
.scene-plane {
  position: fixed; left: -60%; right: -60%; bottom: -5vh; height: 52vh; z-index: 0; pointer-events: none;
  transform-origin: 50% 100%; transform: perspective(520px) rotateX(62deg);
  background:
    repeating-linear-gradient(90deg, rgba(20,60,30,0) 0 38px, rgba(20,60,30,0.2) 38px 44px),
    linear-gradient(to top, var(--plane1), rgba(255,255,255,0) 85%);
  -webkit-mask-image: linear-gradient(to top, #000 40%, transparent 100%);
          mask-image: linear-gradient(to top, #000 40%, transparent 100%);
}
.scene-rain { position: fixed; left: -10%; top: -20%; width: 120%; height: 140%; z-index: 0; pointer-events: none;
  background: repeating-linear-gradient(105deg, rgba(255,255,255,0) 0 22px, rgba(255,255,255,.9) 22px 23px, rgba(255,255,255,0) 23px 46px);
  transition: opacity 2s ease; animation: rainDrift 1.6s linear infinite; will-change: transform, opacity; }
.scene-stalks { position: fixed; left: 0; right: 0; bottom: -6px; height: 140px; z-index: 0; pointer-events: none;
  transform-origin: 50% 100%; transform: scaleY(var(--stalk-h, 1));
  transition: transform 2s cubic-bezier(.45,0,.2,1), opacity 2s ease; will-change: transform; }
.scene-stalks.back  { opacity: calc(var(--stalk-o, 1) * .55); }
.scene-stalks.front { opacity: calc(var(--stalk-o, 1) * .9); }
.stalk { position: absolute; bottom: 0; transform-origin: 50% 100%; animation: sway ease-in-out infinite; }

/* ---------- Buttons ---------- */
.btn-primary {
  position: relative; overflow: hidden; isolation: isolate;
  background: var(--forest); color: var(--paper); border-radius: 8px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 20px -10px rgba(20,50,30,0.8);
  transition: transform .25s ease, box-shadow .25s ease, color .3s ease;
}
.btn-primary::before {
  content: ''; position: absolute; inset: 0; z-index: -1; background: var(--marigold);
  transform: scaleX(0); transform-origin: left; transition: transform .4s cubic-bezier(.65,0,.35,1);
}
.btn-primary:hover { transform: translateY(-2px); color: var(--ink); box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 14px 24px -10px rgba(20,50,30,0.8); }
.btn-primary:hover::before { transform: scaleX(1); }
.btn-primary:active { transform: translateY(0); }

.btn-ghost {
  position: relative; overflow: hidden; isolation: isolate;
  border: 1.5px solid var(--forest); color: var(--forest); background: rgba(255,255,255,0.4); border-radius: 8px;
  transition: transform .25s ease, color .3s ease;
}
.btn-ghost::before {
  content: ''; position: absolute; inset: 0; z-index: -1; background: var(--forest);
  transform: scaleX(0); transform-origin: left; transition: transform .4s cubic-bezier(.65,0,.35,1);
}
.btn-ghost:hover { transform: translateY(-2px); color: var(--paper); }
.btn-ghost:hover::before { transform: scaleX(1); }

.btn-primary:focus-visible, .btn-ghost:focus-visible, .u-link:focus-visible, .seg:focus-visible, .row-btn:focus-visible {
  outline: 2px solid var(--marigold); outline-offset: 3px;
}
.arrow { transition: transform .25s ease; }
.btn-primary:hover .arrow, .btn-ghost:hover .arrow, .u-link:hover .arrow { transform: translateX(4px); }

.u-link { position: relative; }
.u-link::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: -3px; height: 1.5px; background: currentColor;
  transform: scaleX(0); transform-origin: left; transition: transform .3s ease;
}
.u-link:hover::after { transform: scaleX(1); }

/* ---------- Hand-made details ---------- */
.draw { stroke-dasharray: 260; stroke-dashoffset: 260; animation: draw 1.3s ease forwards; animation-delay: var(--d, 0.9s); }
.tape {
  position: absolute; width: 78px; height: 24px; background: rgba(226,205,140,0.72);
  box-shadow: 0 1px 2px rgba(0,0,0,0.18);
}
.print { box-shadow: 0 2px 4px rgba(0,0,0,0.18), 0 28px 40px -20px rgba(20,30,20,0.55); }

/* ---------- Controls ---------- */
.seg { transition: background .3s ease, color .3s ease, box-shadow .3s ease, transform .2s ease; }
.seg:active, .row-btn:active { transform: scale(.985); }
.bar-fill { transition: width .8s cubic-bezier(.2,.8,.2,1), background .4s ease; }
.row-btn { transition: background .25s ease; }

.range { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 999px; outline: none; background: #D9CFAE; }
.range::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; cursor: grab; background: var(--forest); border: 3px solid var(--paper); box-shadow: 0 3px 8px rgba(0,0,0,0.35); }
.range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; cursor: grab; background: var(--forest); border: 3px solid var(--paper); box-shadow: 0 3px 8px rgba(0,0,0,0.35); }

.lens-field {
  background:
    repeating-linear-gradient(90deg, rgba(10,50,25,0) 0 13px, rgba(10,50,25,0.22) 13px 16px),
    linear-gradient(160deg, #8DBF63, #3F8A4D 70%, #2E6E3E);
}
.lens-grid { transition: background-size .8s cubic-bezier(.2,.8,.2,1), opacity .4s ease; }

/* ---------- Reveal ---------- */
.reveal { opacity: 0; transform: translateY(20px); transition: opacity .8s ease, transform .8s cubic-bezier(.2,.8,.2,1); transition-delay: var(--d, 0ms); }
.reveal.is-visible { opacity: 1; transform: none; }
.hero-in { opacity: 0; animation: heroIn .9s cubic-bezier(.2,.8,.2,1) forwards; animation-delay: var(--d, 0ms); }

/* ---------- Keyframes ---------- */
@keyframes sway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes cloudFly { from { transform: translate3d(-35vw,0,0); } to { transform: translate3d(120vw,0,0); } }
@keyframes heroIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes rainDrift { from { transform: translate3d(0,-60px,0); } to { transform: translate3d(-16px,0,0); } }

/* ---------- Responsive ---------- */
@media (max-width: 1023px) {
  .scene-sunwrap { transform: translate3d(0,0,0) scale(.8) !important; }
}
@media (max-width: 640px) {
  .scene-stalks.back, .scene-rain { display: none; }
  .scene-sun { width: 90px; height: 90px; }
  .map-frame:hover { transform: none; }
}

/* ---------- Reduced motion: keep gentle colour changes, drop movement ---------- */
@media (prefers-reduced-motion: reduce) {
  .scene-cloud, .stalk, .scene-rain { animation: none !important; }
  .scene-rain { display: none; }
  .scene-sunwrap, .scene-stalks, .scene-hill { transition: none !important; transform: none !important; }
  .scene-sky, .scene-haze, .scene-sun, .scene-cloud { transition-duration: .4s; }
  .map-frame:hover { transform: none; }
  .draw { animation: none !important; stroke-dashoffset: 0; }
  .reveal, .hero-in { opacity: 1 !important; transform: none !important; animation: none !important; transition: none !important; }
  html { scroll-behavior: auto; }
}
`;

/* -------------------------------------------------------------------------- */
/*  Scroll-driven season                                                       */
/* -------------------------------------------------------------------------- */
/**
 * Opens on the real current season, then advances Kharif → Rabi → Zaid as the visitor
 * scrolls. Picking a season manually re-anchors the cycle at the current scroll position,
 * so the selector and background always agree. Also owns the parallax variable (--sy) and
 * a data-scrolled flag, via a single passive, rAF-throttled listener cleaned up on unmount.
 */
function useSeasonScroll(
  sceneRef: { current: HTMLElement | null },
  initial: SeasonKey
): [SeasonKey, (s: SeasonKey) => void] {
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
      const p = y / max;
      // The Seasons section sits inside the first third, so it still shows the current season.
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

const STALKS = Array.from({ length: 44 }, (_, i) => ({
  left: (i / 44) * 100 + (seeded(i) - 0.5) * 2,
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small bits                                                                 */
/* -------------------------------------------------------------------------- */
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

const fmt = (n: number) =>
  n >= 100 ? Math.round(n).toLocaleString('en-IN') : n >= 10 ? n.toFixed(0) : n >= 1 ? n.toFixed(1) : n.toFixed(2);
const sizeLabel = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${m} m`);

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */
export function LandingPage() {
  const navigate = useNavigate();
  const { signInWithGoogle, enterDemoMode, user } = useAuth();
  const sceneRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const [season, setSeason] = useSeasonScroll(sceneRef, currentSeasonFromDate());
  const [strategyIdx, setStrategyIdx] = useState(0);
  const [rain, setRain] = useState(0);
  const [lensId, setLensId] = useState<(typeof DATASETS)[number]['id']>('POWER');
  const [checks, setChecks] = useState<Record<string, boolean>>({
    boundary: true,
    irrigation: true,
    history: true,
    ph: false,
    npk: false,
    token: false,
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const handleExploreFarm = () => {
    enterDemoMode();
    navigate('/app/overview');
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      navigate('/app/overview');
    } catch {
      // If popup is blocked or cancelled, allow immediate demo workspace exploration
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
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ---- derived ---- */
  const todayMonthIdx = (today.getMonth() + 7) % 12;
  const todaySeason = currentSeasonFromDate(today);
  const S = SEASONS[season];

  const strategy = STRATEGIES[strategyIdx];
  const effRain = ASSUMED_EFFECTIVE_RAIN_MM * (1 + rain / 100);
  const gapFor = (w: number) => Math.max(0, w - effRain);
  const maxWater = 1800;

  const lens = DATASETS.find((d) => d.id === lensId)!;
  const parcelHa = Number(DEMO_FARM.area) || 1;
  const pixelHa = Math.pow(lens.res / 1000, 2) * 100;
  const ratio = pixelHa / parcelHa;
  const cellPct = (lens.res / 60000) * 100; // window represents 60 km
  const cellShown = Math.min(100, Math.max(cellPct, 2.6));
  const enlarged = cellPct < 2.6;
  const coversView = cellPct >= 100;

  const score = CHECKS.reduce((s, c) => s + (checks[c.id] ? c.weight : 0), 0);
  const missing = CHECKS.filter((c) => !checks[c.id]);

  return (
    <div ref={sceneRef} className="scene relative min-h-screen overflow-x-hidden" data-season={season}>
      <style>{STYLES}</style>
      <SceneBackground season={season} />

      <div className="relative z-10">
        {/* ------------------------------ Header ------------------------------ */}
        <header className="sticky top-0 z-30 glass-bar">
          <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
            <a href="#top" className="flex items-center gap-2 text-[#1F3D2B] whitespace-nowrap shrink-0">
              <Sprout className="w-6 h-6" />
              <span className="f-serif text-xl">AgriShift</span>
            </a>

            <nav aria-label="Primary" className="hidden md:flex items-center gap-7 text-sm font-medium text-[#3C4B40]">
              <a href="#seasons" className="u-link hover:text-[#1B2A20] whitespace-nowrap shrink-0">Seasons</a>
              <a href="#datasets" className="u-link hover:text-[#1B2A20] whitespace-nowrap shrink-0">NASA Data</a>
              <a href="#workflow" className="u-link hover:text-[#1B2A20] whitespace-nowrap shrink-0">How It Works</a>
              <a href="#rotations" className="u-link hover:text-[#1B2A20] whitespace-nowrap shrink-0">Rotation Model</a>
              <a href="#transparency" className="u-link hover:text-[#1B2A20] whitespace-nowrap shrink-0">Transparency</a>
            </nav>

            <div className="shrink-0 flex items-center gap-3">
              {user ? (
                <>
                  <span className="hidden sm:inline text-xs font-medium text-[#1F3D2B]">
                    {user.name || user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/app/overview')}
                    className="btn-primary px-4 py-2 text-sm font-medium whitespace-nowrap"
                  >
                    Go to Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('login');
                      setAuthModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#1F3D2B] hover:text-[#111C15] hover:bg-black/5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('register');
                      setAuthModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold border border-[#1F3D2B] text-[#1F3D2B] hover:bg-[#1F3D2B] hover:text-white rounded-lg transition-colors whitespace-nowrap hidden sm:inline-block"
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={handleExploreFarm}
                    className="btn-primary px-3.5 py-1.5 text-xs font-medium whitespace-nowrap"
                  >
                    Explore Farm
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main id="top">
          {/* ------------------------------- Hero ------------------------------- */}
          <section className="max-w-6xl mx-auto px-6 pt-14 pb-24 lg:pt-20 lg:pb-28">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7">
                <p className="hero-in text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2F4A3A] mb-2" style={cv({ '--d': '40ms' })}>
                  NASA Space Apps Challenge 2026 · Field Shift
                </p>
                <p className="hero-in f-deva text-lg text-[#1F3D2B] mb-5" style={cv({ '--d': '100ms' })}>
                  खेत की बात, आसमान से
                </p>
                <h1
                  className="hero-in f-serif text-[#14261B] leading-[1.06] mb-6"
                  style={cv({ '--d': '160ms' }, { fontSize: 'clamp(2.4rem, 4.6vw, 4rem)', textWrap: 'balance' } as CSSProperties)}
                >
                  Read your farm the way satellites do, then{' '}
                  <span className="relative inline-block whitespace-nowrap">
                    decide what to plant
                    <svg className="absolute left-0 -bottom-2 w-full h-3" viewBox="0 0 240 12" preserveAspectRatio="none" aria-hidden="true">
                      <path className="draw" d="M2 8 C 40 2, 80 11, 120 5 S 195 9, 238 4" stroke="#E8A317" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                    </svg>
                  </span>{' '}
                  next.
                </h1>
                <p className="hero-in text-base lg:text-lg text-[#24392C] leading-relaxed max-w-xl mb-8" style={cv({ '--d': '260ms' })}>
                  AgriShift pulls NASA Earth observations for your parcel, sets them beside your soil results, and lays
                  crop rotations out side by side, so you can see what each one costs in water and nitrogen before the season starts.
                </p>

                <div className="hero-in flex flex-wrap items-center gap-3 mb-4" style={cv({ '--d': '340ms' })}>
                  <button type="button" onClick={handleExploreFarm} className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold whitespace-nowrap">
                    <span>Explore Your Farm</span>
                    <ArrowRight className="arrow w-4 h-4" />
                  </button>
                  <a href="#datasets" className="btn-ghost inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold whitespace-nowrap">
                    See what data it reads
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

                <dl className="hero-in glass rounded-xl px-5 py-4 grid grid-cols-3 gap-4 max-w-xl" style={cv({ '--d': '480ms' })}>
                  {[
                    ['17', 'crops', 'ICAR & FAO agronomic profiles'],
                    ['8', 'NASA datasets', 'Live POWER + Earthdata adapters'],
                    ['4', 'strategies', 'Baseline vs soil & water models'],
                  ].map(([n, l, s]) => (
                    <div key={l} className="border-l border-[#1F3D2B]/20 pl-4 first:border-l-0 first:pl-0">
                      <dt className="text-sm text-[#1B2A20]">
                        <span className="f-serif text-2xl num mr-1.5 text-[#1F3D2B]">{n}</span>
                        {l}
                      </dt>
                      <dd className="text-xs text-[#4A5A4E] mt-1">{s}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Printed photo with tape and a margin note */}
              <div className="lg:col-span-5 hero-in relative lg:pl-4" style={cv({ '--d': '280ms' })}>
                <div className="relative mx-auto max-w-sm" style={{ transform: 'rotate(1.6deg)' }}>
                  <span className="tape -top-3 left-6" style={{ transform: 'rotate(-5deg)' }} />
                  <span className="tape -top-3 right-6" style={{ transform: 'rotate(4deg)' }} />
                  <div className="print bg-white p-3 pb-14">
                    <div className="aspect-[4/5] overflow-hidden bg-[#163026]">
                      <img
                        src="/src/assets/images/hero_agri_satellite_1794669905794.jpg"
                        alt="Aerial Earth observation view of geometric green crop fields and irrigation channels"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="f-hand text-xl text-[#2B3A2F] mt-3 absolute bottom-3 left-5 right-5 leading-tight">
                      Barabanki, UP · 26.9240° N, 81.1890° E
                    </p>
                  </div>
                </div>

                <div className="glass-cap rounded-lg text-white text-sm leading-snug px-4 py-3 max-w-[18rem] mt-6 ml-auto lg:-mt-2 lg:-ml-6 relative">
                  Our demonstration parcel: testing Kharif, Rabi and Zaid rotations against regional rainfall and heat anomalies.
                </div>

                <div className="hidden lg:flex absolute -right-2 top-2 items-start gap-1 f-hand text-xl text-[#14261B]" style={{ transform: 'rotate(5deg)' }} aria-hidden="true">
                  <span className="mt-6">the demo<br />parcel</span>
                  <svg width="54" height="64" viewBox="0 0 54 64" fill="none" stroke="#14261B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M44 6 C 36 22, 22 34, 8 44" />
                    <path d="M8 44 L10 32 M8 44 L20 46" />
                  </svg>
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------------ Seasons ------------------------------ */}
          <section id="seasons" className="max-w-6xl mx-auto px-6 pb-24">
            <div className="glass rounded-2xl p-6 md:p-10 reveal">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-8">
                <div className="md:col-span-7">
                  <Kicker n="01">Seasons</Kicker>
                  <h2 className="f-serif text-3xl md:text-4xl text-[#14261B] leading-tight" style={{ textWrap: 'balance' } as CSSProperties}>
                    The cropping year, counted the way farmers count it
                  </h2>
                </div>
                <p className="md:col-span-5 text-sm text-[#2F4A3A] leading-relaxed md:pt-6">
                  Every rotation in AgriShift is scored season by season. Pick one below and the sky behind this page will follow.
                </p>
              </div>

              {/* almanac bar */}
              <div className="relative pt-9">
                <div
                  className="absolute top-0 flex flex-col items-center -translate-x-1/2 transition-all duration-500"
                  style={{ left: `${((todayMonthIdx + 0.5) / 12) * 100}%` }}
                  aria-hidden="true"
                >
                  <span className="f-hand text-lg leading-none text-[#B5482A]">today</span>
                  <span className="block w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-[#B5482A]" />
                </div>

                <div className="flex h-16 rounded-lg overflow-hidden border border-white/80 shadow-sm" role="tablist" aria-label="Season">
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
                        className="seg relative flex items-center justify-center gap-2 px-2 text-sm font-semibold border-r border-white/70 last:border-r-0"
                        style={{
                          flex: s.months,
                          background: active ? s.color : `${s.color}55`,
                          color: active ? (k === 'rabi' ? '#2A1E05' : '#fff') : '#1B2A20',
                          boxShadow: active ? 'inset 0 -4px 0 rgba(0,0,0,0.18)' : 'none',
                        }}
                      >
                        <span>{s.name}</span>
                        <span className="f-deva text-xs opacity-90 hidden sm:inline">{s.deva}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-12 mt-2 text-[11px] text-[#4A5A4E] num">
                  {MONTHS.map((m) => (
                    <span key={m} className="text-center">{m}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mt-9 pt-8 border-t border-[#1F3D2B]/15">
                <div className="md:col-span-5">
                  <div className="f-serif text-5xl text-[#14261B] leading-none">{S.name}</div>
                  <div className="f-deva text-2xl text-[#1F3D2B] mt-2">{S.deva}</div>
                  <div className="text-sm text-[#4A5A4E] mt-2">{S.window}{season === todaySeason ? ' · this is the current season' : ''}</div>
                </div>
                <div className="md:col-span-7">
                  <p className="text-[#24392C] leading-relaxed">{S.note}</p>
                  <p className="text-sm mt-4">
                    <span className="font-semibold text-[#1B2A20]">Crops in the model:</span>{' '}
                    <span className="text-[#2F4A3A]">{S.crops.join(', ')}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ------------------------- Data: map + lens + table ------------------------- */}
          <section id="datasets" className="max-w-6xl mx-auto px-6 pb-24">
            <div className="paper rounded-lg p-6 md:p-10">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10 reveal">
                <div className="md:col-span-7">
                  <Kicker n="02">Earth observation</Kicker>
                  <h2 className="f-serif text-3xl md:text-4xl text-[#14261B] leading-tight" style={{ textWrap: 'balance' } as CSSProperties}>
                    Eight NASA sources, and each one sees the ground at a different size
                  </h2>
                </div>
                <p className="md:col-span-5 text-sm text-[#44544A] leading-relaxed md:pt-6">
                  AgriShift connects directly to the NASA POWER agroclimatology API for daily weather, solar radiation,
                  and 20-year anomaly baselines, alongside modular adapters for SMAP, GPM, MODIS, Landsat, ECOSTRESS, GRACE-FO, and SRTM.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 reveal">
                  <div className="map-frame p-2 bg-white border border-[#E6DCC2] shadow-sm">
                    <FarmLeafletMap
                      farm={DEMO_FARM}
                      heightClass="h-[380px]"
                      baseLayer="satellite"
                      showBoundary={true}
                      showRiskZoneOverlay={true}
                      riskLevel="Moderate"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#55634F] pt-3">
                    <span>Interactive Parcel Preview · {DEMO_FARM.name} ({DEMO_FARM.area} ha)</span>
                    <span>Boundary geometry validated with Turf.js</span>
                  </div>
                </div>

                {/* Lens instrument */}
                <div className="lg:col-span-5 reveal rounded-lg bg-[#1F3D2B] text-[#F4EEDC] p-5 shadow-[0_24px_40px_-24px_rgba(20,40,25,0.8)]" style={cv({ '--d': '120ms' })}>
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="f-serif text-lg">Pixel size over your parcel</h3>
                    <span className="f-hand text-lg text-[#E8C46A]">60 km window</span>
                  </div>

                  <div className="lens-field relative aspect-square w-full max-w-[290px] mx-auto rounded border border-white/40 overflow-hidden">
                    <div
                      className="lens-grid absolute inset-0"
                      style={{
                        opacity: coversView ? 0 : 1,
                        backgroundImage:
                          'linear-gradient(to right, rgba(255,255,255,0.85) 1.5px, transparent 1.5px), linear-gradient(to bottom, rgba(255,255,255,0.85) 1.5px, transparent 1.5px)',
                        backgroundSize: `${cellShown}% ${cellShown}%`,
                        backgroundPosition: 'center',
                      }}
                    />
                    {coversView && <div className="absolute inset-0 border-4 border-white/80" />}
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-3.5 h-3.5 rounded-full bg-[#E8A317] border-2 border-white shadow-md" />
                  </div>

                  <div className="mt-4 text-sm leading-relaxed">
                    <div className="font-semibold">
                      {lens.name} · pixel {sizeLabel(lens.res)}
                    </div>
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
                <table className="w-full text-left text-sm border-collapse">
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
                        <tr
                          key={d.id}
                          onClick={() => setLensId(d.id)}
                          className="row-btn cursor-pointer border-b border-[#E6DCC2]"
                          style={{ background: sel ? 'rgba(232,163,23,0.16)' : undefined }}
                        >
                          <td className="py-3 pr-4 font-semibold text-[#14261B]">
                            <button type="button" aria-pressed={sel} onClick={() => setLensId(d.id)} className="row-btn text-left">
                              {d.name}
                            </button>
                          </td>
                          <td className="py-3 pr-4 num text-[#2F4A3A] whitespace-nowrap">{d.grid}</td>
                          <td className="py-3 pr-4 text-[#44544A]">{d.gives}</td>
                          <td className="py-3 text-[#44544A] whitespace-nowrap">
                            <span className={d.access === 'Live' ? 'font-semibold text-[#3F7D4C]' : ''}>{d.access}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ------------------------------ Workflow ------------------------------ */}
          <section id="workflow" className="max-w-6xl mx-auto px-6 pb-24">
            <div className="glass rounded-2xl p-6 md:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 reveal">
                  <Kicker n="03">How it works</Kicker>
                  <h2 className="f-serif text-3xl md:text-4xl text-[#14261B] leading-tight lg:sticky lg:top-28" style={{ textWrap: 'balance' } as CSSProperties}>
                    From farm coordinates to a rotation you can explain
                  </h2>
                </div>
                <ol className="lg:col-span-8 divide-y divide-[#1F3D2B]/15">
                  {STEPS.map((s, i) => (
                    <li key={s.title} className="reveal grid grid-cols-[3.5rem_1fr] gap-4 py-6 first:pt-0 last:pb-0" style={cv({ '--d': `${i * 90}ms` })}>
                      <span className="f-serif text-5xl text-[#E8A317] leading-none num">{i + 1}</span>
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
          <section id="rotations" className="max-w-6xl mx-auto px-6 pb-24">
            <div className="paper rounded-lg p-6 md:p-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 reveal">
                <div className="md:max-w-2xl">
                  <Kicker n="04">Rotation model · illustrative Barabanki benchmark</Kicker>
                  <h2 className="f-serif text-3xl md:text-4xl text-[#14261B] leading-tight" style={{ textWrap: 'balance' } as CSSProperties}>
                    Three ways to run the same field
                  </h2>
                </div>
                <button type="button" onClick={handleExploreFarm} className="u-link inline-flex items-center gap-2 text-sm font-semibold text-[#1F3D2B] whitespace-nowrap">
                  <span>Adjust weights in Rotation Planner</span>
                  <ArrowRight className="arrow w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Explorer */}
                <div className="lg:col-span-7 reveal">
                  <div className="inline-flex border border-[#1F3D2B] rounded-md overflow-hidden mb-6" role="tablist" aria-label="Rotation strategy">
                    {STRATEGIES.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={strategyIdx === i}
                        onClick={() => setStrategyIdx(i)}
                        className="seg px-4 py-2 text-sm font-semibold border-r border-[#1F3D2B] last:border-r-0"
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
                        <span className="font-semibold text-[#14261B]">{s.crop}</span>{' '}
                        <span className="text-sm text-[#55634F]">({SEASONS[s.season].name})</span>
                        {i < strategy.seq.length - 1 && <span className="mx-2 text-[#B5482A]">→</span>}
                      </span>
                    ))}
                  </p>

                  <div className="space-y-5 max-w-md">
                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-[#1B2A20]">Annual water</span>
                        <span className="num font-semibold">~{strategy.water.toLocaleString('en-IN')} mm</span>
                      </div>
                      <div className="h-2.5 bg-[#E9E0C7] rounded-full overflow-hidden">
                        <div className="bar-fill h-full rounded-full bg-[#3C7FA8]" style={{ width: `${(strategy.water / maxWater) * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-[#1B2A20]">Net N balance</span>
                        <span className="num font-semibold" style={{ color: strategy.nTone }}>{strategy.n} kg/ha</span>
                      </div>
                      <div className="h-2.5 bg-[#E9E0C7] rounded-full overflow-hidden">
                        <div className="bar-fill h-full rounded-full" style={{ width: `${(Math.abs(strategy.n) / 250) * 100}%`, background: strategy.nTone }} />
                      </div>
                      <p className="text-xs text-[#55634F] mt-1.5">Shorter is better: less nitrogen drawn out of the soil.</p>
                    </div>
                  </div>

                  <p className="mt-6 text-[15px] text-[#2F4A3A] leading-relaxed max-w-lg border-l-2 border-[#E8A317] pl-4">
                    <span className="font-semibold text-[#14261B]">The catch:</span> {strategy.tradeoff}
                  </p>
                </div>

                {/* What-if */}
                <div className="lg:col-span-5 reveal bg-white/70 border border-[#E6DCC2] rounded-lg p-5 md:p-6 relative" style={cv({ '--d': '120ms' })}>
                  <h3 className="f-serif text-xl text-[#14261B] mb-1">What if the rain falls short?</h3>
                  <p className="text-sm text-[#55634F] mb-6">Irrigation each rotation would have to make up.</p>

                  <div className="flex items-baseline justify-between mb-3">
                    <label htmlFor="rain" className="text-sm font-medium text-[#1B2A20]">Rainfall change</label>
                    <span className="f-serif text-3xl num text-[#1F3D2B]">{rain > 0 ? '+' : ''}{rain}%</span>
                  </div>
                  <input id="rain" type="range" min={-40} max={20} step={5} value={rain} onChange={(e) => setRain(Number(e.target.value))} className="range" />
                  <div className="flex justify-between text-[11px] text-[#55634F] mt-2 mb-6 num">
                    <span>−40%</span><span>0</span><span>+20%</span>
                  </div>

                  <div className="space-y-3">
                    {STRATEGIES.map((s, i) => {
                      const gap = gapFor(s.water);
                      const sel = i === strategyIdx;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setStrategyIdx(i)}
                          className="row-btn w-full text-left rounded-md px-3 py-2.5 border"
                          style={{ borderColor: sel ? '#1F3D2B' : '#E6DCC2', background: sel ? '#fff' : 'transparent' }}
                        >
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="font-semibold text-[#14261B]">Strategy {s.id}</span>
                            <span className="num text-[#2F4A3A]">{Math.round(gap).toLocaleString('en-IN')} mm</span>
                          </div>
                          <div className="h-2 bg-[#E9E0C7] rounded-full overflow-hidden">
                            <div className="bar-fill h-full rounded-full" style={{ width: `${(gap / maxWater) * 100}%`, background: sel ? '#1F3D2B' : '#9DB09F' }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-[#55634F] mt-5 leading-relaxed">
                    Illustrative only. Assumes {ASSUMED_EFFECTIVE_RAIN_MM} mm of effective rainfall a year at 0%.
                    In the app, this comes from your parcel's NASA POWER series.
                  </p>

                  <div className="hidden lg:flex absolute -top-9 right-6 items-end gap-1 f-hand text-xl text-[#B5482A]" style={{ transform: 'rotate(-4deg)' }} aria-hidden="true">
                    <span>try dragging it</span>
                    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="#B5482A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 6 C 8 20, 18 26, 28 28" />
                      <path d="M28 28 L19 21 M28 28 L21 33" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Full table */}
              <div className="mt-12 overflow-x-auto reveal">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.12em] text-[#55634F] border-b-2 border-[#1F3D2B]">
                      <th className="py-2.5 pr-4 font-semibold">Strategy</th>
                      <th className="py-2.5 pr-4 font-semibold">Seasonal Sequence</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Annual Water</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Net N Balance</th>
                      <th className="py-2.5 font-semibold">Primary Trade-Off</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#E6DCC2]">
                      <td className="py-3.5 pr-4 font-semibold text-[#14261B]">Strategy A · Existing Baseline</td>
                      <td className="py-3.5 pr-4">Rice (Kharif) → Wheat (Rabi)</td>
                      <td className="py-3.5 pr-4 text-right num">~1,650 mm</td>
                      <td className="py-3.5 pr-4 text-right num text-[#B5482A]">-240 kg/ha</td>
                      <td className="py-3.5 text-[#44544A]">High irrigation draw & cereal nitrogen depletion; strong MSP access.</td>
                    </tr>
                    <tr className="border-b border-[#E6DCC2]">
                      <td className="py-3.5 pr-4 font-semibold text-[#14261B]">Strategy B · Soil Restoration</td>
                      <td className="py-3.5 pr-4">Rice (Kharif) → Chickpea (Rabi) → Green Gram (Zaid)</td>
                      <td className="py-3.5 pr-4 text-right num">~1,760 mm</td>
                      <td className="py-3.5 pr-4 text-right num text-[#3F7D4C]">-60 kg/ha</td>
                      <td className="py-3.5 text-[#44544A]">Rebuilds N & organic matter via 2 legume phases; tighter turnaround.</td>
                    </tr>
                    <tr className="border-b border-[#E6DCC2]">
                      <td className="py-3.5 pr-4 font-semibold text-[#14261B]">Strategy C · Climate & Water Resilience</td>
                      <td className="py-3.5 pr-4">Maize (Kharif) → Mustard (Rabi) → Black Gram (Zaid)</td>
                      <td className="py-3.5 pr-4 text-right num">~1,110 mm</td>
                      <td className="py-3.5 pr-4 text-right num text-[#C7881C]">-163 kg/ha</td>
                      <td className="py-3.5 text-[#44544A]">Saves ~33% water vs flooded paddy; requires well-drained Kharif soil.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ------------------------------ Transparency ------------------------------ */}
          <section id="transparency" className="max-w-6xl mx-auto px-6 pb-24">
            <div className="glass rounded-2xl p-6 md:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-5 reveal">
                  <div className="relative max-w-sm mx-auto lg:mx-0" style={{ transform: 'rotate(-1.4deg)' }}>
                    <span className="tape -top-3 left-1/2 -translate-x-1/2" style={{ transform: 'translateX(-50%) rotate(2deg)' }} />
                    <div className="print bg-white p-3 pb-12">
                      <div className="aspect-[4/5] overflow-hidden">
                        <img
                          src="/src/assets/images/soil_health_field_1794669906877.jpg"
                          alt="Healthy agricultural soil with young chickpea and wheat seedlings"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="f-hand text-xl text-[#2B3A2F] absolute bottom-2.5 left-5">chickpea and wheat, young</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 reveal" style={cv({ '--d': '100ms' })}>
                  <Kicker n="05">Scientific transparency &amp; limitations</Kicker>
                  <h2 className="f-serif text-3xl md:text-4xl text-[#14261B] leading-tight mb-5" style={{ textWrap: 'balance' } as CSSProperties}>
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

                  {/* checklist */}
                  <div className="paper rounded-lg p-5">
                    <h3 className="f-serif text-lg text-[#14261B] mb-1">What do you have on hand?</h3>
                    <p className="text-xs text-[#55634F] mb-4">
                      Missing lab pH, NPK, or unconfigured NASA Earthdata layers are flagged explicitly rather than silently imputed.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-5">
                      {CHECKS.map((c) => (
                        <label key={c.id} className="flex items-center gap-2.5 text-sm text-[#1B2A20] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={checks[c.id]}
                            onChange={() => setChecks((p) => ({ ...p, [c.id]: !p[c.id] }))}
                            className="w-4 h-4 accent-[#1F3D2B]"
                          />
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
                      {missing.length === 0
                        ? 'Nothing flagged. Every score can show its full inputs.'
                        : `Flagged as missing: ${missing.map((m) => m.label.toLowerCase()).join(', ')}.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------- CTA ---------------------------------- */}
          <section className="max-w-6xl mx-auto px-6 pb-44">
            <div className="glass rounded-2xl px-6 py-10 md:px-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center reveal">
              <div className="md:col-span-8">
                <h2 className="f-serif text-3xl md:text-4xl text-[#14261B] leading-tight mb-3" style={{ textWrap: 'balance' } as CSSProperties}>
                  Walk one parcel through the whole cropping year
                </h2>
                <p className="text-[#24392C] max-w-xl">
                  Open the demonstration farm, compare the rotations, and test a dry season before you plant anything.
                </p>
              </div>
              <div className="md:col-span-4 flex flex-col items-start md:items-end gap-3">
                <button type="button" onClick={handleExploreFarm} className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold whitespace-nowrap">
                  <span>Explore Your Farm</span>
                  <ArrowRight className="arrow w-4 h-4" />
                </button>
                <span className="f-hand text-xl text-[#B5482A]">no sign-up needed for the demo</span>
              </div>
            </div>
          </section>
        </main>

        {/* ------------------------------ Footer ------------------------------ */}
        <footer className="bg-[#17301F] text-[#E9E3CE] relative">
          <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-12 gap-8 text-sm">
            <div className="md:col-span-5">
              <div className="flex items-center gap-2 text-[#E8C46A] mb-3">
                <Sprout className="w-6 h-6" />
                <span className="f-serif text-xl text-[#F4EEDC]">AgriShift</span>
              </div>
              <p className="text-[#B9C2B0] leading-relaxed max-w-sm">
                A NASA Space Apps Challenge 2026 project (Field Shift), built around a demonstration parcel in Barabanki, Uttar Pradesh.
              </p>
            </div>
            <div className="md:col-span-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#8FA08F] mb-3">On this page</div>
              <ul className="space-y-2">
                {[['Seasons', '#seasons'], ['NASA Data', '#datasets'], ['How It Works', '#workflow'], ['Rotation Model', '#rotations'], ['Transparency', '#transparency']].map(([l, h]) => (
                  <li key={h}><a href={h} className="u-link hover:text-white">{l}</a></li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#8FA08F] mb-3">Credits</div>
              <p className="text-[#B9C2B0] leading-relaxed">
                Climate data sourced from NASA POWER (Langley Research Center). Agronomic baselines from ICAR &amp; FAO CropWat.
              </p>
            </div>
          </div>
          <div className="border-t border-white/10">
            <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-[#8FA08F]">
              NASA Space Apps Challenge 2026 (Field Shift)
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