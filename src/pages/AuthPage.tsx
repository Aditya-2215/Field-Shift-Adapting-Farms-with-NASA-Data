import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  FlaskConical,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Satellite,
  User as UserIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'register' | 'forgot' | 'reset';
type Lang = 'en' | 'hi';

const MODES: Mode[] = ['login', 'register', 'forgot', 'reset'];

/* -------------------------------------------------------------------------- */
/*  Copy (English / हिंदी)                                                     */
/* -------------------------------------------------------------------------- */
const T = {
  en: {
    back: 'Back to AgriShift AI',
    greet: 'Namaste',
    heroTitle: 'Your farm, read from the sky',
    heroSub: 'Sign in to compare crop rotations, test a dry monsoon and export reports your KVK can check.',
    features: [
      { t: 'NASA Earth data', d: 'Rainfall, heat and sunlight for your own parcel.' },
      { t: 'Soil-aware', d: 'Bring your Soil Health Card or lab pH and NPK values.' },
      { t: 'Reports for your KVK', d: 'PDF and CSV with a verification list for experts.' },
    ],
    title: {
      login: 'Sign in to AgriShift AI',
      register: 'Create your farmer account',
      forgot: 'Reset your password',
      reset: 'Set new password',
    },
    sub: {
      login: 'Enter your credentials to access farm intelligence and rotation models',
      register: 'Start building resilient farms using Earth observation intelligence',
      forgot: 'We will send you instructions to safely reset your password',
      reset: 'Enter your reset token and your chosen new password',
    },
    google: 'Continue with Google',
    or: 'Or continue with email',
    fullName: 'Full Name',
    email: 'Email Address',
    password: 'Password',
    newPassword: 'New Password',
    confirm: 'Confirm Password',
    token: 'Password Reset Token',
    phName: 'e.g. Ramesh Kumar',
    phToken: 'Paste reset token here',
    forgotLink: 'Forgot password?',
    remember: 'Remember session on this device',
    strength: 'Password strength requirements:',
    met: 'met',
    rules: ['At least 8 characters', '1 uppercase letter', '1 lowercase letter', '1 number', '1 special character'],
    submit: {
      login: 'Sign In',
      register: 'Create Account',
      forgot: 'Send Password Reset Link',
      reset: 'Reset Password',
    },
    noAccount: "Don't have an account yet?",
    createLink: 'Create an account',
    haveAccount: 'Already have an account?',
    signInLink: 'Sign in',
    remembered: 'Remember your password?',
    returnLink: 'Return to sign in',
    show: 'Show password',
    hide: 'Hide password',
    err: {
      loginMissing: 'Please enter email and password.',
      name: 'Please provide your full name.',
      email: 'Please provide a valid email address.',
      strength: 'Please ensure your password meets all strength criteria.',
      mismatch: 'Passwords do not match.',
      forgotEmail: 'Please enter your email address.',
      token: 'Please provide the reset token.',
      generic: 'An error occurred.',
    },
    resetDone: 'Password has been reset successfully. You can now sign in.',
    slogan: 'Jai Jawan, Jai Kisan',
  },
  hi: {
    back: 'AgriShift AI पर वापस जाएँ',
    greet: 'नमस्ते',
    heroTitle: 'आपका खेत, आसमान की नज़र से',
    heroSub: 'साइन इन करके फसल चक्र की तुलना करें, कम मानसून की स्थिति जाँचें और अपने KVK के लिए रिपोर्ट निकालें।',
    features: [
      { t: 'NASA का पृथ्वी डेटा', d: 'आपके अपने खेत के लिए बारिश, गर्मी और धूप के आँकड़े।' },
      { t: 'मिट्टी की समझ', d: 'मृदा स्वास्थ्य कार्ड या लैब के pH और NPK मान जोड़ें।' },
      { t: 'KVK के लिए रिपोर्ट', d: 'विशेषज्ञों की जाँच-सूची के साथ PDF और CSV।' },
    ],
    title: {
      login: 'AgriShift AI में साइन इन करें',
      register: 'अपना किसान खाता बनाएँ',
      forgot: 'पासवर्ड रीसेट करें',
      reset: 'नया पासवर्ड बनाएँ',
    },
    sub: {
      login: 'खेत की जानकारी और फसल चक्र देखने के लिए अपने विवरण भरें',
      register: 'पृथ्वी अवलोकन की मदद से मज़बूत खेती की शुरुआत करें',
      forgot: 'हम आपको पासवर्ड सुरक्षित रीसेट करने के निर्देश भेजेंगे',
      reset: 'अपना रीसेट टोकन और नया पासवर्ड भरें',
    },
    google: 'Google से जारी रखें',
    or: 'या ईमेल से जारी रखें',
    fullName: 'पूरा नाम',
    email: 'ईमेल पता',
    password: 'पासवर्ड',
    newPassword: 'नया पासवर्ड',
    confirm: 'पासवर्ड की पुष्टि करें',
    token: 'पासवर्ड रीसेट टोकन',
    phName: 'जैसे रमेश कुमार',
    phToken: 'रीसेट टोकन यहाँ चिपकाएँ',
    forgotLink: 'पासवर्ड भूल गए?',
    remember: 'इस डिवाइस पर सत्र याद रखें',
    strength: 'पासवर्ड की ज़रूरी शर्तें:',
    met: 'पूरी',
    rules: ['कम से कम 8 अक्षर', '1 बड़ा अंग्रेज़ी अक्षर', '1 छोटा अंग्रेज़ी अक्षर', '1 अंक', '1 विशेष चिह्न'],
    submit: {
      login: 'साइन इन',
      register: 'खाता बनाएँ',
      forgot: 'रीसेट लिंक भेजें',
      reset: 'पासवर्ड रीसेट करें',
    },
    noAccount: 'अभी खाता नहीं है?',
    createLink: 'खाता बनाएँ',
    haveAccount: 'पहले से खाता है?',
    signInLink: 'साइन इन करें',
    remembered: 'पासवर्ड याद आ गया?',
    returnLink: 'साइन इन पर लौटें',
    show: 'पासवर्ड दिखाएँ',
    hide: 'पासवर्ड छिपाएँ',
    err: {
      loginMissing: 'कृपया ईमेल और पासवर्ड भरें।',
      name: 'कृपया अपना पूरा नाम लिखें।',
      email: 'कृपया सही ईमेल पता लिखें।',
      strength: 'कृपया ऐसा पासवर्ड रखें जो सभी शर्तें पूरी करे।',
      mismatch: 'दोनों पासवर्ड एक जैसे नहीं हैं।',
      forgotEmail: 'कृपया अपना ईमेल पता लिखें।',
      token: 'कृपया रीसेट टोकन भरें।',
      generic: 'कुछ गड़बड़ हो गई।',
    },
    resetDone: 'पासवर्ड सफलतापूर्वक रीसेट हो गया। अब आप साइन इन कर सकते हैं।',
    slogan: 'जय जवान, जय किसान',
  },
};

const FEATURE_ICONS: LucideIcon[] = [Satellite, FlaskConical, FileCheck2];

/* -------------------------------------------------------------------------- */
/*  Styles                                                                     */
/* -------------------------------------------------------------------------- */
const FRAME_BORDER =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='42' height='42' viewBox='0 0 42 42' fill='none'>" +
  "<g stroke='%23E8A317' stroke-width='1.3'>" +
  "<circle cx='7' cy='7' r='5'/><circle cx='35' cy='7' r='5'/><circle cx='7' cy='35' r='5'/><circle cx='35' cy='35' r='5'/>" +
  "<path d='M21 2 L26 7 L21 12 L16 7Z'/><path d='M21 30 L26 35 L21 40 L16 35Z'/><path d='M2 21 L7 16 L12 21 L7 26Z'/><path d='M30 21 L35 16 L40 21 L35 26Z'/>" +
  "<path d='M14 1.2 H28 M14 40.8 H28 M1.2 14 V28 M40.8 14 V28' stroke-width='1'/>" +
  "</g>" +
  "<g fill='%232E7D4F'><circle cx='7' cy='7' r='2'/><circle cx='35' cy='7' r='2'/><circle cx='7' cy='35' r='2'/><circle cx='35' cy='35' r='2'/>" +
  "<circle cx='21' cy='7' r='1.4'/><circle cx='21' cy='35' r='1.4'/><circle cx='7' cy='21' r='1.4'/><circle cx='35' cy='21' r='1.4'/></g>" +
  "<g fill='%23E8A317'><circle cx='3.2' cy='7' r='.9'/><circle cx='10.8' cy='7' r='.9'/><circle cx='31.2' cy='35' r='.9'/><circle cx='38.8' cy='35' r='.9'/></g>" +
  "</svg>\")";

const MOTIF =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='14'><path d='M14 1 L21 7 L14 13 L7 7Z' fill='none' stroke='%23E8A317' stroke-width='1.6'/><circle cx='14' cy='7' r='1.8' fill='%232E7D4F'/><circle cx='0' cy='7' r='1.4' fill='%23E8A317'/><circle cx='28' cy='7' r='1.4' fill='%23E8A317'/></svg>\")";

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Public+Sans:wght@400;500;600&family=Noto+Sans+Devanagari:wght@500;600&display=swap');

html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { margin: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

.auth {
  --forest: #1F3D2B; --forest-2: #2E5A3F; --paper: #FBF7EC; --ink: #1B2A20; --muted: #4A5D50;
  --marigold: #E8A317; --clay: #B5482A; --ease: cubic-bezier(.22,1,.36,1);
  font-family: 'Public Sans', 'Noto Sans Devanagari', system-ui, sans-serif;
  color: var(--ink);
  min-height: 100vh; min-height: 100dvh; width: 100%; position: relative; overflow-x: hidden;
}
.f-serif { font-family: 'Fraunces', 'Noto Sans Devanagari', Georgia, serif; font-weight: 600; letter-spacing: -0.015em; }
.f-deva { font-family: 'Noto Sans Devanagari', sans-serif; font-weight: 600; }

/* ---------- Background scene ---------- */
.sky { position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: linear-gradient(180deg, #7FB9E6 0%, #D7E8EC 48%, #F6EBC8 100%); }
.sun { position: fixed; top: -40px; right: 12vw; width: 130px; height: 130px; border-radius: 50%; z-index: 0; pointer-events: none;
  background: radial-gradient(circle,#FFF6D6 0 45%,rgba(255,226,150,.85) 62%,transparent 72%); box-shadow: 0 0 110px 50px rgba(255,214,130,.5); }
.hill { position: fixed; left: 0; right: 0; bottom: 0; width: 100%; z-index: 0; pointer-events: none; }
.tractor-run { position: fixed; left: 0; bottom: 6vh; width: 150px; z-index: 0; pointer-events: none;
  animation: drive 60s linear infinite; will-change: transform; filter: drop-shadow(0 8px 6px rgba(20,40,20,.35)); }
.tractor-run svg { width: 100%; height: auto; display: block; }
.t-body { animation: bob .55s ease-in-out infinite; }
.t-wheel { animation: spin 2.2s linear infinite; }
.t-puff { transform-box: fill-box; transform-origin: center; opacity: 0; animation: puff 2.4s ease-out infinite; }
.t-puff.p2 { animation-delay: .8s; } .t-puff.p3 { animation-delay: 1.6s; }

/* ---------- Surfaces ---------- */
.glass {
  position: relative; isolation: isolate;
  background: linear-gradient(145deg, rgba(255,255,255,.58), rgba(255,255,255,.24));
  backdrop-filter: blur(24px) saturate(190%); -webkit-backdrop-filter: blur(24px) saturate(190%);
  border: 1px solid rgba(255,255,255,.7);
  box-shadow: 0 20px 46px -22px rgba(20,45,28,.55), inset 0 1px 0 rgba(255,255,255,.9);
}
.glass::before { content: ''; position: absolute; inset: 0; border-radius: inherit; z-index: -1; pointer-events: none;
  background: radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,.55), rgba(255,255,255,0) 55%); }
.glass-soft { background: rgba(255,255,255,.45); backdrop-filter: blur(18px) saturate(170%); -webkit-backdrop-filter: blur(18px) saturate(170%);
  border: 1px solid rgba(255,255,255,.75); box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 12px 28px -18px rgba(20,45,28,.5); }

/* Block-print frame: marigold lines, flower corners, diamond edges */
.frame {
  position: relative; border: 14px solid transparent; border-image: ${FRAME_BORDER} 14 round;
  background:
    radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,.6), rgba(255,255,255,0) 55%),
    linear-gradient(145deg, rgba(251,247,236,.7), rgba(251,247,236,.38));
  backdrop-filter: blur(26px) saturate(185%); -webkit-backdrop-filter: blur(26px) saturate(185%);
  box-shadow: 0 34px 64px -30px rgba(15,40,25,.65);
}
.motif { height: 14px; background-repeat: repeat-x; background-position: center; background-image: ${MOTIF}; }
.tricolour { display: inline-flex; width: 36px; height: 12px; border-radius: 2px; overflow: hidden; border: 1px solid rgba(255,255,255,.4); }
.tricolour i { flex: 1; display: block; }
.tricolour i:nth-child(1) { background: #FF9933; } .tricolour i:nth-child(2) { background: #fff; } .tricolour i:nth-child(3) { background: #138808; }

/* ---------- Form controls ---------- */
.field { width: 100%; padding: .68rem .8rem .68rem 2.5rem; font-size: .92rem; color: var(--ink); border-radius: 10px;
  background: rgba(255,255,255,.62); border: 1px solid rgba(31,61,43,.22);
  transition: border-color .25s ease, box-shadow .25s ease, background .25s ease; }
.field.pr { padding-right: 2.7rem; }
.field::placeholder { color: #7B8A7E; }
.field:hover { background: rgba(255,255,255,.78); }
.field:focus { outline: none; border-color: var(--marigold); box-shadow: 0 0 0 3px rgba(232,163,23,.28); background: #fff; }
.lbl { display: block; font-size: .78rem; font-weight: 600; color: var(--ink); margin-bottom: .3rem; }
.ico { position: absolute; left: .8rem; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--muted); pointer-events: none; }
.eye { position: absolute; right: .35rem; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; display: grid; place-items: center; border-radius: 8px; color: var(--muted); transition: background .2s, color .2s; }
.eye:hover { background: rgba(31,61,43,.08); color: var(--ink); }

.btn-primary, .btn-glass, .lang-toggle, .link-btn { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.btn-primary { position: relative; overflow: hidden; isolation: isolate; width: 100%; padding: .8rem 1rem; border-radius: 10px;
  background: var(--forest); color: var(--paper); font-size: .92rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: .5rem;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 12px 22px -12px rgba(20,50,30,.9); transition: transform .25s ease, box-shadow .25s ease, color .3s ease, opacity .2s; }
.btn-primary::before { content: ''; position: absolute; inset: 0; z-index: -1; background: var(--marigold); transform: scaleX(0); transform-origin: left; transition: transform .4s cubic-bezier(.65,0,.35,1); }
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); color: var(--ink); }
.btn-primary:hover:not(:disabled)::before { transform: scaleX(1); }
.btn-primary:disabled { opacity: .6; cursor: not-allowed; }
.btn-glass { width: 100%; display: flex; align-items: center; justify-content: center; gap: .75rem; padding: .7rem 1rem; border-radius: 10px;
  font-size: .9rem; font-weight: 600; color: var(--ink); background: rgba(255,255,255,.6); border: 1px solid rgba(31,61,43,.2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9); transition: background .25s ease, transform .25s ease, box-shadow .25s ease; }
.btn-glass:hover { background: #fff; transform: translateY(-1px); box-shadow: 0 10px 20px -12px rgba(20,45,28,.6); }
.btn-primary:focus-visible, .btn-glass:focus-visible, .link-btn:focus-visible, .lang-toggle:focus-visible, .eye:focus-visible, .back:focus-visible { outline: 2px solid var(--marigold); outline-offset: 3px; }
.link-btn { font-weight: 600; color: var(--forest); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; text-decoration-color: transparent; text-underline-offset: 3px; transition: text-decoration-color .25s; }
.link-btn:hover { text-decoration-color: currentColor; }
.lang-toggle { display: inline-flex; padding: 2px; border-radius: 999px; border: 1px solid rgba(31,61,43,.35); background: rgba(255,255,255,.55); font-size: 11px; font-weight: 600; color: var(--forest); }
.lang-toggle span { padding: .25rem .6rem; border-radius: 999px; transition: background .3s, color .3s; }
.lang-toggle span.on { background: var(--forest); color: var(--paper); }
.back { display: inline-flex; align-items: center; gap: .4rem; font-size: .78rem; font-weight: 600; color: var(--forest); padding: .4rem .7rem; border-radius: 999px; }

.meter { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
.meter i { height: 5px; border-radius: 99px; background: rgba(31,61,43,.15); transition: background .35s ease; }

.swap { animation: swapIn .5s var(--ease) both; }
.rise { animation: rise .8s var(--ease) both; animation-delay: var(--d, 0ms); }

@keyframes swapIn { from { opacity: 0; transform: translate3d(0,10px,0); } to { opacity: 1; transform: none; } }
@keyframes rise { from { opacity: 0; transform: translate3d(0,18px,0); } to { opacity: 1; transform: none; } }
@keyframes drive { from { transform: translate3d(-25vw,0,0); } to { transform: translate3d(110vw,0,0); } }
@keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(1.6px); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes puff { 0% { opacity: .75; transform: translate(0,0) scale(.5); } 100% { opacity: 0; transform: translate(-16px,-34px) scale(1.8); } }

@media (max-width: 640px) {
  .field { font-size: 16px; }
  .tractor-run { width: 105px; bottom: 8vh; }
  .sun { width: 90px; height: 90px; }
  .glass, .frame { backdrop-filter: blur(14px) saturate(170%); -webkit-backdrop-filter: blur(14px) saturate(170%); }
}
@media (prefers-reduced-motion: reduce) {
  .tractor-run { animation: none !important; transform: translate3d(62vw,0,0) !important; }
  .t-wheel, .t-body, .t-puff, .swap, .rise { animation: none !important; }
  .btn-primary, .btn-glass, .btn-primary::before { transition: none !important; }
}
`;

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                               */
/* -------------------------------------------------------------------------- */
function Tractor() {
  return (
    <svg viewBox="0 0 200 125" fill="none" aria-hidden="true">
      <circle className="t-puff p1" cx="150" cy="26" r="4" fill="#fff" />
      <circle className="t-puff p2" cx="150" cy="26" r="4" fill="#fff" />
      <circle className="t-puff p3" cx="150" cy="26" r="4" fill="#fff" />
      <g className="t-body">
        <rect x="147" y="30" width="6" height="28" rx="2" fill="#3A3A3A" />
        <rect x="144" y="27" width="12" height="5" rx="2" fill="#2B2B2B" />
        <rect x="64" y="72" width="104" height="11" rx="4" fill="#8A2A1A" />
        <path d="M98 58 h58 a8 8 0 0 1 8 8 v16 h-66z" fill="#D2452B" />
        <rect x="104" y="51" width="50" height="9" rx="3" fill="#B53A22" />
        <rect x="160" y="66" width="8" height="14" rx="2" fill="#E8A317" />
        <rect x="44" y="38" width="50" height="36" rx="4" fill="rgba(214,238,250,0.8)" stroke="#1F3D2B" strokeWidth="3" />
        <path d="M69 38 V74" stroke="#1F3D2B" strokeWidth="2.5" />
        <rect x="38" y="28" width="62" height="8" rx="4" fill="#1F3D2B" />
        <rect x="52" y="62" width="14" height="8" rx="2" fill="#5A3A22" />
      </g>
      <g className="t-wheel" style={{ transformOrigin: '62px 88px' }}>
        <circle cx="62" cy="88" r="32" fill="#1C1C1C" />
        <circle cx="62" cy="88" r="32" stroke="#4A4A4A" strokeWidth="5" strokeDasharray="6 5" />
        <circle cx="62" cy="88" r="21" fill="#E8A317" />
        <path d="M62 69 V107 M43 88 H81 M49 75 L75 101 M75 75 L49 101" stroke="#1C1C1C" strokeWidth="3" />
        <circle cx="62" cy="88" r="6" fill="#1C1C1C" />
      </g>
      <g className="t-wheel" style={{ transformOrigin: '160px 102px' }}>
        <circle cx="160" cy="102" r="18" fill="#1C1C1C" />
        <circle cx="160" cy="102" r="18" stroke="#4A4A4A" strokeWidth="4" strokeDasharray="5 4" />
        <circle cx="160" cy="102" r="11" fill="#E8A317" />
        <path d="M160 91 V113 M149 102 H171" stroke="#1C1C1C" strokeWidth="2.5" />
        <circle cx="160" cy="102" r="3.5" fill="#1C1C1C" />
      </g>
    </svg>
  );
}

function Scene() {
  return (
    <div aria-hidden="true">
      <div className="sky" />
      <div className="sun" />
      <svg className="hill" style={{ height: '48vh' }} viewBox="0 0 1440 600" preserveAspectRatio="none">
        <path d="M0 300 C180 240 360 330 560 280 S960 220 1180 290 S1360 270 1440 250 L1440 600 L0 600Z" fill="#6A9A55" />
      </svg>
      <svg className="hill" style={{ height: '38vh' }} viewBox="0 0 1440 600" preserveAspectRatio="none">
        <path d="M0 370 C220 320 420 410 700 360 S1100 310 1440 370 L1440 600 L0 600Z" fill="#8AA94A" />
      </svg>
      <svg className="hill" style={{ height: '28vh' }} viewBox="0 0 1440 600" preserveAspectRatio="none">
        <path d="M0 440 C260 410 520 480 800 440 S1200 410 1440 450 L1440 600 L0 600Z" fill="#B7B54A" />
      </svg>
      <div className="tractor-run">
        <Tractor />
      </div>
    </div>
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

const GoogleMark = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */
export function AuthPage({ defaultMode = 'login' }: { defaultMode?: Mode }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, forgotPassword, resetPassword, signInWithGoogle } = useAuth();

  const paramMode = searchParams.get('mode') as Mode | null;
  const [mode, setMode] = useState<Mode>(paramMode && MODES.includes(paramMode) ? paramMode : defaultMode);
  const [lang, setLang] = useState<Lang>('en');
  const t = T[lang];

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(searchParams.get('token') || '');
  const [rememberMe, setRememberMe] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const rules = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial];
  const passwordStrengthCount = rules.filter(Boolean).length;
  const meterColor = passwordStrengthCount === 5 ? '#3F7D4C' : passwordStrengthCount >= 3 ? '#C7881C' : '#B5482A';

  const go = (m: Mode) => {
    setMode(m);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim() || !password) throw new Error(t.err.loginMissing);
        await login(email, password, rememberMe);
        navigate('/app/overview');
      } else if (mode === 'register') {
        if (!fullName.trim()) throw new Error(t.err.name);
        if (!email.trim()) throw new Error(t.err.email);
        if (passwordStrengthCount < 5) throw new Error(t.err.strength);
        if (password !== confirmPassword) throw new Error(t.err.mismatch);
        await register(fullName, email, password, confirmPassword);
        navigate('/app/overview');
      } else if (mode === 'forgot') {
        if (!email.trim()) throw new Error(t.err.forgotEmail);
        const res = await forgotPassword(email);
        setSuccessMsg(res.message);
        if (res.resetToken) {
          setResetToken(res.resetToken);
          setMode('reset');
        }
      } else if (mode === 'reset') {
        if (!resetToken.trim()) throw new Error(t.err.token);
        if (password !== confirmPassword) throw new Error(t.err.mismatch);
        if (passwordStrengthCount < 5) throw new Error(t.err.strength);
        await resetPassword(resetToken, password, confirmPassword);
        setSuccessMsg(t.resetDone);
        timer.current = window.setTimeout(() => setMode('login'), 1200);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.err.generic);
    } finally {
      setIsLoading(false);
    }
  };

  const showStrength = (mode === 'register' || mode === 'reset') && password.length > 0;

  return (
    <div className="auth" data-lang={lang}>
      <style>{STYLES}</style>
      <Scene />

      <div className="relative z-10 min-h-[100dvh] flex flex-col px-4 sm:px-6 lg:px-10 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Top bar */}
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-3">
          <Link to="/" className="back glass-soft">
            <ArrowLeft className="w-4 h-4" />
            <span>{t.back}</span>
          </Link>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="lang-toggle"
            aria-label="Switch language between English and Hindi"
          >
            <span className={lang === 'en' ? 'on' : ''}>EN</span>
            <span className={`f-deva ${lang === 'hi' ? 'on' : ''}`}>हिं</span>
          </button>
        </div>

        <div className="flex-1 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center py-6 sm:py-8">
          {/* Left: welcome (desktop) */}
          <section className="hidden lg:block lg:col-span-6 rise" style={{ '--d': '60ms' } as React.CSSProperties}>
            <p className="glass-soft inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-[#1F3D2B] mb-5">
              <span aria-hidden="true">🙏</span>
              <span className="f-deva">{t.greet}</span>
              <span className="text-[#55634F]">·</span>
              <span className="inline-flex items-center gap-1.5 font-semibold"><Sprout className="w-4 h-4" />AgriShift AI</span>
            </p>
            <h1 className="f-serif text-[#14261B] leading-[1.08] mb-4" style={{ fontSize: 'clamp(2.2rem, 3.8vw, 3.4rem)', textWrap: 'balance' } as React.CSSProperties}>
              {t.heroTitle}
            </h1>
            <p className="text-lg text-[#24392C] leading-relaxed max-w-md mb-8">{t.heroSub}</p>

            <div className="space-y-3 max-w-md">
              {t.features.map((f, i) => {
                const Icon = FEATURE_ICONS[i];
                return (
                  <div key={f.t} className="glass rounded-xl px-4 py-3.5 flex items-start gap-3 rise" style={{ '--d': `${160 + i * 90}ms` } as React.CSSProperties}>
                    <span className="grid place-items-center w-9 h-9 rounded-lg text-[#FBF7EC] bg-gradient-to-br from-[#2E5A3F] to-[#1F3D2B] shrink-0">
                      <Icon className="w-4.5 h-4.5" />
                    </span>
                    <div>
                      <div className="f-serif text-base text-[#14261B]">{f.t}</div>
                      <div className="text-sm text-[#2F4A3A] leading-snug">{f.d}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-8 inline-flex items-center gap-2.5 f-deva text-[#1F3D2B]">
              <span className="tricolour" aria-hidden="true"><i /><i /><i /></span>
              {t.slogan}
            </p>
          </section>

          {/* Right: framed form */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto lg:mx-0 lg:justify-self-end rise" style={{ '--d': '120ms' } as React.CSSProperties}>
            <div className="frame">
              <div className="px-3 sm:px-6 py-5 sm:py-7">
                <div className="flex justify-center mb-3">
                  <span className="tricolour" aria-hidden="true"><i /><i /><i /></span>
                </div>

                <div key={`head-${mode}-${lang}`} className="swap text-center">
                  <h2 className="f-serif text-2xl sm:text-[1.75rem] leading-tight text-[#14261B]" style={{ textWrap: 'balance' } as React.CSSProperties}>
                    {t.title[mode]}
                  </h2>
                  <p className="mt-2 text-sm text-[#3C4B40] leading-relaxed">{t.sub[mode]}</p>
                </div>

                <div className="motif my-5" aria-hidden="true" />

                <div className="space-y-4">
                  <div aria-live="polite" className="space-y-3 empty:hidden">
                    {errorMsg && (
                      <div role="alert" className="swap p-3 rounded-lg bg-red-50/90 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{errorMsg}</span>
                      </div>
                    )}
                    {successMsg && (
                      <div className="swap p-3 rounded-lg bg-emerald-50/90 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{successMsg}</span>
                      </div>
                    )}
                  </div>

                  {(mode === 'login' || mode === 'register') && (
                    <div key={`g-${lang}`} className="swap space-y-4">
                      <button type="button" onClick={() => signInWithGoogle().catch(() => {})} className="btn-glass">
                        <GoogleMark />
                        <span>{t.google}</span>
                      </button>
                      <div className="relative flex items-center justify-center">
                        <div className="border-t border-[#1F3D2B]/20 w-full" />
                        <span className="px-3 text-[11px] font-medium text-[#4A5D50] uppercase tracking-wider shrink-0 whitespace-nowrap">{t.or}</span>
                        <div className="border-t border-[#1F3D2B]/20 w-full" />
                      </div>
                    </div>
                  )}

                  <form key={`f-${mode}-${lang}`} onSubmit={handleSubmit} className="swap space-y-4" noValidate={false}>
                    {mode === 'register' && (
                      <div>
                        <label htmlFor="auth-name" className="lbl">{t.fullName}</label>
                        <div className="relative">
                          <UserIcon className="ico" />
                          <input id="auth-name" type="text" required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.phName} className="field" />
                        </div>
                      </div>
                    )}

                    {mode !== 'reset' && (
                      <div>
                        <label htmlFor="auth-email" className="lbl">{t.email}</label>
                        <div className="relative">
                          <Mail className="ico" />
                          <input id="auth-email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="farmer@example.com" className="field" />
                        </div>
                      </div>
                    )}

                    {mode === 'reset' && (
                      <div>
                        <label htmlFor="auth-token" className="lbl">{t.token}</label>
                        <div className="relative">
                          <KeyRound className="ico" />
                          <input id="auth-token" type="text" required autoComplete="one-time-code" value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder={t.phToken} className="field font-mono" />
                        </div>
                      </div>
                    )}

                    {mode !== 'forgot' && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="auth-password" className="lbl !mb-0">{mode === 'login' ? t.password : t.newPassword}</label>
                          {mode === 'login' && (
                            <button type="button" onClick={() => go('forgot')} className="link-btn text-xs">{t.forgotLink}</button>
                          )}
                        </div>
                        <div className="relative">
                          <Lock className="ico" />
                          <input
                            id="auth-password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="field pr"
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="eye" aria-label={showPassword ? t.hide : t.show}>
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {showStrength && (
                          <div className="swap mt-2.5 p-3 rounded-lg glass-soft text-[11px]">
                            <div className="font-semibold text-[#111C15] flex items-center justify-between mb-2">
                              <span>{t.strength}</span>
                              <span style={{ color: meterColor }} className="font-bold">{passwordStrengthCount}/5 {t.met}</span>
                            </div>
                            <div className="meter mb-2.5" aria-hidden="true">
                              {[0, 1, 2, 3, 4].map((i) => (
                                <i key={i} style={{ background: i < passwordStrengthCount ? meterColor : undefined }} />
                              ))}
                            </div>
                            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-3 gap-y-1 text-[#4A5D50]">
                              {t.rules.map((r, i) => (
                                <div key={r} className={rules[i] ? 'text-emerald-700 font-medium' : ''}>
                                  {rules[i] ? '✓' : '•'} {r}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {(mode === 'register' || mode === 'reset') && (
                      <div>
                        <label htmlFor="auth-confirm" className="lbl">{t.confirm}</label>
                        <div className="relative">
                          <Lock className="ico" />
                          <input
                            id="auth-confirm"
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="field pr"
                          />
                          <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="eye" aria-label={showConfirmPassword ? t.hide : t.show}>
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {mode === 'login' && (
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id="page-remember-me"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded border-[#1F3D2B]/30 accent-[#1F3D2B]"
                        />
                        <label htmlFor="page-remember-me" className="text-xs text-[#3C4B40] select-none cursor-pointer">{t.remember}</label>
                      </div>
                    )}

                    <button type="submit" disabled={isLoading} className="btn-primary">
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{t.submit[mode]}</span>
                    </button>
                  </form>
                </div>

                <div className="motif mt-6 mb-4" aria-hidden="true" />

                <div className="text-center text-xs text-[#3C4B40]">
                  {mode === 'login' && (
                    <div>
                      {t.noAccount}{' '}
                      <button type="button" onClick={() => go('register')} className="link-btn">{t.createLink}</button>
                    </div>
                  )}
                  {mode === 'register' && (
                    <div>
                      {t.haveAccount}{' '}
                      <button type="button" onClick={() => go('login')} className="link-btn">{t.signInLink}</button>
                    </div>
                  )}
                  {(mode === 'forgot' || mode === 'reset') && (
                    <div>
                      {t.remembered}{' '}
                      <button type="button" onClick={() => go('login')} className="link-btn">{t.returnLink}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="lg:hidden mt-4 text-center f-deva text-sm text-[#1F3D2B] inline-flex w-full items-center justify-center gap-2.5">
              <span className="tricolour" aria-hidden="true"><i /><i /><i /></span>
              {t.slogan}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}