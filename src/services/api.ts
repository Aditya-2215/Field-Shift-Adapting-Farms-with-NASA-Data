import type {
  CropKnowledge,
  CropSuitabilityResult,
  EnvironmentalAssessment,
  Farm,
  FarmReportPayload,
  NasaDatasetStatus,
  NasaPowerData,
  PersistedAiConversation,
  PersistedEnvironmentalAssessment,
  PersistedFarmReport,
  PersistedRotationScenario,
  RotationComparison,
  RotationWeights,
  SoilProfile,
  UserProfile,
  WhatIfScenarioInput,
  WhatIfSimulationResult
} from '../../shared/types/agri';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// In-Memory Access Token Storage (Never in localStorage)
let inMemoryAccessToken: string | null = null;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

async function tryRefreshToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' // Sends HttpOnly cookie
      });
      const data = (await res.json().catch(() => ({}))) as ApiEnvelope<{ accessToken: string }>;
      if (res.ok && data.success && data.data?.accessToken) {
        setAccessToken(data.data.accessToken);
        return data.data.accessToken;
      }
      setAccessToken(null);
      return null;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function requestApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined)
  };

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include' // Sends HttpOnly cookie
  });

  // If 401 Unauthorized, attempt automatic token refresh via HttpOnly cookie and retry once
  if (res.status === 401 && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/register')) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(path, {
        ...options,
        headers,
        credentials: 'include'
      });
    }
  }

  const payload = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!res.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error || payload.message || `API request failed (${res.status})`);
  }
  return payload.data;
}

export interface FullEnvironmentAnalysisResponse {
  farm: Farm;
  nasaPower: NasaPowerData;
  assessment: EnvironmentalAssessment;
  datasets: NasaDatasetStatus[];
  persistedAssessmentId?: string;
}

export const apiClient = {
  // Auth API
  register: (payload: { fullName: string; email: string; password: string; confirmPassword: string }) =>
    requestApi<{ user: UserProfile; accessToken: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  login: (payload: { email: string; password: string; rememberMe?: boolean }) =>
    requestApi<{ user: UserProfile; accessToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  refresh: () => tryRefreshToken(),

  logout: () =>
    requestApi<{ success: boolean; message: string }>('/api/auth/logout', {
      method: 'POST'
    }),

  logoutAll: () =>
    requestApi<{ success: boolean; message: string }>('/api/auth/logout-all', {
      method: 'POST'
    }),

  getMe: () => requestApi<UserProfile & { isDemo?: boolean }>('/api/auth/me'),

  forgotPassword: (email: string) =>
    requestApi<{ success: boolean; message: string; resetToken?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),

  resetPassword: (payload: { token: string; password: string; confirmPassword: string }) =>
    requestApi<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  changePassword: (payload: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    requestApi<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  verifyGoogleCredential: (credential: string) =>
    requestApi<{ user: UserProfile; accessToken: string }>('/api/auth/google/verify', {
      method: 'POST',
      body: JSON.stringify({ credential })
    }),

  getHealth: () =>
    requestApi<{
      service: string;
      timestamp: string;
      database: string;
      databaseConnected: boolean;
      authMode: string;
      geminiConfigured: boolean;
      geminiModel: string;
      earthdataConfigured: boolean;
      geeConfigured: boolean;
    }>('/api/health'),

  getProfile: () => requestApi<UserProfile | null>('/api/auth/profile'),

  updateProfile: (patch: { name?: string; preferredLanguage?: string; location?: string }) =>
    requestApi<UserProfile>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(patch)
    }),

  getFarms: () => requestApi<Farm[]>('/api/farms'),

  getFarm: (id: string) => requestApi<Farm>(`/api/farms/${encodeURIComponent(id)}`),

  createFarm: (farm: Partial<Farm>) =>
    requestApi<Farm>('/api/farms', {
      method: 'POST',
      body: JSON.stringify(farm)
    }),

  updateFarm: (id: string, farm: Partial<Farm>) =>
    requestApi<Farm>(`/api/farms/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(farm)
    }),

  updateFarmLocation: (
    id: string,
    locationData: {
      latitude: number;
      longitude: number;
      locationAccuracy?: number | null;
      addressComponents?: Record<string, unknown> | null;
      village?: string | null;
      district?: string | null;
      state?: string | null;
      country?: string | null;
    }
  ) =>
    requestApi<Farm>(`/api/farms/${encodeURIComponent(id)}/location`, {
      method: 'PATCH',
      body: JSON.stringify(locationData)
    }),

  updateFarmBoundary: (
    id: string,
    boundaryData: {
      boundaryGeoJson: unknown;
      area?: number;
      areaUnit?: string;
    }
  ) =>
    requestApi<Farm>(`/api/farms/${encodeURIComponent(id)}/boundary`, {
      method: 'PATCH',
      body: JSON.stringify(boundaryData)
    }),

  geocode: (query: string) =>
    requestApi<Array<{
      displayName: string;
      latitude: number;
      longitude: number;
      addressComponents: {
        village?: string;
        district?: string;
        state?: string;
        country: string;
        postcode?: string;
        formattedAddress: string;
      };
      source: string;
    }>>(`/api/geospatial/geocode?q=${encodeURIComponent(query)}`),

  reverseGeocode: (latitude: number, longitude: number) =>
    requestApi<{
      displayName: string;
      latitude: number;
      longitude: number;
      addressComponents: {
        village?: string;
        district?: string;
        state?: string;
        country: string;
        postcode?: string;
        formattedAddress: string;
      };
      source: string;
    }>(`/api/geospatial/reverse-geocode?lat=${latitude}&lon=${longitude}`),

  getElevation: (latitude: number, longitude: number) =>
    requestApi<{
      latitude: number;
      longitude: number;
      elevationMeters: number;
      spatialResolution: string;
      source: string;
      retrievedAt: string;
    }>(`/api/geospatial/elevation?lat=${latitude}&lon=${longitude}`),

  updateSoilProfile: (farmId: string, soilProfile: SoilProfile) =>
    requestApi<Farm>(`/api/farms/${encodeURIComponent(farmId)}/soil-profile`, {
      method: 'PUT',
      body: JSON.stringify(soilProfile)
    }),

  deleteFarm: (id: string) =>
    requestApi<{ deleted: string }>(`/api/farms/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),

  analyzeGeoJson: (geoJson: unknown) =>
    requestApi<{
      valid: boolean;
      areaHectares: number;
      areaAcres: number;
      centroidLat: number;
      centroidLng: number;
      normalizedFeature: unknown;
    }>('/api/geospatial/analyze-geojson', {
      method: 'POST',
      body: JSON.stringify({ geoJson })
    }),

  analyzeEnvironment: (farm: Farm, persist = false) =>
    requestApi<FullEnvironmentAnalysisResponse>('/api/analysis/environment', {
      method: 'POST',
      body: JSON.stringify({ farmId: farm.id, farm, persist })
    }),

  getAssessments: (farmId?: string) =>
    requestApi<PersistedEnvironmentalAssessment[]>(
      farmId ? `/api/assessments?farmId=${encodeURIComponent(farmId)}` : '/api/assessments'
    ),

  saveAssessment: (farmId: string) =>
    requestApi<PersistedEnvironmentalAssessment>('/api/assessments', {
      method: 'POST',
      body: JSON.stringify({ farmId })
    }),

  deleteAssessment: (id: string) =>
    requestApi<{ deleted: string }>(`/api/assessments/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),

  getCrops: () => requestApi<CropKnowledge[]>('/api/crops'),

  evaluateSuitability: (farm: Farm) =>
    requestApi<{ farmId: string; suitability: CropSuitabilityResult[] }>('/api/crops/suitability', {
      method: 'POST',
      body: JSON.stringify({ farmId: farm.id, farm })
    }),

  generateRotations: (farm: Farm, weights: RotationWeights) =>
    requestApi<RotationComparison>('/api/rotation/generate', {
      method: 'POST',
      body: JSON.stringify({ farmId: farm.id, farm, weights })
    }),

  getRotationScenarios: (farmId?: string) =>
    requestApi<PersistedRotationScenario[]>(
      farmId ? `/api/rotations?farmId=${encodeURIComponent(farmId)}` : '/api/rotations'
    ),

  saveRotationScenario: (farmId: string, title: string, weights: RotationWeights) =>
    requestApi<PersistedRotationScenario>('/api/rotations', {
      method: 'POST',
      body: JSON.stringify({ farmId, title, weights })
    }),

  deleteRotationScenario: (id: string) =>
    requestApi<{ deleted: string }>(`/api/rotations/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),

  runWhatIfSimulation: (farm: Farm, scenario: WhatIfScenarioInput) =>
    requestApi<WhatIfSimulationResult>('/api/simulator/run', {
      method: 'POST',
      body: JSON.stringify({ farmId: farm.id, farm, scenario })
    }),

  getAiConversation: (farmId: string) =>
    requestApi<PersistedAiConversation | null>(
      `/api/ai/conversations?farmId=${encodeURIComponent(farmId)}`
    ),

  sendAiChat: (
    farm: Farm,
    question: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    weights: RotationWeights
  ) =>
    requestApi<{ reply: string; model: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ farmId: farm.id, farm, question, history, weights })
    }),

  getReports: (farmId?: string) =>
    requestApi<PersistedFarmReport[]>(
      farmId ? `/api/reports?farmId=${encodeURIComponent(farmId)}` : '/api/reports'
    ),

  deleteReport: (id: string) =>
    requestApi<{ deleted: string }>(`/api/reports/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),

  generateReport: (farm: Farm, weights: RotationWeights) =>
    requestApi<FarmReportPayload & { persisted?: boolean }>('/api/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ farmId: farm.id, farm, weights })
    })
};
