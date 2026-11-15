import React, { useEffect, useState } from 'react';
import { Database, Key, LogIn, LogOut, Save, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../services/api';
import { AuthModal } from '../auth/AuthModal';

export function SettingsView() {
  const { profile, user, logout, logoutAll, changePassword, updateUserProfile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [language, setLanguage] = useState(profile?.preferredLanguage || 'English');
  const [location, setLocation] = useState(profile?.location || '');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Auth modal
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [health, setHealth] = useState<{
    database?: string;
    databaseConnected?: boolean;
    geminiConfigured: boolean;
    earthdataConfigured: boolean;
    geeConfigured: boolean;
  } | null>(null);

  useEffect(() => {
    setName(profile?.name || '');
    setLanguage(profile?.preferredLanguage || 'English');
    setLocation(profile?.location || '');
  }, [profile]);

  useEffect(() => {
    apiClient.getHealth().then(setHealth).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg(null);
    setErrorMsg(null);
    try {
      await updateUserProfile({ name, preferredLanguage: language, location });
      setSavedMsg('Profile preferences saved to PostgreSQL.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save profile');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess(null);
    setPwError(null);
    setPwLoading(true);

    try {
      if (newPassword !== confirmPassword) {
        throw new Error('New passwords do not match.');
      }
      await changePassword(currentPassword, newPassword, confirmPassword);
      setPwSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#111C15]">Account & Platform Settings</h1>
        <p className="text-sm text-[#4A5D50]">
          Manage your farmer profile, security credentials, and review server-side data connectors.
        </p>
      </div>

      {/* Authentication Status */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-[#4A5D50]">Authentication Mode</div>
          <div className="text-base font-semibold text-[#111C15] mt-0.5">
            {user ? `Signed in as ${user.email}` : 'Demonstration Workspace Mode (Read-Only)'}
          </div>
          <div className="text-xs text-[#4A5D50] mt-0.5">
            Role: <span className="capitalize font-medium text-[#111C15]">{profile?.role || 'farmer'}</span>
          </div>
        </div>
        {user ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#DCE3DC] text-xs font-semibold text-[#111C15] hover:bg-[#F6F8F5]"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
            <button
              type="button"
              onClick={() => logoutAll()}
              title="Revoke all active sessions on all devices"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Logout All Devices</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#143B2F]"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In / Register</span>
          </button>
        )}
      </div>

      {/* User Profile Form */}
      <form onSubmit={handleSave} className="rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-[#111C15]">Farmer Profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prof-name" className="block text-xs font-semibold text-[#111C15] mb-1">
              Display Name
            </label>
            <input
              id="prof-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>
          <div>
            <label htmlFor="prof-lang" className="block text-xs font-semibold text-[#111C15] mb-1">
              Preferred Language
            </label>
            <select
              id="prof-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1B4D3E]"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Marathi">Marathi</option>
              <option value="Punjabi">Punjabi</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="prof-loc" className="block text-xs font-semibold text-[#111C15] mb-1">
              Primary Region
            </label>
            <input
              id="prof-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>
        </div>
        {savedMsg && <div className="text-xs font-medium text-[#16A34A]">{savedMsg}</div>}
        {errorMsg && <div className="text-xs font-medium text-[#DC2626]">{errorMsg}</div>}
        <button
          type="submit"
          disabled={!user}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#143B2F] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          <span>{user ? 'Save Profile' : 'Sign in to Save Profile'}</span>
        </button>
      </form>

      {/* Password Management (Authenticated users only) */}
      {user && (
        <form onSubmit={handleChangePassword} className="rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#1B4D3E]" />
            <h2 className="font-display text-base font-semibold text-[#111C15]">Security & Password</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#111C15] mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm focus:outline-none focus:border-[#1B4D3E]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#111C15] mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm focus:outline-none focus:border-[#1B4D3E]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#111C15] mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#DCE3DC] px-3 py-2 text-sm focus:outline-none focus:border-[#1B4D3E]"
              />
            </div>
          </div>
          {pwSuccess && <div className="text-xs font-medium text-[#16A34A]">{pwSuccess}</div>}
          {pwError && <div className="text-xs font-medium text-[#DC2626]">{pwError}</div>}
          <button
            type="submit"
            disabled={pwLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#143B2F] disabled:opacity-60"
          >
            <span>Update Password</span>
          </button>
        </form>
      )}

      {/* Server Integration & Database Diagnostics */}
      <div className="rounded-xl border border-[#DCE3DC] bg-white p-5 space-y-3">
        <h2 className="font-display text-base font-semibold text-[#111C15]">Database & Server Diagnostics</h2>
        <div className="divide-y divide-[#DCE3DC] text-xs">
          <div className="py-2.5 flex justify-between">
            <span className="text-[#4A5D50] flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Primary Relational Database</span>
            </span>
            <span className={`font-semibold ${health?.databaseConnected ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>
              {health?.database ? `${health.database} (${health.databaseConnected ? 'Connected' : 'Connecting'})` : 'PostgreSQL'}
            </span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-[#4A5D50]">Authentication Engine</span>
            <span className="font-semibold text-[#16A34A]">JWT + Rotating Refresh Tokens & Google OAuth 2.0</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-[#4A5D50]">NASA POWER Public Agroclimatology API</span>
            <span className="font-semibold text-[#16A34A]">Enabled (No Key Required)</span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-[#4A5D50]">Gemini Agricultural Assistant (Server-Side)</span>
            <span className={`font-semibold ${health?.geminiConfigured ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>
              {health?.geminiConfigured ? 'Configured' : 'Awaiting Runtime Secret'}
            </span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-[#4A5D50]">NASA Earthdata (SMAP / GPM / ECOSTRESS / GRACE)</span>
            <span className={`font-semibold ${health?.earthdataConfigured ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>
              {health?.earthdataConfigured ? 'Configured' : 'Requires NASA_EARTHDATA_TOKEN on Server'}
            </span>
          </div>
          <div className="py-2.5 flex justify-between">
            <span className="text-[#4A5D50]">Google Earth Engine (Landsat / MODIS / SRTM Tiles)</span>
            <span className={`font-semibold ${health?.geeConfigured ? 'text-[#16A34A]' : 'text-[#D97706]'}`}>
              {health?.geeConfigured ? 'Configured' : 'Requires GEE_SERVICE_ACCOUNT_JSON on Server'}
            </span>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode="login"
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}
