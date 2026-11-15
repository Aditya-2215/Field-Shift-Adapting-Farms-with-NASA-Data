import { prisma } from '../config/database';
import { DEMO_FARM, DEMO_FARM_ID } from '../../shared/data/demoFarm';
import type {
  AiChatMessage,
  CropHistoryEntry,
  EnvironmentalAssessment,
  Farm,
  GeoJsonPolygon,
  PersistedAiConversation,
  PersistedEnvironmentalAssessment,
  PersistedFarmReport,
  PersistedRotationScenario,
  RotationComparison,
  SoilProfile,
  UserProfile,
  UserRole
} from '../../shared/types/agri';
import type { AuthContext } from '../middleware/authMiddleware';

export class RepositoryHttpError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = 'RepositoryHttpError';
  }
}

function assertOwnership(ownerId: string, authUser: AuthContext, resourceName = 'resource'): void {
  if (authUser.isDemo) {
    throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
  }
  if (ownerId !== authUser.uid && !authUser.isAdmin) {
    throw new RepositoryHttpError(`Forbidden: you do not own this ${resourceName}.`, 403);
  }
}

function mapPrismaFarmToAgriFarm(pFarm: any): Farm {
  const primarySoil = pFarm.soilProfiles && pFarm.soilProfiles.length > 0 ? pFarm.soilProfiles[0] : null;

  const soilProfile: SoilProfile = primarySoil
    ? {
        soilType: primarySoil.soilType || undefined,
        ph: primarySoil.ph ?? null,
        nitrogenKgHa: primarySoil.nitrogen ?? null,
        phosphorusKgHa: primarySoil.phosphorus ?? null,
        potassiumKgHa: primarySoil.potassium ?? null,
        organicCarbonPct: primarySoil.organicCarbon ?? null,
        organicMatterPct: primarySoil.organicMatter ?? null,
        texture: primarySoil.soilTexture || undefined,
        drainage: primarySoil.drainage || null,
        labReportFileName: primarySoil.labReportFileName || null,
        labTestedDate: primarySoil.labTestedDate || null,
        notes: primarySoil.notes || undefined
      }
    : {};

  const cropHistory: CropHistoryEntry[] = (pFarm.cropHistory || []).map((ch: any) => ({
    year: ch.year,
    season: ch.season,
    cropName: ch.cropName || ch.cropId || 'Crop',
    yieldNote: ch.notes || undefined
  }));

  return {
    id: pFarm.id,
    ownerId: pFarm.userId,
    name: pFarm.farmName,
    country: pFarm.country,
    state: pFarm.state,
    district: pFarm.district,
    village: pFarm.village || undefined,
    latitude: pFarm.latitude,
    longitude: pFarm.longitude,
    area: pFarm.area,
    areaUnit: pFarm.areaUnit as Farm['areaUnit'],
    irrigationAvailable: pFarm.irrigationAvailable,
    irrigationMethod: pFarm.irrigationType || undefined,
    waterAvailability: pFarm.waterAvailability as Farm['waterAvailability'],
    waterConstraints: pFarm.waterConstraints || undefined,
    currentCrops: Array.isArray(pFarm.currentCrops) ? pFarm.currentCrops : [],
    cropHistory,
    soilProfile,
    boundaryGeoJson: pFarm.boundaryGeoJson || null,
    locationAccuracy: pFarm.locationAccuracy ?? null,
    addressComponents: pFarm.addressComponents || null,
    isDemo: false,
    createdAt: pFarm.createdAt.toISOString(),
    updatedAt: pFarm.updatedAt.toISOString()
  };
}

export type FarmWriteInput = Omit<Farm, 'id' | 'ownerId' | 'createdAt' | 'updatedAt' | 'isDemo' | 'soilProfile' | 'cropHistory'> & {
  id?: string;
  soilProfile?: SoilProfile;
  cropHistory?: CropHistoryEntry[];
};

export class PostgresFarmRepository {
  async listAccessible(authUser: AuthContext): Promise<Farm[]> {
    if (authUser.isDemo) {
      return [DEMO_FARM];
    }

    const farms = await prisma.farm.findMany({
      where: { userId: authUser.uid },
      include: {
        soilProfiles: true,
        cropHistory: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (farms.length === 0) {
      return [DEMO_FARM];
    }

    return farms.map(mapPrismaFarmToAgriFarm);
  }

  async getOwnedOrDemo(farmId: string, authUser: AuthContext): Promise<Farm> {
    if (farmId === DEMO_FARM_ID) {
      return DEMO_FARM;
    }

    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      include: {
        soilProfiles: true,
        cropHistory: true
      }
    });

    if (!farm) {
      throw new RepositoryHttpError('Farm not found.', 404);
    }

    assertOwnership(farm.userId, authUser, 'farm');
    return mapPrismaFarmToAgriFarm(farm);
  }

  async create(input: FarmWriteInput, authUser: AuthContext): Promise<Farm> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }

    return prisma.$transaction(async (tx) => {
      const created = await tx.farm.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
          userId: authUser.uid,
          farmName: input.name,
          country: input.country,
          state: input.state,
          district: input.district,
          village: input.village || null,
          latitude: Number(input.latitude),
          longitude: Number(input.longitude),
          area: Number(input.area),
          areaUnit: input.areaUnit || 'hectares',
          irrigationAvailable: input.irrigationAvailable ?? true,
          irrigationType: input.irrigationMethod || null,
          waterAvailability: input.waterAvailability || 'moderate',
          waterConstraints: input.waterConstraints || null,
          currentCrops: input.currentCrops || [],
          boundaryGeoJson: (input.boundaryGeoJson as any) || null,
          locationAccuracy: input.locationAccuracy !== undefined ? (input.locationAccuracy ?? null) : null,
          addressComponents: (input.addressComponents as any) || null,
          soilProfiles: {
            create: {
              soilType: input.soilProfile?.soilType || null,
              ph: input.soilProfile?.ph ?? null,
              nitrogen: input.soilProfile?.nitrogenKgHa ?? null,
              phosphorus: input.soilProfile?.phosphorusKgHa ?? null,
              potassium: input.soilProfile?.potassiumKgHa ?? null,
              organicCarbon: input.soilProfile?.organicCarbonPct ?? null,
              organicMatter: input.soilProfile?.organicMatterPct ?? null,
              soilTexture: input.soilProfile?.texture || null,
              drainage: input.soilProfile?.drainage || null,
              labReportFileName: input.soilProfile?.labReportFileName || null,
              labTestedDate: input.soilProfile?.labTestedDate || null,
              notes: input.soilProfile?.notes || null
            }
          },
          cropHistory: {
            create: (input.cropHistory || []).map((ch) => ({
              year: ch.year,
              season: ch.season,
              cropName: ch.cropName,
              notes: ch.yieldNote || null
            }))
          }
        },
        include: {
          soilProfiles: true,
          cropHistory: true
        }
      });

      await tx.auditLog.create({
        data: {
          userId: authUser.uid,
          action: 'FARM_CREATED',
          resourceType: 'farm',
          resourceId: created.id,
          metadata: { name: created.farmName, area: created.area }
        }
      });

      return mapPrismaFarmToAgriFarm(created);
    });
  }

  async update(farmId: string, input: FarmWriteInput, authUser: AuthContext): Promise<Farm> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }
    if (farmId === DEMO_FARM_ID) {
      throw new RepositoryHttpError('The built-in demonstration farm is read-only.', 403);
    }

    const existing = await prisma.farm.findUnique({
      where: { id: farmId },
      include: { soilProfiles: true }
    });

    if (!existing) {
      throw new RepositoryHttpError('Farm not found.', 404);
    }
    assertOwnership(existing.userId, authUser, 'farm');

    return prisma.$transaction(async (tx) => {
      // Update farm record
      await tx.farm.update({
        where: { id: farmId },
        data: {
          farmName: input.name,
          country: input.country,
          state: input.state,
          district: input.district,
          village: input.village || null,
          latitude: Number(input.latitude),
          longitude: Number(input.longitude),
          area: Number(input.area),
          areaUnit: input.areaUnit || 'hectares',
          irrigationAvailable: input.irrigationAvailable ?? true,
          irrigationType: input.irrigationMethod || null,
          waterAvailability: input.waterAvailability || 'moderate',
          waterConstraints: input.waterConstraints || null,
          currentCrops: input.currentCrops || [],
          boundaryGeoJson: (input.boundaryGeoJson as any) || null,
          locationAccuracy: input.locationAccuracy !== undefined ? (input.locationAccuracy ?? null) : undefined,
          addressComponents: input.addressComponents !== undefined ? ((input.addressComponents as any) || null) : undefined
        }
      });

      // Update or create soil profile
      if (input.soilProfile) {
        if (existing.soilProfiles.length > 0) {
          await tx.soilProfile.update({
            where: { id: existing.soilProfiles[0].id },
            data: {
              soilType: input.soilProfile.soilType || null,
              ph: input.soilProfile.ph ?? null,
              nitrogen: input.soilProfile.nitrogenKgHa ?? null,
              phosphorus: input.soilProfile.phosphorusKgHa ?? null,
              potassium: input.soilProfile.potassiumKgHa ?? null,
              organicCarbon: input.soilProfile.organicCarbonPct ?? null,
              organicMatter: input.soilProfile.organicMatterPct ?? null,
              soilTexture: input.soilProfile.texture || null,
              drainage: input.soilProfile.drainage || null,
              labReportFileName: input.soilProfile.labReportFileName || null,
              labTestedDate: input.soilProfile.labTestedDate || null,
              notes: input.soilProfile.notes || null
            }
          });
        } else {
          await tx.soilProfile.create({
            data: {
              farmId,
              soilType: input.soilProfile.soilType || null,
              ph: input.soilProfile.ph ?? null,
              nitrogen: input.soilProfile.nitrogenKgHa ?? null,
              phosphorus: input.soilProfile.phosphorusKgHa ?? null,
              potassium: input.soilProfile.potassiumKgHa ?? null,
              organicCarbon: input.soilProfile.organicCarbonPct ?? null,
              organicMatter: input.soilProfile.organicMatterPct ?? null,
              soilTexture: input.soilProfile.texture || null,
              drainage: input.soilProfile.drainage || null,
              labReportFileName: input.soilProfile.labReportFileName || null,
              labTestedDate: input.soilProfile.labTestedDate || null,
              notes: input.soilProfile.notes || null
            }
          });
        }
      }

      // Replace crop history if provided
      if (input.cropHistory) {
        await tx.cropHistory.deleteMany({ where: { farmId } });
        if (input.cropHistory.length > 0) {
          await tx.cropHistory.createMany({
            data: input.cropHistory.map((ch) => ({
              farmId,
              year: ch.year,
              season: ch.season,
              cropName: ch.cropName,
              notes: ch.yieldNote || null
            }))
          });
        }
      }

      const updated = await tx.farm.findUniqueOrThrow({
        where: { id: farmId },
        include: { soilProfiles: true, cropHistory: true }
      });

      return mapPrismaFarmToAgriFarm(updated);
    });
  }

  async updateLocation(
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
    },
    authUser: AuthContext
  ): Promise<Farm> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }
    if (farmId === DEMO_FARM_ID) {
      throw new RepositoryHttpError('The built-in demonstration farm is read-only.', 403);
    }

    const existing = await prisma.farm.findUnique({
      where: { id: farmId }
    });
    if (!existing) {
      throw new RepositoryHttpError('Farm not found.', 404);
    }
    assertOwnership(existing.userId, authUser, 'farm');

    const updated = await prisma.farm.update({
      where: { id: farmId },
      data: {
        latitude: Number(locationData.latitude),
        longitude: Number(locationData.longitude),
        locationAccuracy: locationData.locationAccuracy !== undefined ? (locationData.locationAccuracy ?? null) : undefined,
        addressComponents: locationData.addressComponents !== undefined ? ((locationData.addressComponents as any) || null) : undefined,
        village: locationData.village !== undefined ? locationData.village : undefined,
        district: locationData.district !== undefined && locationData.district !== null ? locationData.district : undefined,
        state: locationData.state !== undefined && locationData.state !== null ? locationData.state : undefined,
        country: locationData.country !== undefined && locationData.country !== null ? locationData.country : undefined
      },
      include: { soilProfiles: true, cropHistory: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: authUser.uid,
        action: 'FARM_LOCATION_UPDATED',
        resourceType: 'farm',
        resourceId: farmId,
        metadata: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.locationAccuracy
        }
      }
    });

    return mapPrismaFarmToAgriFarm(updated);
  }

  async updateBoundary(
    farmId: string,
    boundaryData: {
      boundaryGeoJson: GeoJsonPolygon | null;
      area?: number;
      areaUnit?: string;
    },
    authUser: AuthContext
  ): Promise<Farm> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }
    if (farmId === DEMO_FARM_ID) {
      throw new RepositoryHttpError('The built-in demonstration farm is read-only.', 403);
    }

    const existing = await prisma.farm.findUnique({
      where: { id: farmId }
    });
    if (!existing) {
      throw new RepositoryHttpError('Farm not found.', 404);
    }
    assertOwnership(existing.userId, authUser, 'farm');

    const updated = await prisma.farm.update({
      where: { id: farmId },
      data: {
        boundaryGeoJson: (boundaryData.boundaryGeoJson as any) || null,
        ...(boundaryData.area !== undefined ? { area: Number(boundaryData.area) } : {}),
        ...(boundaryData.areaUnit ? { areaUnit: boundaryData.areaUnit } : {})
      },
      include: { soilProfiles: true, cropHistory: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: authUser.uid,
        action: 'FARM_BOUNDARY_UPDATED',
        resourceType: 'farm',
        resourceId: farmId,
        metadata: {
          area: boundaryData.area,
          hasBoundary: Boolean(boundaryData.boundaryGeoJson)
        }
      }
    });

    return mapPrismaFarmToAgriFarm(updated);
  }

  async delete(farmId: string, authUser: AuthContext): Promise<void> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }
    if (farmId === DEMO_FARM_ID) {
      throw new RepositoryHttpError('The built-in demonstration farm cannot be deleted.', 403);
    }

    const farm = await prisma.farm.findUnique({
      where: { id: farmId }
    });

    if (!farm) {
      throw new RepositoryHttpError('Farm not found.', 404);
    }
    assertOwnership(farm.userId, authUser, 'farm');

    await prisma.$transaction(async (tx) => {
      await tx.farm.delete({ where: { id: farmId } });
      await tx.auditLog.create({
        data: {
          userId: authUser.uid,
          action: 'FARM_DELETED',
          resourceType: 'farm',
          resourceId: farmId
        }
      });
    });
  }
}

export class PostgresSoilProfileRepository {
  async getForFarm(farmId: string, authUser: AuthContext): Promise<SoilProfile> {
    if (farmId === DEMO_FARM_ID) {
      return DEMO_FARM.soilProfile;
    }

    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      include: { soilProfiles: true }
    });

    if (!farm) {
      throw new RepositoryHttpError('Farm not found.', 404);
    }
    assertOwnership(farm.userId, authUser, 'farm');

    if (!farm.soilProfiles || farm.soilProfiles.length === 0) {
      return {};
    }

    const p = farm.soilProfiles[0];
    return {
      soilType: p.soilType || undefined,
      ph: p.ph ?? null,
      nitrogenKgHa: p.nitrogen ?? null,
      phosphorusKgHa: p.phosphorus ?? null,
      potassiumKgHa: p.potassium ?? null,
      organicCarbonPct: p.organicCarbon ?? null,
      organicMatterPct: p.organicMatter ?? null,
      texture: p.soilTexture || undefined,
      drainage: (p.drainage as SoilProfile['drainage']) || null,
      labReportFileName: p.labReportFileName || null,
      labTestedDate: p.labTestedDate || null,
      notes: p.notes || undefined
    };
  }

  async updateForFarm(farmId: string, soilProfile: SoilProfile, authUser: AuthContext): Promise<Farm> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }
    if (farmId === DEMO_FARM_ID) {
      throw new RepositoryHttpError('The built-in demonstration farm is read-only.', 403);
    }

    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      include: { soilProfiles: true, cropHistory: true }
    });

    if (!farm) {
      throw new RepositoryHttpError('Farm not found.', 404);
    }
    assertOwnership(farm.userId, authUser, 'farm');

    await prisma.$transaction(async (tx) => {
      if (farm.soilProfiles.length > 0) {
        await tx.soilProfile.update({
          where: { id: farm.soilProfiles[0].id },
          data: {
            soilType: soilProfile.soilType || null,
            ph: soilProfile.ph ?? null,
            nitrogen: soilProfile.nitrogenKgHa ?? null,
            phosphorus: soilProfile.phosphorusKgHa ?? null,
            potassium: soilProfile.potassiumKgHa ?? null,
            organicCarbon: soilProfile.organicCarbonPct ?? null,
            organicMatter: soilProfile.organicMatterPct ?? null,
            soilTexture: soilProfile.texture || null,
            drainage: soilProfile.drainage || null,
            labReportFileName: soilProfile.labReportFileName || null,
            labTestedDate: soilProfile.labTestedDate || null,
            notes: soilProfile.notes || null
          }
        });
      } else {
        await tx.soilProfile.create({
          data: {
            farmId,
            soilType: soilProfile.soilType || null,
            ph: soilProfile.ph ?? null,
            nitrogen: soilProfile.nitrogenKgHa ?? null,
            phosphorus: soilProfile.phosphorusKgHa ?? null,
            potassium: soilProfile.potassiumKgHa ?? null,
            organicCarbon: soilProfile.organicCarbonPct ?? null,
            organicMatter: soilProfile.organicMatterPct ?? null,
            soilTexture: soilProfile.texture || null,
            drainage: soilProfile.drainage || null,
            labReportFileName: soilProfile.labReportFileName || null,
            labTestedDate: soilProfile.labTestedDate || null,
            notes: soilProfile.notes || null
          }
        });
      }
    });

    const updated = await prisma.farm.findUniqueOrThrow({
      where: { id: farmId },
      include: { soilProfiles: true, cropHistory: true }
    });

    return mapPrismaFarmToAgriFarm(updated);
  }
}

export class PostgresAssessmentRepository {
  async list(authUser: AuthContext, farmId?: string): Promise<PersistedEnvironmentalAssessment[]> {
    if (authUser.isDemo) {
      return [];
    }

    const where: any = { farm: { userId: authUser.uid } };
    if (farmId && farmId !== DEMO_FARM_ID) {
      where.farmId = farmId;
    }

    const records = await prisma.environmentalAssessment.findMany({
      where,
      include: { farm: true },
      orderBy: { createdAt: 'desc' }
    });

    return records.map((r) => ({
      id: r.id,
      ownerId: r.farm.userId,
      farmId: r.farmId,
      overallRiskLevel: r.overallRisk as PersistedEnvironmentalAssessment['overallRiskLevel'],
      overallRiskScore: r.overallRiskScore ?? 0,
      dataCompleteness: r.dataCompleteness,
      summary: r.summary || undefined,
      indicators: (r.methodology as any) || undefined,
      createdAt: r.createdAt.toISOString()
    }));
  }

  async create(
    farm: Farm,
    assessment: EnvironmentalAssessment,
    authUser: AuthContext
  ): Promise<PersistedEnvironmentalAssessment> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }
    assertOwnership(farm.ownerId, authUser, 'farm');

    const created = await prisma.environmentalAssessment.create({
      data: {
        farmId: farm.id,
        assessmentDate: new Date(assessment.timestamp || Date.now()),
        temperatureRisk: assessment.riskMetrics.find((m) => m.id.includes('temp') || m.id.includes('heat'))?.level || 'Moderate',
        rainfallRisk: assessment.riskMetrics.find((m) => m.id.includes('rain') || m.id.includes('precip'))?.level || 'Moderate',
        waterStress: assessment.riskMetrics.find((m) => m.id.includes('water') || m.id.includes('drought'))?.level || 'Moderate',
        vegetationHealth: assessment.riskMetrics.find((m) => m.id.includes('veg') || m.id.includes('soil'))?.level || 'Moderate',
        overallRisk: assessment.overallRiskLevel,
        overallRiskScore: assessment.overallRiskScore,
        dataCompleteness: assessment.dataCompletenessPct,
        summary: assessment.methodologySummary,
        methodology: {
          riskMetrics: assessment.riskMetrics,
          indicators: assessment.indicators,
          alerts: assessment.alerts,
          scientificCaveats: assessment.scientificCaveats,
          missingInputs: assessment.missingInputs
        } as any
      }
    });

    return {
      id: created.id,
      ownerId: authUser.uid,
      farmId: created.farmId,
      overallRiskLevel: created.overallRisk as any,
      overallRiskScore: created.overallRiskScore ?? 0,
      dataCompleteness: created.dataCompleteness,
      summary: created.summary || undefined,
      indicators: created.methodology as any,
      createdAt: created.createdAt.toISOString()
    };
  }

  async delete(id: string, authUser: AuthContext): Promise<void> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }

    const record = await prisma.environmentalAssessment.findUnique({
      where: { id },
      include: { farm: true }
    });

    if (!record) {
      throw new RepositoryHttpError('Environmental assessment not found.', 404);
    }
    assertOwnership(record.farm.userId, authUser, 'assessment');

    await prisma.environmentalAssessment.delete({ where: { id } });
  }
}

export class PostgresRotationScenarioRepository {
  async list(authUser: AuthContext, farmId?: string): Promise<PersistedRotationScenario[]> {
    if (authUser.isDemo) {
      return [];
    }

    const where: any = { userId: authUser.uid };
    if (farmId && farmId !== DEMO_FARM_ID) {
      where.farmId = farmId;
    }

    const records = await prisma.rotationScenario.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return records.map((r) => ({
      id: r.id,
      ownerId: r.userId,
      farmId: r.farmId,
      title: r.scenarioName,
      weights: (r.uncertaintyMetadata as any)?.weights || {
        waterEfficiency: 25,
        climateResilience: 25,
        soilImprovement: 25,
        erosionProtection: 15,
        marketSuitability: 10
      },
      strategies: Array.isArray(r.cropSequence) ? (r.cropSequence as any) : [],
      createdAt: r.createdAt.toISOString()
    }));
  }

  async create(
    farm: Farm,
    title: string,
    comparison: RotationComparison,
    authUser: AuthContext
  ): Promise<PersistedRotationScenario> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }
    assertOwnership(farm.ownerId, authUser, 'farm');

    const serializedStrategies = comparison.strategies.map((s) => ({
      id: s.id,
      code: s.code,
      label: s.label,
      sequenceDisplay: s.sequenceDisplay,
      totalScore: s.totalScore,
      annualWaterDemandMm: s.annualWaterDemandMm,
      netNitrogenEffectKgHa: s.netNitrogenEffectKgHa
    }));

    const topScore = comparison.strategies[0]?.totalScore ?? 0;
    const topStrategyType = comparison.strategies[0]?.label || 'Recommended Strategy';

    const created = await prisma.rotationScenario.create({
      data: {
        farmId: farm.id,
        userId: authUser.uid,
        scenarioName: title.slice(0, 160),
        strategyType: topStrategyType,
        cropSequence: serializedStrategies as any,
        componentScores: (comparison.strategies[0]?.componentScores || {}) as any,
        totalScore: topScore,
        explanation: comparison.methodologyNote,
        uncertaintyMetadata: {
          weights: comparison.weights,
          constraintsApplied: comparison.constraintsApplied
        } as any
      }
    });

    return {
      id: created.id,
      ownerId: created.userId,
      farmId: created.farmId,
      title: created.scenarioName,
      weights: comparison.weights,
      strategies: serializedStrategies,
      createdAt: created.createdAt.toISOString()
    };
  }

  async delete(id: string, authUser: AuthContext): Promise<void> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }

    const record = await prisma.rotationScenario.findUnique({
      where: { id }
    });

    if (!record) {
      throw new RepositoryHttpError('Rotation scenario not found.', 404);
    }
    assertOwnership(record.userId, authUser, 'rotation scenario');

    await prisma.rotationScenario.delete({ where: { id } });
  }
}

export class PostgresReportRepository {
  async list(authUser: AuthContext, farmId?: string): Promise<PersistedFarmReport[]> {
    if (authUser.isDemo) {
      return [];
    }

    const where: any = { userId: authUser.uid };
    if (farmId && farmId !== DEMO_FARM_ID) {
      where.farmId = farmId;
    }

    const records = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return records.map((r) => ({
      id: r.id,
      ownerId: r.userId,
      farmId: r.farmId,
      title: (r.reportMetadata as any)?.title || `${r.reportType} Report`,
      recommendedStrategy: (r.reportMetadata as any)?.recommendedStrategy || undefined,
      summary: (r.reportMetadata as any)?.summary || undefined,
      createdAt: r.createdAt.toISOString()
    }));
  }

  async getById(id: string, authUser: AuthContext): Promise<PersistedFarmReport> {
    const record = await prisma.report.findUnique({
      where: { id }
    });

    if (!record) {
      throw new RepositoryHttpError('Report not found.', 404);
    }
    assertOwnership(record.userId, authUser, 'report');

    return {
      id: record.id,
      ownerId: record.userId,
      farmId: record.farmId,
      title: (record.reportMetadata as any)?.title || `${record.reportType} Report`,
      recommendedStrategy: (record.reportMetadata as any)?.recommendedStrategy || undefined,
      summary: (record.reportMetadata as any)?.summary || undefined,
      createdAt: record.createdAt.toISOString()
    };
  }

  async create(
    farm: Farm,
    reportId: string,
    recommendedStrategy: string,
    summary: string,
    authUser: AuthContext
  ): Promise<PersistedFarmReport> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }
    assertOwnership(farm.ownerId, authUser, 'farm');

    const title = `${farm.name} - Resilient Shift Plan`;

    const created = await prisma.report.create({
      data: {
        ...(reportId ? { id: reportId } : {}),
        userId: authUser.uid,
        farmId: farm.id,
        reportType: 'AgriShift Decision Support Brief',
        reportMetadata: {
          title,
          recommendedStrategy,
          summary
        } as any
      }
    });

    return {
      id: created.id,
      ownerId: created.userId,
      farmId: created.farmId,
      title,
      recommendedStrategy,
      summary,
      createdAt: created.createdAt.toISOString()
    };
  }

  async delete(id: string, authUser: AuthContext): Promise<void> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }

    const record = await prisma.report.findUnique({
      where: { id }
    });

    if (!record) {
      throw new RepositoryHttpError('Report not found.', 404);
    }
    assertOwnership(record.userId, authUser, 'report');

    await prisma.report.delete({ where: { id } });
  }
}

export class PostgresConversationRepository {
  async getForFarm(farmId: string, authUser: AuthContext): Promise<PersistedAiConversation | null> {
    if (authUser.isDemo || farmId === DEMO_FARM_ID) {
      return null;
    }

    const conv = await prisma.aiConversation.findFirst({
      where: { farmId, userId: authUser.uid },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!conv) return null;

    const messages: AiChatMessage[] = conv.messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.createdAt.toISOString()
    }));

    return {
      id: conv.id,
      ownerId: conv.userId,
      farmId: conv.farmId,
      messages,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString()
    };
  }

  async appendTurns(
    farm: Farm,
    newMessages: AiChatMessage[],
    authUser: AuthContext
  ): Promise<PersistedAiConversation> {
    if (authUser.isDemo) {
      return {
        id: 'demo_conv',
        ownerId: 'demo_user',
        farmId: farm.id,
        messages: newMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    assertOwnership(farm.ownerId, authUser, 'farm');

    let conv = await prisma.aiConversation.findFirst({
      where: { farmId: farm.id, userId: authUser.uid }
    });

    if (!conv) {
      conv = await prisma.aiConversation.create({
        data: {
          farmId: farm.id,
          userId: authUser.uid,
          title: `Agronomy Assistant - ${farm.name}`
        }
      });
    }

    if (newMessages.length > 0) {
      await prisma.aiMessage.createMany({
        data: newMessages.map((m) => ({
          conversationId: conv.id,
          role: m.role,
          content: m.content
        }))
      });
    }

    const updated = await prisma.aiConversation.findUniqueOrThrow({
      where: { id: conv.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    return {
      id: updated.id,
      ownerId: updated.userId,
      farmId: updated.farmId,
      messages: updated.messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt.toISOString()
      })),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }
}

export class PostgresUserProfileRepository {
  async get(authUser: AuthContext): Promise<UserProfile | null> {
    if (authUser.isDemo) {
      return {
        uid: 'demo_user',
        name: 'Demonstration Farmer (UP)',
        email: 'demo@agrishift.local',
        role: 'farmer',
        preferredLanguage: 'English',
        location: 'Barabanki, Uttar Pradesh, India',
        createdAt: '2026-01-10T08:00:00.000Z',
        updatedAt: '2026-10-15T08:00:00.000Z'
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.uid }
    });

    if (!user) return null;

    return {
      uid: user.id,
      name: user.fullName,
      email: user.email,
      role: (user.role as UserRole) || 'farmer',
      preferredLanguage: user.preferredLanguage || 'English',
      location: user.location || 'India',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  async update(
    patch: { name?: string; preferredLanguage?: string; location?: string },
    authUser: AuthContext
  ): Promise<UserProfile> {
    if (authUser.isDemo) {
      throw new RepositoryHttpError('Authentication required. Demonstration mode is read-only.', 401);
    }

    const updated = await prisma.user.update({
      where: { id: authUser.uid },
      data: {
        ...(patch.name ? { fullName: patch.name.trim().slice(0, 100) } : {}),
        ...(patch.preferredLanguage ? { preferredLanguage: patch.preferredLanguage.trim().slice(0, 30) } : {}),
        ...(patch.location ? { location: patch.location.trim().slice(0, 100) } : {})
      }
    });

    return {
      uid: updated.id,
      name: updated.fullName,
      email: updated.email,
      role: (updated.role as UserRole) || 'farmer',
      preferredLanguage: updated.preferredLanguage || 'English',
      location: updated.location || 'India',
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }
}

export interface AgriRepositories {
  farms: PostgresFarmRepository;
  soilProfiles: PostgresSoilProfileRepository;
  assessments: PostgresAssessmentRepository;
  rotations: PostgresRotationScenarioRepository;
  reports: PostgresReportRepository;
  conversations: PostgresConversationRepository;
  users: PostgresUserProfileRepository;
}

export function createPostgresRepositories(): AgriRepositories {
  return {
    farms: new PostgresFarmRepository(),
    soilProfiles: new PostgresSoilProfileRepository(),
    assessments: new PostgresAssessmentRepository(),
    rotations: new PostgresRotationScenarioRepository(),
    reports: new PostgresReportRepository(),
    conversations: new PostgresConversationRepository(),
    users: new PostgresUserProfileRepository()
  };
}
