import React, { useState } from 'react';
import {
  BarChart3,
  Bell,
  CloudSun,
  Compass,
  FileText,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Map as MapIcon,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ShieldAlert,
  Sliders,
  Sprout,
  Tractor,
  X
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFarms } from '../contexts/FarmContext';
import { AuthModal } from '../components/auth/AuthModal';

const NAV_ITEMS = [
  { to: '/app/overview', label: 'Overview', Icon: LayoutDashboard },
  { to: '/app/farms', label: 'My Farms', Icon: Tractor },
  { to: '/app/satellite', label: 'Satellite Intelligence', Icon: MapIcon },
  { to: '/app/climate', label: 'Climate Analytics', Icon: CloudSun },
  { to: '/app/risk', label: 'Environmental Risk', Icon: ShieldAlert },
  { to: '/app/crops', label: 'Crop Intelligence', Icon: Sprout },
  { to: '/app/rotation', label: 'Rotation Planner', Icon: Compass },
  { to: '/app/simulator', label: 'What-if Simulator', Icon: Sliders },
  { to: '/app/reports', label: 'Reports', Icon: FileText },
  { to: '/app/assistant', label: 'AI Agricultural Assistant', Icon: MessageSquare },
  { to: '/app/settings', label: 'Settings', Icon: Settings }
];

export function WorkspaceLayout({
  children,
  searchQuery,
  onSearchChange
}: {
  children: React.ReactNode;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, user, signInWithGoogle, logout } = useAuth();
  const { farms, activeFarm, setActiveFarmId, assessment, nasaPower } = useFarms();

  const alerts = assessment?.alerts ?? [];
  const dataFreshness = nasaPower?.retrievedAt
    ? new Date(nasaPower.retrievedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : 'Syncing';

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#0D241B] text-[#E6ECE6]">
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="font-display text-lg font-bold tracking-tight text-white text-left whitespace-nowrap"
        >
          AgriShift AI
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-white/70 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav aria-label="Workspace navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#1B4D3E] text-white'
                  : 'text-[#B9C8BE] hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 text-xs text-[#9DB0A3] space-y-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/5 text-[#D2DED6] transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>Public Overview</span>
        </button>
        <div className="px-2.5 pt-1 text-[11px] text-[#8DA294]">
          {nasaPower?.isDemonstrationFallback
            ? 'Dataset: Demonstration Baseline'
            : 'Dataset: Live NASA POWER'}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F6F8F5] text-[#111C15]">
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-[#DCE3DC] sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{SidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Workspace Top Bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-[#DCE3DC] px-3 sm:px-4 lg:px-6 py-2.5">
          <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 rounded-lg border border-[#DCE3DC] text-[#111C15] hover:bg-[#F6F8F5] shrink-0"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 min-w-0 flex-1">
                <label htmlFor="farm-selector" className="sr-only">
                  Select active farm
                </label>
                <select
                  id="farm-selector"
                  value={activeFarm.id}
                  onChange={(e) => setActiveFarmId(e.target.value)}
                  className="w-full max-w-[180px] sm:max-w-[280px] truncate rounded-lg border border-[#DCE3DC] bg-[#F6F8F5] px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-[#111C15] focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.district})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Search */}
              <div className="hidden md:flex items-center relative">
                <Search className="w-4 h-4 text-[#4A5D50] absolute left-3 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Filter crops or metrics..."
                  aria-label="Filter crops or metrics"
                  className="w-48 lg:w-56 pl-9 pr-3 py-1.5 rounded-lg border border-[#DCE3DC] bg-[#F6F8F5] text-xs text-[#111C15] placeholder:text-[#6B7E71] focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]"
                />
              </div>

              {/* Date & Freshness */}
              <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#4A5D50] px-2 font-mono-num whitespace-nowrap">
                <BarChart3 className="w-3.5 h-3.5 text-[#1B4D3E]" />
                <span>Synced {dataFreshness}</span>
              </div>

              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAlertsOpen((v) => !v)}
                  aria-label={`Notifications (${alerts.length} alerts)`}
                  className="relative p-2 rounded-lg border border-[#DCE3DC] bg-white hover:bg-[#F6F8F5] text-[#111C15]"
                >
                  <Bell className="w-4 h-4" />
                  {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D97706] text-white text-[10px] font-bold flex items-center justify-center font-mono-num">
                      {alerts.length}
                    </span>
                  )}
                </button>

                {alertsOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[#DCE3DC] bg-white shadow-lg p-4 z-40">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-[#111C15]">Environmental Alerts</h3>
                      <button
                        type="button"
                        onClick={() => setAlertsOpen(false)}
                        aria-label="Close notifications"
                        className="text-xs text-[#4A5D50] hover:text-[#111C15]"
                      >
                        Close
                      </button>
                    </div>
                    {alerts.length === 0 ? (
                      <p className="text-xs text-[#4A5D50]">No active alerts for this farm.</p>
                    ) : (
                      <div className="space-y-2.5 max-h-72 overflow-y-auto">
                        {alerts.map((al) => (
                          <div key={al.id} className="pb-2.5 border-b border-[#DCE3DC] last:border-b-0 last:pb-0">
                            <div className="text-xs font-semibold text-[#111C15]">
                              {al.severity}: {al.title}
                            </div>
                            <p className="text-xs text-[#4A5D50] mt-0.5">{al.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Profile / Auth */}
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-xs font-medium text-[#111C15] max-w-[140px] truncate">
                    {profile?.name || user.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => logout()}
                    title="Sign out"
                    aria-label="Sign out"
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#DCE3DC] text-xs font-medium text-[#4A5D50] hover:text-[#111C15] hover:bg-[#F6F8F5] whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#1B4D3E] text-white text-xs font-medium hover:bg-[#143B2F] transition-colors whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">{children}</main>

        <AuthModal
          isOpen={isAuthModalOpen}
          initialMode="login"
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => setIsAuthModalOpen(false)}
        />
      </div>
    </div>
  );
}
