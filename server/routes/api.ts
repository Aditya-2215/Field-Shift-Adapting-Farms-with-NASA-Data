import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { CROP_KNOWLEDGE_BASE, getCropById } from '../../shared/data/crops';
import { DEMO_FARM, DEMO_FARM_ID } from '../../shared/data/demoFarm';
import type { Farm, RotationWeights, SoilProfile } from '../../shared/types/agri';
import {
  jwtAuthMiddleware,
  requireAuthenticatedUser,
  type AuthContext,
  type AuthenticatedRequest
} from '../middleware/authMiddleware';
import {
  createPostgresRepositories,
  RepositoryHttpError,
  type AgriRepositories
} from '../repositories/postgresRepositories';
import { checkDatabaseConnection } from '../config/database';
import { authRouter } from './authRoutes';
import {
  GEMINI_ASSISTANT_MODEL,
  GeminiAssistantError,
  generateAgriAssistantReply,
  isGeminiConfigured
} from '../services/ai/geminiAssistant';
import { evaluateCropSuitability } from '../services/crops/cropSuitabilityEngine';
import { computeEnvironmentalAssessment } from '../services/environmental/environmentalEngine';
import { analyzeGeoJsonBoundary } from '../services/geospatial/geoUtils';
import { searchAddress, reverseGeocode, getElevation } from '../services/geospatial/geocodingService';
import { getNasaDatasetsStatus } from '../services/nasa/nasaAdapters';
import { fetchNasaPowerData, validateCoordinates } from '../services/nasa/nasaPowerService';
import { DEFAULT_ROTATION_WEIGHTS, generateRotationStrategies } from '../services/rotation/rotationEngine';
import { runWhatIfSimulation } from '../services/simulator/whatIfSimulator';

const soilProfileSchema = z.object({
  soilType: z.string().max(80).optional(),
  ph: z.number().min(3).max(11).nullable().optional(),
  nitrogenKgHa: z.number().min(0).max(2000).nullable().optional(),
  phosphorusKgHa: z.number().min(0).max(1000).nullable().optional(),
  potassiumKgHa: z.number().min(0).max(2000).nullable().optional(),
  organicCarbonPct: z.number().min(0).max(20).nullable().optional(),
  organicMatterPct: z.number().min(0).max(35).nullable().optional(),
  texture: z.string().max(80).optional(),
  drainage: z
    .enum(['well_drained', 'moderately_drained', 'poorly_drained', 'excessively_drained'])
    .nullable()
    .optional(),
  labReportFileName: z.string().max(180).nullable().optional(),
  labTestedDate: z.string().max(40).nullable().optional(),
  notes: z.string().max(500).optional()
});

const farmSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/, 'Invalid farm ID format').optional(),
  name: z.string().min(2).max(140),
  country: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  district: z.string().min(2).max(80),
  village: z.string().max(80).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  area: z.number().positive().max(1000000),
  areaUnit: z.enum(['hectares', 'acres']),
  irrigationAvailable: z.boolean(),
  irrigationMethod: z.string().max(80).optional(),
  waterAvailability: z.enum(['abundant', 'moderate', 'limited', 'scarce']),
  waterConstraints: z.string().max(400).optional(),
  currentCrops: z.array(z.string()).min(1).max(12),
  cropHistory: z
    .array(
      z.object({
        year: z.number().int().min(1980).max(2035),
        season: z.enum(['Kharif', 'Rabi', 'Zaid', 'Annual']),
        cropName: z.string().min(1).max(60),
        yieldNote: z.string().max(140).optional()
      })
    )
    .max(30)
    .default([]),
  soilProfile: soilProfileSchema.default({}),
  boundaryGeoJson: z.any().nullable().optional(),
  locationAccuracy: z.number().nullable().optional(),
  addressComponents: z.record(z.string(), z.any()).nullable().optional()
});

const farmLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationAccuracy: z.number().nullable().optional(),
  addressComponents: z.record(z.string(), z.any()).nullable().optional(),
  village: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional()
});

const farmBoundarySchema = z.object({
  boundaryGeoJson: z.any().nullable(),
  area: z.number().positive().optional(),
  areaUnit: z.enum(['hectares', 'acres']).optional()
});

const weightsSchema = z.object({
  waterEfficiency: z.number().min(0).max(100),
  climateResilience: z.number().min(0).max(100),
  soilImprovement: z.number().min(0).max(100),
  erosionProtection: z.number().min(0).max(100),
  marketSuitability: z.number().min(0).max(100)
});

export interface ApiRouterDependencies {
  repositories?: AgriRepositories;
  customAuthMiddleware?: (req: any, res: any, next: any) => void;
  powerFetcher?: typeof fetchNasaPowerData;
  aiResponder?: typeof generateAgriAssistantReply;
}

function sendError(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  err: unknown,
  fallbackStatus = 400
) {
  if (err instanceof RepositoryHttpError || err instanceof GeminiAssistantError) {
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }
  const msg = err instanceof Error ? err.message : 'Request failed';
  res.status(fallbackStatus).json({ success: false, error: msg });
}

export function createApiRouter(deps: ApiRouterDependencies = {}): Router {
  const router = Router();
  const repos = deps.repositories ?? createPostgresRepositories();
  const authMiddleware = deps.customAuthMiddleware ?? jwtAuthMiddleware;
  const fetchPower = deps.powerFetcher ?? fetchNasaPowerData;
  const askGemini = deps.aiResponder ?? generateAgriAssistantReply;

  router.use(authMiddleware);

  // Mount dedicated authentication router
  router.use('/auth', authRouter);

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many AI assistant requests. Please wait a minute and try again.' }
  });

  async function resolveAuthorizedFarm(
    authUser: AuthContext,
    farmId?: unknown,
    inlineFarm?: unknown
  ): Promise<{ farm: Farm; isPersistedOwnedFarm: boolean }> {
    const requestedId = typeof farmId === 'string' && farmId.trim() ? farmId.trim() : undefined;

    if (requestedId === DEMO_FARM_ID) {
      return { farm: DEMO_FARM, isPersistedOwnedFarm: false };
    }

    if (requestedId) {
      if (authUser.isDemo) {
        throw new RepositoryHttpError(
          'Authentication required. Demonstration mode only supports the read-only Barabanki demonstration farm.',
          401
        );
      }
      const owned = await repos.farms.getOwnedOrDemo(requestedId, authUser);
      return { farm: owned, isPersistedOwnedFarm: owned.id !== DEMO_FARM_ID };
    }

    if (inlineFarm && typeof inlineFarm === 'object') {
      const candidateId = (inlineFarm as { id?: unknown }).id;
      if (candidateId === DEMO_FARM_ID) {
        return { farm: DEMO_FARM, isPersistedOwnedFarm: false };
      }
      if (authUser.isDemo) {
        throw new RepositoryHttpError(
          'Authentication required. Demonstration mode is read-only and only analyzes the Barabanki demonstration farm.',
          401
        );
      }
      if (typeof candidateId === 'string' && candidateId.trim()) {
        const owned = await repos.farms.getOwnedOrDemo(candidateId.trim(), authUser);
        return { farm: owned, isPersistedOwnedFarm: owned.id !== DEMO_FARM_ID };
      }
      const parsed = farmSchema.safeParse(inlineFarm);
      if (!parsed.success) {
        throw new RepositoryHttpError(parsed.error.issues[0]?.message || 'Invalid farm payload', 400);
      }
      const now = new Date().toISOString();
      return {
        farm: {
          ...parsed.data,
          id: `draft_${Date.now()}`,
          ownerId: authUser.uid,
          createdAt: now,
          updatedAt: now
        },
        isPersistedOwnedFarm: false
      };
    }

    return { farm: DEMO_FARM, isPersistedOwnedFarm: false };
  }

  router.get('/health', async (_req, res) => {
    const isDbConnected = await checkDatabaseConnection();
    res.json({
      success: true,
      data: {
        service: 'AgriShift AI API',
        timestamp: new Date().toISOString(),
        database: 'PostgreSQL',
        databaseConnected: isDbConnected,
        authMode: 'JWT + Google OAuth 2.0',
        geminiConfigured: isGeminiConfigured(),
        geminiModel: GEMINI_ASSISTANT_MODEL,
        earthdataConfigured: Boolean(process.env.NASA_EARTHDATA_TOKEN),
        geeConfigured: Boolean(process.env.GEE_SERVICE_ACCOUNT_JSON)
      }
    });
  });

  // Profile preferences (Backwards compatibility)
  router.get('/auth/profile', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const profile = await repos.users.get(req.authUser!);
      res.json({ success: true, data: profile });
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  router.put('/auth/profile', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const profileSchema = z.object({
        name: z.string().min(1).max(120).optional(),
        preferredLanguage: z.string().min(2).max(20).optional(),
        location: z.string().max(160).optional()
      });
      const parsed = profileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid profile update' });
        return;
      }
      const updated = await repos.users.update(parsed.data, req.authUser!);
      res.json({ success: true, data: updated });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---------------- FARMS CRUD ----------------

  router.get('/farms', async (req: AuthenticatedRequest, res) => {
    try {
      const farms = await repos.farms.listAccessible(req.authUser!);
      res.json({ success: true, data: farms });
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  router.get('/farms/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const farm = await repos.farms.getOwnedOrDemo(req.params.id, req.authUser!);
      res.json({ success: true, data: farm });
    } catch (err) {
      sendError(res, err, 404);
    }
  });

  router.post('/farms', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = farmSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid farm payload' });
        return;
      }
      const created = await repos.farms.create(parsed.data, req.authUser!);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  router.put('/farms/:id', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = farmSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid farm payload' });
        return;
      }
      const updated = await repos.farms.update(req.params.id, parsed.data, req.authUser!);
      res.json({ success: true, data: updated });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  router.delete('/farms/:id', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      await repos.farms.delete(req.params.id, req.authUser!);
      res.json({ success: true, data: { deleted: req.params.id } });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  const handleLocationUpdate = async (req: AuthenticatedRequest, res: any) => {
    try {
      const parsed = farmLocationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid location payload' });
        return;
      }
      const updated = await repos.farms.updateLocation(req.params.id, parsed.data, req.authUser!);
      res.json({ success: true, data: updated });
    } catch (err) {
      sendError(res, err, 400);
    }
  };
  router.patch('/farms/:id/location', requireAuthenticatedUser, handleLocationUpdate);
  router.put('/farms/:id/location', requireAuthenticatedUser, handleLocationUpdate);

  const handleBoundaryUpdate = async (req: AuthenticatedRequest, res: any) => {
    try {
      const parsed = farmBoundarySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid boundary payload' });
        return;
      }
      let area = parsed.data.area;
      if (parsed.data.boundaryGeoJson && (!area || area <= 0)) {
        try {
          const analysis = analyzeGeoJsonBoundary(parsed.data.boundaryGeoJson);
          area = analysis.areaHectares;
        } catch {
          // Keep existing area
        }
      }
      const updated = await repos.farms.updateBoundary(
        req.params.id,
        {
          boundaryGeoJson: parsed.data.boundaryGeoJson,
          area,
          areaUnit: parsed.data.areaUnit
        },
        req.authUser!
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      sendError(res, err, 400);
    }
  };
  router.patch('/farms/:id/boundary', requireAuthenticatedUser, handleBoundaryUpdate);
  router.put('/farms/:id/boundary', requireAuthenticatedUser, handleBoundaryUpdate);

  router.put('/farms/:id/soil-profile', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = soilProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid soil profile' });
        return;
      }
      const updatedFarm = await repos.soilProfiles.updateForFarm(req.params.id, parsed.data as SoilProfile, req.authUser!);
      res.json({ success: true, data: updatedFarm });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---------------- GEOSPATIAL ----------------

  router.get('/geospatial/geocode', async (req, res) => {
    try {
      const query = String(req.query.q || req.query.query || '').trim();
      if (!query) {
        res.status(400).json({ success: false, error: 'Query parameter q is required.' });
        return;
      }
      const results = await searchAddress(query);
      res.json({ success: true, data: results });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  router.get('/geospatial/reverse-geocode', async (req, res) => {
    try {
      const lat = parseFloat(String(req.query.lat));
      const lon = parseFloat(String(req.query.lon ?? req.query.lng));
      if (isNaN(lat) || isNaN(lon)) {
        res.status(400).json({ success: false, error: 'Valid lat and lon numeric query parameters are required.' });
        return;
      }
      validateCoordinates(lat, lon);
      const result = await reverseGeocode(lat, lon);
      res.json({ success: true, data: result });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  router.get('/geospatial/elevation', async (req, res) => {
    try {
      const lat = parseFloat(String(req.query.lat));
      const lon = parseFloat(String(req.query.lon ?? req.query.lng));
      if (isNaN(lat) || isNaN(lon)) {
        res.status(400).json({ success: false, error: 'Valid lat and lon numeric query parameters are required.' });
        return;
      }
      validateCoordinates(lat, lon);
      const result = await getElevation(lat, lon);
      res.json({ success: true, data: result });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  router.post('/geospatial/analyze-geojson', (req, res) => {
    try {
      const { geoJson } = req.body;
      const result = analyzeGeoJsonBoundary(geoJson);
      res.json({ success: true, data: result });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---------------- ENVIRONMENTAL ANALYSIS ----------------

  router.post('/analysis/environment', async (req: AuthenticatedRequest, res) => {
    try {
      const { farmId, farm: inlineFarm, persist } = req.body;
      const { farm, isPersistedOwnedFarm } = await resolveAuthorizedFarm(req.authUser!, farmId, inlineFarm);

      validateCoordinates(farm.latitude, farm.longitude);
      const nasaPower = await fetchPower({
        farmId: farm.id,
        latitude: farm.latitude,
        longitude: farm.longitude
      });

      const assessment = computeEnvironmentalAssessment(farm, nasaPower);
      const datasets = getNasaDatasetsStatus(!nasaPower.isDemonstrationFallback, nasaPower.retrievedAt);

      let persistedAssessmentId: string | undefined;
      if (persist && isPersistedOwnedFarm && !req.authUser!.isDemo) {
        const saved = await repos.assessments.create(farm, assessment, req.authUser!);
        persistedAssessmentId = saved.id;
      }

      res.json({
        success: true,
        data: {
          farm,
          nasaPower,
          assessment,
          datasets,
          persistedAssessmentId
        }
      });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---------------- ASSESSMENTS ----------------

  router.get('/assessments', async (req: AuthenticatedRequest, res) => {
    try {
      const farmId = typeof req.query.farmId === 'string' ? req.query.farmId : undefined;
      const list = await repos.assessments.list(req.authUser!, farmId);
      res.json({ success: true, data: list });
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  router.post('/assessments', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const { farmId } = req.body;
      if (!farmId || typeof farmId !== 'string') {
        res.status(400).json({ success: false, error: 'farmId is required.' });
        return;
      }
      const { farm } = await resolveAuthorizedFarm(req.authUser!, farmId);
      const power = await fetchPower({
        farmId: farm.id,
        latitude: farm.latitude,
        longitude: farm.longitude
      });
      const assessment = computeEnvironmentalAssessment(farm, power);
      const saved = await repos.assessments.create(farm, assessment, req.authUser!);
      res.status(201).json({ success: true, data: saved });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  router.delete('/assessments/:id', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      await repos.assessments.delete(req.params.id, req.authUser!);
      res.json({ success: true, data: { deleted: req.params.id } });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---------------- CROPS & SUITABILITY ----------------

  router.get('/crops', (_req, res) => {
    res.json({ success: true, data: CROP_KNOWLEDGE_BASE });
  });

  router.post('/crops/suitability', async (req: AuthenticatedRequest, res) => {
    try {
      const { farmId, farm: inlineFarm } = req.body;
      const { farm } = await resolveAuthorizedFarm(req.authUser!, farmId, inlineFarm);

      const power = await fetchPower({
        farmId: farm.id,
        latitude: farm.latitude,
        longitude: farm.longitude
      });

      const suitability = evaluateCropSuitability(farm, power);
      res.json({ success: true, data: { farmId: farm.id, suitability } });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---------------- ROTATION ----------------

  router.post('/rotation/generate', async (req: AuthenticatedRequest, res) => {
    try {
      const { farmId, farm: inlineFarm, weights } = req.body;
      const parsedWeights = weightsSchema.safeParse(weights ?? DEFAULT_ROTATION_WEIGHTS);
      if (!parsedWeights.success) {
        res.status(400).json({ success: false, error: 'Invalid weights configuration' });
        return;
      }

      const { farm } = await resolveAuthorizedFarm(req.authUser!, farmId, inlineFarm);
      const power = await fetchPower({
        farmId: farm.id,
        latitude: farm.latitude,
        longitude: farm.longitude
      });

      const suitability = evaluateCropSuitability(farm, power);
      const comparison = generateRotationStrategies(farm, power, suitability, parsedWeights.data as RotationWeights);
      res.json({ success: true, data: comparison });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  router.get('/rotations', async (req: AuthenticatedRequest, res) => {
    try {
      const farmId = typeof req.query.farmId === 'string' ? req.query.farmId : undefined;
      const scenarios = await repos.rotations.list(req.authUser!, farmId);
      res.json({ success: true, data: scenarios });
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  router.post('/rotations', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      const { farmId, title, weights } = req.body;
      if (!farmId || !title) {
        res.status(400).json({ success: false, error: 'farmId and title are required.' });
        return;
      }
      const parsedWeights = weightsSchema.safeParse(weights ?? DEFAULT_ROTATION_WEIGHTS);
      if (!parsedWeights.success) {
        res.status(400).json({ success: false, error: 'Invalid weights configuration.' });
        return;
      }

      const { farm } = await resolveAuthorizedFarm(req.authUser!, farmId);
      const power = await fetchPower({
        farmId: farm.id,
        latitude: farm.latitude,
        longitude: farm.longitude
      });
      const suitability = evaluateCropSuitability(farm, power);
      const comparison = generateRotationStrategies(farm, power, suitability, parsedWeights.data as RotationWeights);

      const saved = await repos.rotations.create(farm, title, comparison, req.authUser!);
      res.status(201).json({ success: true, data: saved });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  router.delete('/rotations/:id', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      await repos.rotations.delete(req.params.id, req.authUser!);
      res.json({ success: true, data: { deleted: req.params.id } });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---------------- SIMULATOR ----------------

  router.post('/simulator/run', async (req: AuthenticatedRequest, res) => {
    try {
      const { farmId, farm: inlineFarm, scenario } = req.body;
      const { farm } = await resolveAuthorizedFarm(req.authUser!, farmId, inlineFarm);

      const power = await fetchPower({
        farmId: farm.id,
        latitude: farm.latitude,
        longitude: farm.longitude
      });

      const result = runWhatIfSimulation(farm, power, scenario);
      res.json({ success: true, data: result });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---------------- AI ASSISTANT ----------------

  router.get('/ai/conversations', async (req: AuthenticatedRequest, res) => {
    try {
      const farmId = typeof req.query.farmId === 'string' ? req.query.farmId : undefined;
      if (!farmId) {
        res.status(400).json({ success: false, error: 'farmId query parameter is required' });
        return;
      }
      const conv = await repos.conversations.getForFarm(farmId, req.authUser!);
      res.json({ success: true, data: conv });
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  router.post('/ai/chat', aiLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const { farmId, farm: inlineFarm, question, history, weights } = req.body;
      if (!question || typeof question !== 'string') {
        res.status(400).json({ success: false, error: 'question is required' });
        return;
      }

      const { farm, isPersistedOwnedFarm } = await resolveAuthorizedFarm(req.authUser!, farmId, inlineFarm);

      const power = await fetchPower({
        farmId: farm.id,
        latitude: farm.latitude,
        longitude: farm.longitude
      });

      const assessment = computeEnvironmentalAssessment(farm, power);
      const suitability = evaluateCropSuitability(farm, power);
      const rotationComparison = generateRotationStrategies(
        farm,
        power,
        suitability,
        (weights as RotationWeights) ?? DEFAULT_ROTATION_WEIGHTS
      );

      const response = await askGemini(question, history || [], {
        farm,
        nasaPower: power,
        assessment,
        suitability,
        rotations: rotationComparison
      });

      if (isPersistedOwnedFarm && !req.authUser!.isDemo) {
        const now = new Date().toISOString();
        await repos.conversations.appendTurns(
          farm,
          [
            { id: `usr_${Date.now()}`, role: 'user', content: question, timestamp: now },
            { id: `ast_${Date.now() + 1}`, role: 'assistant', content: response.reply, timestamp: new Date().toISOString() }
          ],
          req.authUser!
        );
      }

      res.json({ success: true, data: response });
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  // ---------------- REPORTS ----------------

  router.get('/reports', async (req: AuthenticatedRequest, res) => {
    try {
      const farmId = typeof req.query.farmId === 'string' ? req.query.farmId : undefined;
      const list = await repos.reports.list(req.authUser!, farmId);
      res.json({ success: true, data: list });
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  router.delete('/reports/:id', requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    try {
      await repos.reports.delete(req.params.id, req.authUser!);
      res.json({ success: true, data: { deleted: req.params.id } });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  router.post('/reports/generate', async (req: AuthenticatedRequest, res) => {
    try {
      const { farmId, farm: inlineFarm, weights, persist = true } = req.body;
      const { farm, isPersistedOwnedFarm } = await resolveAuthorizedFarm(req.authUser!, farmId, inlineFarm);

      const nasaPower = await fetchPower({
        farmId: farm.id,
        latitude: farm.latitude,
        longitude: farm.longitude
      });

      const assessment = computeEnvironmentalAssessment(farm, nasaPower);
      const datasets = getNasaDatasetsStatus(!nasaPower.isDemonstrationFallback, nasaPower.retrievedAt);
      const suitability = evaluateCropSuitability(farm, nasaPower);
      const rotationComparison = generateRotationStrategies(
        farm,
        nasaPower,
        suitability,
        (weights as RotationWeights) ?? DEFAULT_ROTATION_WEIGHTS
      );

      const reportId = `rep_${Date.now()}`;
      const recommendedStrategy = rotationComparison.strategies[0]?.label || 'Strategy B - Soil Regeneration Focus';

      let persistedReportId: string | undefined;
      if (persist && isPersistedOwnedFarm && !req.authUser!.isDemo) {
        const saved = await repos.reports.create(
          farm,
          reportId,
          recommendedStrategy,
          assessment.methodologySummary || 'Agronomic decision report',
          req.authUser!
        );
        persistedReportId = saved.id;
      }

      res.json({
        success: true,
        data: {
          id: persistedReportId ?? reportId,
          farm,
          nasaPower,
          datasets,
          assessment,
          suitability,
          rotationComparison,
          generatedAt: new Date().toISOString(),
          persisted: Boolean(persistedReportId),
          disclaimer:
            'AgriShift AI is a scientific decision-support tool. Modeled crop suitability and rotation scores are comparative indicators derived from NASA POWER observations and agronomic rule bases; consult your local Krishi Vigyan Kendra (KVK) or certified agronomist before making high-impact field decisions.'
        }
      });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  return router;
}

export const apiRouter = createApiRouter();
