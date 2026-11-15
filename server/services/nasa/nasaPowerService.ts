import type { NasaPowerData, NasaPowerMonthlyPoint } from '../../../shared/types/agri';
import { DEMO_NASA_POWER_FALLBACK } from '../../../shared/data/demoFarm';

interface CacheEntry {
  data: NasaPowerData;
  expiresAt: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const powerCache = new Map<string, CacheEntry>();

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function validateCoordinates(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error(`Invalid longitude: ${lon}. Must be between -180 and 180.`);
  }
}

export function validateDateRange(startDate: string, endDate: string): { startCompact: string; endCompact: string } {
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRegex.test(startDate) || !isoRegex.test(endDate)) {
    throw new Error('Dates must be formatted as YYYY-MM-DD.');
  }
  const s = new Date(`${startDate}T00:00:00Z`);
  const e = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    throw new Error('Invalid calendar date provided.');
  }
  if (s.toISOString().slice(0, 10) !== startDate || e.toISOString().slice(0, 10) !== endDate) {
    throw new Error('Invalid calendar date provided.');
  }
  if (s > e) {
    throw new Error('startDate must be before or equal to endDate.');
  }
  const diffDays = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 1850) {
    throw new Error('Date range cannot exceed 5 years (1850 days) per request.');
  }
  return {
    startCompact: startDate.replace(/-/g, ''),
    endCompact: endDate.replace(/-/g, '')
  };
}

/**
 * Computes a rolling 12-month meteorological window anchored to the last
 * completed calendar month with at least a 7-day NASA POWER release buffer.
 */
export function getDefaultPowerDateRange(now: Date = new Date()): { startDate: string; endDate: string } {
  const safeAnchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7));
  // Last day of the month preceding safeAnchor's current month if safeAnchor is mid-month,
  // or end of safeAnchor's month if safeAnchor happens to be its last day.
  const endMonthLastDay = new Date(Date.UTC(safeAnchor.getUTCFullYear(), safeAnchor.getUTCMonth() + 1, 0));
  const usePrevMonth = safeAnchor.getUTCDate() < endMonthLastDay.getUTCDate();
  const endDateObj = usePrevMonth
    ? new Date(Date.UTC(safeAnchor.getUTCFullYear(), safeAnchor.getUTCMonth(), 0))
    : endMonthLastDay;

  // Start 11 months before endDateObj's month on day 1 (total 12 full calendar months)
  const startDateObj = new Date(Date.UTC(endDateObj.getUTCFullYear(), endDateObj.getUTCMonth() - 11, 1));

  return {
    startDate: startDateObj.toISOString().slice(0, 10),
    endDate: endDateObj.toISOString().slice(0, 10)
  };
}

function isValidVal(v: unknown, fillValue = -999): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > fillValue + 10 && v > -900;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function setCacheEntry(key: string, data: NasaPowerData): void {
  if (powerCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = powerCache.keys().next().value;
    if (oldestKey) powerCache.delete(oldestKey);
  }
  powerCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearNasaPowerCache(): void {
  powerCache.clear();
}

export function getNasaPowerCacheStats(): { entries: number; ttlMs: number } {
  return { entries: powerCache.size, ttlMs: CACHE_TTL_MS };
}

async function fetchWithRetry(url: string, retries = 2, timeoutMs = 12000): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AgriShift-AI/1.0 (NASA-Space-Apps-2026)'
        }
      });
      clearTimeout(timer);
      if (res.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        throw new Error(`NASA POWER HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('NASA POWER request failed');
}

export interface PowerApiResponse {
  header?: {
    fill_value?: number;
    range?: string;
    sources?: string[];
  };
  parameters?: Record<string, { units?: string; longname?: string }>;
  properties?: {
    parameter?: {
      T2M?: Record<string, number>;
      T2M_MAX?: Record<string, number>;
      T2M_MIN?: Record<string, number>;
      PRECTOTCORR?: Record<string, number>;
      RH2M?: Record<string, number>;
      ALLSKY_SFC_SW_DWN?: Record<string, number>;
    };
  };
}

export interface ClimatologyApiResponse {
  header?: {
    fill_value?: number;
    range?: string;
  };
  properties?: {
    parameter?: {
      T2M?: Record<string, number>;
      PRECTOTCORR?: Record<string, number>;
    };
  };
}

export function parseNasaPowerResponses(params: {
  farmId: string;
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  targetJson: PowerApiResponse;
  climJson?: ClimatologyApiResponse | null;
}): NasaPowerData {
  const p = params.targetJson.properties?.parameter;
  if (!p || !p.T2M || !p.PRECTOTCORR) {
    throw new Error('Incomplete parameter payload returned by NASA POWER');
  }

  const fillValue = typeof params.targetJson.header?.fill_value === 'number' ? params.targetJson.header.fill_value : -999;

  // Verify expected Agroclimatology units when metadata is present
  const radUnits = params.targetJson.parameters?.ALLSKY_SFC_SW_DWN?.units;
  const radToMjFactor = radUnits && radUnits.toLowerCase().includes('kw-hr') ? 3.6 : 1;

  const climMonthTemp = new Map<number, number>();
  const climMonthRainDailyMm = new Map<number, number>();
  let hasClimatology = false;
  let climatologyRangeLabel = 'NASA POWER Climatology Baseline';

  if (params.climJson?.properties?.parameter) {
    const climFill =
      typeof params.climJson.header?.fill_value === 'number' ? params.climJson.header.fill_value : -999;
    const monthKeys = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    monthKeys.forEach((mk, idx) => {
      const ct = params.climJson?.properties?.parameter?.T2M?.[mk];
      const cp = params.climJson?.properties?.parameter?.PRECTOTCORR?.[mk];
      if (isValidVal(ct, climFill)) climMonthTemp.set(idx + 1, ct);
      if (isValidVal(cp, climFill)) climMonthRainDailyMm.set(idx + 1, cp);
    });
    hasClimatology = climMonthTemp.size === 12;
    if (params.climJson.header?.range) {
      climatologyRangeLabel = `NASA POWER ${params.climJson.header.range}`;
    }
  }

  const dates = Object.keys(p.T2M).sort();
  if (dates.length === 0) {
    throw new Error('NASA POWER returned zero daily records for the requested window.');
  }

  const monthlyAgg = new Map<
    string,
    {
      t2m: number[];
      tmax: number[];
      tmin: number[];
      precip: number[];
      rh: number[];
      rad: number[];
    }
  >();

  let totalT2m = 0;
  let countT2m = 0;
  let overallMax = -Infinity;
  let overallMin = Infinity;
  let totalPrecip = 0;
  let kharifRain = 0;
  let rabiRain = 0;
  let zaidRain = 0;
  let totalRh = 0;
  let countRh = 0;
  let totalRad = 0;
  let countRad = 0;
  let heatStressDays = 0;
  let dryDaysCount = 0;
  let extremeRainDaysCount = 0;
  let missingDaysCount = 0;

  for (const d of dates) {
    const ym = `${d.slice(0, 4)}-${d.slice(4, 6)}`;
    const monthNum = Number(d.slice(4, 6));
    if (!monthlyAgg.has(ym)) {
      monthlyAgg.set(ym, { t2m: [], tmax: [], tmin: [], precip: [], rh: [], rad: [] });
    }
    const bucket = monthlyAgg.get(ym)!;

    const t2m = p.T2M?.[d];
    const tmax = p.T2M_MAX?.[d];
    const tmin = p.T2M_MIN?.[d];
    const prec = p.PRECTOTCORR?.[d];
    const rh = p.RH2M?.[d];
    const rad = p.ALLSKY_SFC_SW_DWN?.[d];

    if (!isValidVal(t2m, fillValue) || !isValidVal(prec, fillValue)) {
      missingDaysCount++;
    }

    if (isValidVal(t2m, fillValue)) {
      bucket.t2m.push(t2m);
      totalT2m += t2m;
      countT2m++;
    }
    if (isValidVal(tmax, fillValue)) {
      bucket.tmax.push(tmax);
      if (tmax > overallMax) overallMax = tmax;
      if (tmax >= 38) heatStressDays++;
    }
    if (isValidVal(tmin, fillValue)) {
      bucket.tmin.push(tmin);
      if (tmin < overallMin) overallMin = tmin;
    }
    if (isValidVal(prec, fillValue)) {
      bucket.precip.push(prec);
      totalPrecip += prec;
      if (prec < 1) dryDaysCount++;
      if (prec >= 50) extremeRainDaysCount++;
      if (monthNum >= 6 && monthNum <= 10) kharifRain += prec;
      else if (monthNum === 4 || monthNum === 5) zaidRain += prec;
      else rabiRain += prec;
    }
    if (isValidVal(rh, fillValue)) {
      bucket.rh.push(rh);
      totalRh += rh;
      countRh++;
    }
    if (isValidVal(rad, fillValue)) {
      const mjRad = rad * radToMjFactor;
      bucket.rad.push(mjRad);
      totalRad += mjRad;
      countRad++;
    }
  }

  if (countT2m === 0) {
    throw new Error('NASA POWER returned only fill/missing temperature values for this coordinate and date range.');
  }

  let weightedBaseTempSum = 0;
  let weightedBaseTempDays = 0;
  let baselinePrecipSum = 0;

  const monthlySeries: NasaPowerMonthlyPoint[] = Array.from(monthlyAgg.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, agg]) => {
      const [yrStr, moStr] = ym.split('-');
      const yr = Number(yrStr);
      const mo = Number(moStr);
      const avgT = agg.t2m.length ? agg.t2m.reduce((s, v) => s + v, 0) / agg.t2m.length : null;
      const maxT = agg.tmax.length ? Math.max(...agg.tmax) : null;
      const minT = agg.tmin.length ? Math.min(...agg.tmin) : null;
      const sumP = agg.precip.length ? agg.precip.reduce((s, v) => s + v, 0) : null;
      const avgRh = agg.rh.length ? agg.rh.reduce((s, v) => s + v, 0) / agg.rh.length : null;
      const avgRad = agg.rad.length ? agg.rad.reduce((s, v) => s + v, 0) / agg.rad.length : null;

      let tempAnom: number | null = null;
      let rainAnomPct: number | null = null;

      if (hasClimatology && avgT !== null && sumP !== null) {
        const baseT = climMonthTemp.get(mo);
        const baseDailyP = climMonthRainDailyMm.get(mo);
        if (baseT !== undefined) {
          tempAnom = round2(avgT - baseT);
          weightedBaseTempSum += baseT * agg.t2m.length;
          weightedBaseTempDays += agg.t2m.length;
        }
        if (baseDailyP !== undefined) {
          // Scale baseline precipitation by valid observed days in this month for fair partial-month comparison
          const observedDays = agg.precip.length || new Date(Date.UTC(yr, mo, 0)).getUTCDate();
          const baseMonthlyP = baseDailyP * observedDays;
          baselinePrecipSum += baseMonthlyP;
          if (baseMonthlyP > 2) {
            rainAnomPct = round1(((sumP - baseMonthlyP) / baseMonthlyP) * 100);
          }
        }
      }

      return {
        month: ym,
        label: `${MONTH_NAMES[mo - 1]} ${yr}`,
        avgTempC: avgT !== null ? round1(avgT) : null,
        maxTempC: maxT !== null ? round1(maxT) : null,
        minTempC: minT !== null ? round1(minT) : null,
        precipitationMm: sumP !== null ? round1(sumP) : null,
        humidityPct: avgRh !== null ? round1(avgRh) : null,
        solarRadiationMjM2: avgRad !== null ? round1(avgRad) : null,
        tempAnomalyC: tempAnom,
        rainfallAnomalyPct: rainAnomPct
      };
    });

  const rawMeanTempC = totalT2m / countT2m;
  const meanTempC = round1(rawMeanTempC);
  const weightedBaseMean = weightedBaseTempDays ? weightedBaseTempSum / weightedBaseTempDays : rawMeanTempC;
  const tempAnomalyC = hasClimatology ? round2(rawMeanTempC - weightedBaseMean) : 0;
  const rainfallAnomalyPct =
    hasClimatology && baselinePrecipSum > 10
      ? round1(((totalPrecip - baselinePrecipSum) / baselinePrecipSum) * 100)
      : 0;

  return {
    farmId: params.farmId,
    latitude: params.latitude,
    longitude: params.longitude,
    startDate: params.startDate,
    endDate: params.endDate,
    source: 'NASA POWER Agroclimatology API (MERRA-2 / CERES)',
    spatialResolution: '0.5° × 0.625° (~55 km grid cell)',
    retrievedAt: new Date().toISOString(),
    isDemonstrationFallback: false,
    statusMessage: 'Live NASA POWER observations retrieved successfully.',
    summary: {
      meanTempC,
      maxTempC: Number.isFinite(overallMax) ? round1(overallMax) : 0,
      minTempC: Number.isFinite(overallMin) ? round1(overallMin) : 0,
      totalPrecipitationMm: round1(totalPrecip),
      kharifRainfallMm: round1(kharifRain),
      rabiRainfallMm: round1(rabiRain),
      zaidRainfallMm: round1(zaidRain),
      meanHumidityPct: countRh ? round1(totalRh / countRh) : 0,
      meanSolarRadiationMjM2: countRad ? round1(totalRad / countRad) : 0,
      tempAnomalyC,
      rainfallAnomalyPct,
      heatStressDays,
      dryDaysCount,
      extremeRainDaysCount,
      baselineReference: hasClimatology
        ? climatologyRangeLabel
        : 'Climatology baseline unavailable; anomalies set to 0'
    },
    monthlySeries,
    missingDaysCount,
    totalDaysCount: dates.length
  };
}

export async function fetchNasaPowerData(params: {
  farmId: string;
  latitude: number;
  longitude: number;
  startDate?: string;
  endDate?: string;
}): Promise<NasaPowerData> {
  validateCoordinates(params.latitude, params.longitude);

  const defaults = getDefaultPowerDateRange();
  const startDate = params.startDate ?? defaults.startDate;
  const endDate = params.endDate ?? defaults.endDate;
  const { startCompact, endCompact } = validateDateRange(startDate, endDate);

  const cacheKey = `${params.latitude.toFixed(3)}:${params.longitude.toFixed(3)}:${startCompact}:${endCompact}`;
  const cached = powerCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, farmId: params.farmId };
  }

  const targetUrl =
    `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN` +
    `&community=AG&longitude=${params.longitude.toFixed(4)}&latitude=${params.latitude.toFixed(4)}` +
    `&start=${startCompact}&end=${endCompact}&format=JSON`;

  const climatologyUrl =
    `https://power.larc.nasa.gov/api/temporal/climatology/point` +
    `?parameters=T2M,PRECTOTCORR` +
    `&community=AG&longitude=${params.longitude.toFixed(4)}&latitude=${params.latitude.toFixed(4)}&format=JSON`;

  try {
    const [targetRes, climRes] = await Promise.all([
      fetchWithRetry(targetUrl, 1, 10000),
      fetchWithRetry(climatologyUrl, 1, 10000).catch(() => null)
    ]);

    const targetJson = (await targetRes.json()) as PowerApiResponse;
    const climJson = climRes ? ((await climRes.json().catch(() => null)) as ClimatologyApiResponse | null) : null;

    const result = parseNasaPowerResponses({
      farmId: params.farmId,
      latitude: params.latitude,
      longitude: params.longitude,
      startDate,
      endDate,
      targetJson,
      climJson
    });

    setCacheEntry(cacheKey, result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      ...DEMO_NASA_POWER_FALLBACK,
      farmId: params.farmId,
      latitude: params.latitude,
      longitude: params.longitude,
      retrievedAt: new Date().toISOString(),
      isDemonstrationFallback: true,
      statusMessage: `DEMONSTRATION DATA: Live NASA POWER API failed (${message}). Showing representative baseline for validation.`
    };
  }
}
