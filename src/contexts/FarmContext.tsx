import React, { createContext, useContext, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEMO_FARM, DEMO_FARM_ID } from '../../shared/data/demoFarm';
import type {
  CropSuitabilityResult,
  EnvironmentalAssessment,
  Farm,
  NasaDatasetStatus,
  NasaPowerData,
  RotationComparison,
  RotationWeights
} from '../../shared/types/agri';
import { apiClient } from '../services/api';
import { useAuth } from './AuthContext';

export const DEFAULT_WEIGHTS: RotationWeights = {
  waterEfficiency: 25,
  climateResilience: 25,
  soilImprovement: 25,
  erosionProtection: 15,
  marketSuitability: 10
};

interface FarmContextValue {
  farms: Farm[];
  activeFarmId: string;
  activeFarm: Farm;
  setActiveFarmId: (id: string) => void;
  weights: RotationWeights;
  setWeights: React.Dispatch<React.SetStateAction<RotationWeights>>;
  nasaPower: NasaPowerData | undefined;
  datasets: NasaDatasetStatus[];
  assessment: EnvironmentalAssessment | undefined;
  suitability: CropSuitabilityResult[];
  rotationComparison: RotationComparison | undefined;
  isLoadingAnalysis: boolean;
  isLoadingFarms: boolean;
  analysisError: string | null;
  refetchAnalysis: () => void;
  saveFarm: (farmInput: Omit<Farm, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Farm>;
  deleteFarm: (farmId: string) => Promise<void>;
  updateLocation: (
    farmId: string,
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
  ) => Promise<Farm>;
  updateBoundary: (
    farmId: string,
    boundaryData: {
      boundaryGeoJson: unknown;
      area?: number;
      areaUnit?: string;
    }
  ) => Promise<Farm>;
}

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady } = useAuth();
  const queryClient = useQueryClient();
  const [activeFarmId, setActiveFarmId] = useState<string>(DEMO_FARM_ID);
  const [weights, setWeights] = useState<RotationWeights>(DEFAULT_WEIGHTS);

  const farmsQuery = useQuery({
    queryKey: ['farms', user?.uid ?? 'demo'],
    enabled: authReady,
    queryFn: async () => {
      if (!user) {
        return [DEMO_FARM];
      }
      return apiClient.getFarms();
    },
    staleTime: 1000 * 60 * 2
  });

  const farms = useMemo(() => {
    const list = farmsQuery.data;
    return list && list.length > 0 ? list : [DEMO_FARM];
  }, [farmsQuery.data]);

  const activeFarm = useMemo(() => {
    return farms.find((f) => f.id === activeFarmId) ?? farms[0] ?? DEMO_FARM;
  }, [farms, activeFarmId]);

  const envQuery = useQuery({
    queryKey: [
      'env-analysis',
      user?.uid ?? 'demo',
      activeFarm.id,
      activeFarm.updatedAt,
      activeFarm.latitude,
      activeFarm.longitude,
      activeFarm.soilProfile,
      activeFarm.waterAvailability,
      activeFarm.irrigationAvailable,
      activeFarm.currentCrops
    ],
    enabled: authReady,
    queryFn: () => apiClient.analyzeEnvironment(activeFarm, false),
    staleTime: 1000 * 60 * 5
  });

  const suitQuery = useQuery({
    queryKey: [
      'crop-suitability',
      user?.uid ?? 'demo',
      activeFarm.id,
      activeFarm.updatedAt,
      activeFarm.latitude,
      activeFarm.longitude,
      activeFarm.soilProfile,
      activeFarm.waterAvailability,
      activeFarm.irrigationAvailable
    ],
    enabled: authReady,
    queryFn: () => apiClient.evaluateSuitability(activeFarm),
    staleTime: 1000 * 60 * 5
  });

  const rotQuery = useQuery({
    queryKey: [
      'rotation-plan',
      user?.uid ?? 'demo',
      activeFarm.id,
      activeFarm.updatedAt,
      activeFarm.currentCrops,
      activeFarm.waterAvailability,
      activeFarm.irrigationAvailable,
      weights
    ],
    enabled: authReady,
    queryFn: () => apiClient.generateRotations(activeFarm, weights),
    staleTime: 1000 * 60 * 5
  });

  const saveFarm = async (
    farmInput: Omit<Farm, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Farm> => {
    if (!user) {
      throw new Error('Please sign in to register or modify farms. Demonstration mode is read-only.');
    }
    if (farmInput.id === DEMO_FARM_ID) {
      throw new Error('The built-in Barabanki demonstration farm is read-only.');
    }

    const existsOnServer = farmInput.id ? farms.some((f) => f.id === farmInput.id && f.id !== DEMO_FARM_ID) : false;
    const saved =
      existsOnServer && farmInput.id
        ? await apiClient.updateFarm(farmInput.id, farmInput)
        : await apiClient.createFarm(farmInput);

    await queryClient.invalidateQueries({ queryKey: ['farms', user.uid] });
    setActiveFarmId(saved.id);
    return saved;
  };

  const deleteFarm = async (farmId: string): Promise<void> => {
    if (!user) {
      throw new Error('Please sign in to delete farms. Demonstration mode is read-only.');
    }
    if (farmId === DEMO_FARM_ID) {
      throw new Error('The built-in Barabanki demonstration farm cannot be deleted.');
    }
    await apiClient.deleteFarm(farmId);
    await queryClient.invalidateQueries({ queryKey: ['farms', user.uid] });
    if (activeFarmId === farmId) {
      setActiveFarmId(DEMO_FARM_ID);
    }
  };

  const updateLocation = async (
    farmId: string,
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
  ): Promise<Farm> => {
    if (!user) {
      throw new Error('Please sign in to update farm location. Demonstration mode is read-only.');
    }
    if (farmId === DEMO_FARM_ID) {
      throw new Error('The built-in Barabanki demonstration farm is read-only.');
    }
    const updated = await apiClient.updateFarmLocation(farmId, locationData);
    await queryClient.invalidateQueries({ queryKey: ['farms', user.uid] });
    return updated;
  };

  const updateBoundary = async (
    farmId: string,
    boundaryData: {
      boundaryGeoJson: unknown;
      area?: number;
      areaUnit?: string;
    }
  ): Promise<Farm> => {
    if (!user) {
      throw new Error('Please sign in to update farm boundary. Demonstration mode is read-only.');
    }
    if (farmId === DEMO_FARM_ID) {
      throw new Error('The built-in Barabanki demonstration farm is read-only.');
    }
    const updated = await apiClient.updateFarmBoundary(farmId, boundaryData);
    await queryClient.invalidateQueries({ queryKey: ['farms', user.uid] });
    return updated;
  };

  const refetchAnalysis = () => {
    farmsQuery.refetch();
    envQuery.refetch();
    suitQuery.refetch();
    rotQuery.refetch();
  };

  const analysisError =
    (farmsQuery.error instanceof Error && farmsQuery.error.message) ||
    (envQuery.error instanceof Error && envQuery.error.message) ||
    (suitQuery.error instanceof Error && suitQuery.error.message) ||
    (rotQuery.error instanceof Error && rotQuery.error.message) ||
    null;

  return (
    <FarmContext.Provider
      value={{
        farms,
        activeFarmId,
        activeFarm,
        setActiveFarmId,
        weights,
        setWeights,
        nasaPower: envQuery.data?.nasaPower,
        datasets: envQuery.data?.datasets ?? [],
        assessment: envQuery.data?.assessment,
        suitability: suitQuery.data?.suitability ?? [],
        rotationComparison: rotQuery.data,
        isLoadingAnalysis: envQuery.isLoading || suitQuery.isLoading || rotQuery.isLoading,
        isLoadingFarms: farmsQuery.isLoading,
        analysisError,
        refetchAnalysis,
        saveFarm,
        deleteFarm,
        updateLocation,
        updateBoundary
      }}
    >
      {children}
    </FarmContext.Provider>
  );
}

export function useFarms(): FarmContextValue {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarms must be used inside FarmProvider');
  return ctx;
}
