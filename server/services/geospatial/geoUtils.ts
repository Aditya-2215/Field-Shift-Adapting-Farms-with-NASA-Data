import * as turf from '@turf/turf';
import type { GeoJsonPolygon } from '../../../shared/types/agri';

export interface AnalyzedGeoBoundary {
  valid: boolean;
  areaHectares: number;
  areaAcres: number;
  centroidLat: number;
  centroidLng: number;
  bbox: [number, number, number, number];
  normalizedFeature: GeoJsonPolygon;
}

export function analyzeGeoJsonBoundary(input: unknown): AnalyzedGeoBoundary {
  if (!input || typeof input !== 'object') {
    throw new Error('GeoJSON boundary must be a valid JSON object.');
  }

  const obj = input as Record<string, unknown>;
  let feature: GeoJSON.Feature<GeoJSON.Polygon>;

  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features) && obj.features.length > 0) {
    const first = obj.features[0] as GeoJSON.Feature;
    if (first.geometry?.type !== 'Polygon') {
      throw new Error('GeoJSON FeatureCollection first feature must be a Polygon.');
    }
    feature = first as GeoJSON.Feature<GeoJSON.Polygon>;
  } else if (obj.type === 'Feature' && (obj.geometry as GeoJSON.Geometry | undefined)?.type === 'Polygon') {
    feature = obj as unknown as GeoJSON.Feature<GeoJSON.Polygon>;
  } else if (obj.type === 'Polygon' && Array.isArray(obj.coordinates)) {
    feature = turf.polygon(obj.coordinates as number[][][]);
  } else {
    throw new Error('Unsupported GeoJSON geometry. Please provide a Polygon Feature, FeatureCollection, or Polygon.');
  }

  const areaSqMeters = turf.area(feature);
  if (!Number.isFinite(areaSqMeters) || areaSqMeters <= 0) {
    throw new Error('Polygon has zero or invalid area.');
  }

  const centroid = turf.centroid(feature);
  const [centroidLng, centroidLat] = centroid.geometry.coordinates;
  const bbox = turf.bbox(feature) as [number, number, number, number];

  return {
    valid: true,
    areaHectares: Math.round((areaSqMeters / 10000) * 100) / 100,
    areaAcres: Math.round((areaSqMeters / 4046.856) * 100) / 100,
    centroidLat: Math.round(centroidLat * 100000) / 100000,
    centroidLng: Math.round(centroidLng * 100000) / 100000,
    bbox,
    normalizedFeature: {
      type: 'Feature',
      properties: feature.properties ?? {},
      geometry: {
        type: 'Polygon',
        coordinates: feature.geometry.coordinates
      }
    }
  };
}
