import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  CropSuitabilityResult,
  EnvironmentalAssessment,
  Farm,
  NasaPowerData,
  RotationComparison
} from '../../../shared/types/agri';

export interface AssistantContextPayload {
  farm: Farm;
  nasaPower: NasaPowerData;
  assessment: EnvironmentalAssessment;
  suitability: CropSuitabilityResult[];
  rotations: RotationComparison;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export class GeminiAssistantError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const GEMINI_ASSISTANT_MODEL = 'gemini-4-hydrogen';

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

function classifyGeminiError(err: unknown): { status: number; message: string; retryable: boolean } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return { status: 429, message: 'Gemini API rate limit or quota reached. Please retry shortly.', retryable: true };
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('timeout')) {
    return { status: 503, message: 'Gemini service is temporarily unavailable. Please try again.', retryable: true };
  }
  if (lower.includes('permission_denied') || lower.includes('api_key_invalid') || lower.includes('403') || lower.includes('401')) {
    return { status: 502, message: 'Server Gemini API key is invalid or unauthorized. Check server secrets.', retryable: false };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return { status: 502, message: `Configured Gemini model (${GEMINI_ASSISTANT_MODEL}) was not found.`, retryable: false };
  }
  return { status: 500, message: raw || 'Gemini assistant failed to generate a response.', retryable: false };
}

export async function generateAgriAssistantReply(
  question: string,
  history: ChatTurn[],
  context: AssistantContextPayload
): Promise<{ reply: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiAssistantError(
      'GEMINI_API_KEY is not configured in the server environment. Configure it in Settings > Secrets to enable the Gemini Agricultural Assistant.',
      503
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const topCrops = context.suitability
    .slice(0, 6)
    .map((c) => `${c.cropName} (${c.score}/100 - ${c.classification})`)
    .join(', ');

  const strategiesSummary = context.rotations.strategies
    .map(
      (st) =>
        `- ${st.code} (${st.label}): ${st.sequenceDisplay} | Score: ${st.totalScore}/100 | Water: ${st.annualWaterDemandMm} mm | Net N: ${st.netNitrogenEffectKgHa} kg/ha`
    )
    .join('\n');

  const systemInstruction = `You are AgriShift AI's Scientific Agricultural Decision-Support Assistant.
Your role is to help farmers understand their farm's environmental conditions, soil constraints, crop suitability, and crop rotation trade-offs using ONLY the verified context provided below.

STRICT SCIENTIFIC & HONESTY RULES:
1. Never invent satellite measurements, soil values, or NASA dataset results that are not present in the context.
2. Never guarantee yield increases or guaranteed financial profits. Always frame recommendations as modeled potential benefits and trade-offs.
3. Explicitly mention missing data or coarse spatial resolution (NASA POWER is ~55 km grid; NDVI is not a direct soil-health metric).
4. Recommend validating major cropping or input changes with a local Krishi Vigyan Kendra (KVK) or certified agricultural expert.
5. Keep answers clear, farmer-friendly, structured with concise bullets, and grounded in exact numbers from the farm context.

CURRENT FARM CONTEXT:
- Farm: ${context.farm.name} (${context.farm.district}, ${context.farm.state}, ${context.farm.country})
- Coordinates: ${context.farm.latitude}°N, ${context.farm.longitude}°E | Area: ${context.farm.area} ${context.farm.areaUnit}
- Water & Irrigation: ${context.farm.irrigationAvailable ? context.farm.irrigationMethod || 'Irrigated' : 'Rainfed only'} (Availability: ${context.farm.waterAvailability})
- Water Constraints: ${context.farm.waterConstraints || 'None specified'}
- Current Crops: ${context.farm.currentCrops.join(', ')}
- Soil Profile: Type=${context.farm.soilProfile.soilType ?? 'Unknown'}, Texture=${context.farm.soilProfile.texture ?? 'Unknown'}, pH=${context.farm.soilProfile.ph ?? 'Missing'}, OC=${context.farm.soilProfile.organicCarbonPct ?? 'Missing'}%, N=${context.farm.soilProfile.nitrogenKgHa ?? 'Missing'} kg/ha, P=${context.farm.soilProfile.phosphorusKgHa ?? 'Missing'} kg/ha, K=${context.farm.soilProfile.potassiumKgHa ?? 'Missing'} kg/ha, Drainage=${context.farm.soilProfile.drainage ?? 'Missing'}

NASA POWER CLIMATE SUMMARY (${context.nasaPower.startDate} to ${context.nasaPower.endDate} | ${context.nasaPower.isDemonstrationFallback ? 'DEMONSTRATION DATA FALLBACK' : 'LIVE NASA POWER'}):
- Mean Temp: ${context.nasaPower.summary.meanTempC}°C (Anomaly: ${context.nasaPower.summary.tempAnomalyC > 0 ? '+' : ''}${context.nasaPower.summary.tempAnomalyC}°C)
- Max/Min Temp: ${context.nasaPower.summary.maxTempC}°C / ${context.nasaPower.summary.minTempC}°C | Heat Stress Days (>=38°C): ${context.nasaPower.summary.heatStressDays}
- Total Rainfall: ${context.nasaPower.summary.totalPrecipitationMm} mm (Anomaly: ${context.nasaPower.summary.rainfallAnomalyPct}%)
- Seasonal Rainfall: Kharif ${context.nasaPower.summary.kharifRainfallMm} mm, Rabi ${context.nasaPower.summary.rabiRainfallMm} mm, Zaid ${context.nasaPower.summary.zaidRainfallMm} mm

ENVIRONMENTAL RISK ASSESSMENT:
- Overall Risk: ${context.assessment.overallRiskLevel} (${context.assessment.overallRiskScore}/100) | Data Completeness: ${context.assessment.dataCompletenessPct}%
- Missing Inputs: ${context.assessment.missingInputs.join('; ') || 'None'}

TOP SUITABLE CROPS: ${topCrops}

ROTATION STRATEGIES:
${strategiesSummary}`;

  const recentHistory = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Farmer' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const prompt = recentHistory
    ? `Previous conversation:\n${recentHistory}\n\nFarmer's new question: ${question}`
    : question;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_ASSISTANT_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      const text = response.text?.trim();
      if (!text) {
        throw new GeminiAssistantError('Gemini returned an empty response.', 502);
      }

      return {
        reply: text,
        model: GEMINI_ASSISTANT_MODEL
      };
    } catch (err) {
      if (err instanceof GeminiAssistantError) throw err;
      lastErr = err;
      const classified = classifyGeminiError(err);
      if (classified.retryable && attempt < 2) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      throw new GeminiAssistantError(classified.message, classified.status);
    }
  }

  const finalInfo = classifyGeminiError(lastErr);
  throw new GeminiAssistantError(finalInfo.message, finalInfo.status);
}
