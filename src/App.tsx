import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './components/common/StatusAndError';
import { AiAssistantView } from './components/views/AiAssistantView';
import { ClimateAnalyticsView } from './components/views/ClimateAnalyticsView';
import { CropIntelligenceView } from './components/views/CropIntelligenceView';
import { EnvironmentalRiskView } from './components/views/EnvironmentalRiskView';
import { MyFarmsView } from './components/views/MyFarmsView';
import { OverviewView } from './components/views/OverviewView';
import { ReportsView } from './components/views/ReportsView';
import { RotationPlannerView } from './components/views/RotationPlannerView';
import { SatelliteIntelligenceView } from './components/views/SatelliteIntelligenceView';
import { SettingsView } from './components/views/SettingsView';
import { WhatIfSimulatorView } from './components/views/WhatIfSimulatorView';
import { AuthProvider } from './contexts/AuthContext';
import { FarmProvider } from './contexts/FarmContext';
import { WorkspaceLayout } from './layouts/WorkspaceLayout';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

function AutostartHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('autostart') === '1' && location.pathname === '/') {
      navigate('/app/overview', { replace: true });
    }
  }, [location, navigate]);

  return null;
}

function WorkspaceRoutes() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <WorkspaceLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      <Routes>
        <Route path="overview" element={<OverviewView />} />
        <Route path="farms" element={<MyFarmsView />} />
        <Route path="satellite" element={<SatelliteIntelligenceView />} />
        <Route path="climate" element={<ClimateAnalyticsView />} />
        <Route path="risk" element={<EnvironmentalRiskView />} />
        <Route path="crops" element={<CropIntelligenceView globalSearch={searchQuery} />} />
        <Route path="rotation" element={<RotationPlannerView />} />
        <Route path="simulator" element={<WhatIfSimulatorView />} />
        <Route path="reports" element={<ReportsView />} />
        <Route path="assistant" element={<AiAssistantView />} />
        <Route path="settings" element={<SettingsView />} />
        <Route path="*" element={<Navigate to="/app/overview" replace />} />
      </Routes>
    </WorkspaceLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <FarmProvider>
            <BrowserRouter>
              <AutostartHandler />
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<AuthPage defaultMode="login" />} />
                <Route path="/register" element={<AuthPage defaultMode="register" />} />
                <Route path="/forgot-password" element={<AuthPage defaultMode="forgot" />} />
                <Route path="/reset-password" element={<AuthPage defaultMode="reset" />} />
                <Route path="/app/*" element={<WorkspaceRoutes />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </FarmProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
