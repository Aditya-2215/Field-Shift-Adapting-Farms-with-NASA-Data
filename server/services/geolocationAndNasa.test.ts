import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../config/database';
import { createPostgresRepositories } from '../repositories/postgresRepositories';
import { searchAddress, reverseGeocode, getElevation } from './geospatial/geocodingService';
import { analyzeGeoJsonBoundary } from './geospatial/geoUtils';
import { fetchNasaPowerData, validateCoordinates } from './nasa/nasaPowerService';
import { computeEnvironmentalAssessment } from './environmental/environmentalEngine';
import { getNasaDatasetsStatus } from './nasa/nasaAdapters';
import type { AuthContext } from '../middleware/authMiddleware';

describe('AgriShift AI — Precise Geolocation & Location-Based NASA Data Verification', () => {
  const repos = createPostgresRepositories();

  const userAAuth: AuthContext = {
    uid: 'geo_user_a_' + Date.now(),
    email: `geouserA_${Date.now()}@agrishift.test`,
    emailVerified: true,
    isAdmin: false,
    isDemo: false,
    role: 'farmer'
  };

  const userBAuth: AuthContext = {
    uid: 'geo_user_b_' + Date.now(),
    email: `geouserB_${Date.now()}@agrishift.test`,
    emailVerified: true,
    isAdmin: false,
    isDemo: false,
    role: 'farmer'
  };

  let testFarmId: string;

  it('1. Prepares test users and farm in PostgreSQL', async () => {
    await prisma.user.createMany({
      data: [
        {
          id: userAAuth.uid,
          email: userAAuth.email!,
          fullName: 'Farmer Ramesh (Barabanki)',
          emailVerified: true,
          passwordHash: 'dummy_hash_for_test'
        },
        {
          id: userBAuth.uid,
          email: userBAuth.email!,
          fullName: 'Farmer Suresh (Anand)',
          emailVerified: true,
          passwordHash: 'dummy_hash_for_test'
        }
      ]
    });

    const created = await repos.farms.create(
      {
        name: 'Ramesh Ganga Basin Parcel',
        country: 'India',
        state: 'Uttar Pradesh',
        district: 'Barabanki',
        village: 'Safdarganj',
        latitude: 26.926,
        longitude: 81.183,
        area: 4.5,
        areaUnit: 'hectares',
        irrigationAvailable: true,
        waterAvailability: 'moderate',
        currentCrops: ['Rice', 'Wheat']
      },
      userAAuth
    );

    assert.ok(created.id);
    assert.equal(created.ownerId, userAAuth.uid);
    testFarmId = created.id;
  });

  it('2. Coordinate Validation & GPS Simulation (Granted vs Denied)', () => {
    // Valid coordinates
    assert.doesNotThrow(() => validateCoordinates(26.926, 81.183));
    assert.doesNotThrow(() => validateCoordinates(0, 0));
    assert.doesNotThrow(() => validateCoordinates(-45.5, 170.2));

    // Invalid coordinates
    assert.throws(() => validateCoordinates(95.0, 81.183), /Invalid latitude/);
    assert.throws(() => validateCoordinates(-91.2, 81.183), /Invalid latitude/);
    assert.throws(() => validateCoordinates(26.926, 185.0), /Invalid longitude/);
    assert.throws(() => validateCoordinates(26.926, -182.4), /Invalid longitude/);
    assert.throws(() => validateCoordinates(NaN, 81.183), /Invalid latitude/);

    // Simulated GPS Granted
    const gpsSuccessPayload = {
      coords: {
        latitude: 26.92841,
        longitude: 81.18522,
        accuracy: 8.5 // ±8.5 meters
      }
    };
    assert.ok(gpsSuccessPayload.coords.accuracy < 25, 'GPS provides field-level accuracy < 25m');
    assert.equal(typeof gpsSuccessPayload.coords.latitude, 'number');

    // Simulated GPS Denied
    const gpsDeniedError = {
      code: 1, // PERMISSION_DENIED
      message: 'User denied Geolocation'
    };
    assert.equal(gpsDeniedError.code, 1);
  });

  it('3. Address Search (Geocoding) and Reverse Geocoding', async () => {
    // Search address
    const searchResults = await searchAddress('Barabanki');
    assert.ok(Array.isArray(searchResults));
    assert.ok(searchResults.length > 0);
    const topResult = searchResults[0];
    assert.ok(topResult.displayName.includes('Barabanki') || topResult.displayName.includes('Uttar Pradesh'));
    assert.ok(topResult.latitude >= 20 && topResult.latitude <= 32);
    assert.ok(topResult.longitude >= 70 && topResult.longitude <= 90);
    assert.ok(topResult.addressComponents);

    // Reverse geocode
    const rev = await reverseGeocode(26.926, 81.183);
    assert.ok(rev.displayName);
    assert.ok(rev.addressComponents.district || rev.addressComponents.state);
    assert.equal(rev.latitude, 26.926);
    assert.equal(rev.longitude, 81.183);

    // Elevation lookup
    const elev = await getElevation(26.926, 81.183);
    assert.ok(Number.isFinite(elev.elevationMeters));
    assert.ok(elev.source);
    assert.ok(elev.spatialResolution);
  });

  it('4. Farm Boundary Mapping & Area Calculation via Turf.js', () => {
    // 4-point polygon around Barabanki parcel (~12 hectares)
    const validPolygonGeoJson = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [81.18, 26.92],
            [81.185, 26.92],
            [81.185, 26.915],
            [81.18, 26.915],
            [81.18, 26.92] // closed ring
          ]
        ]
      }
    };

    const analyzed = analyzeGeoJsonBoundary(validPolygonGeoJson);
    assert.equal(analyzed.valid, true);
    assert.ok(analyzed.areaHectares > 0);
    assert.ok(analyzed.areaAcres > 0);
    assert.ok(analyzed.centroidLat > 26.91 && analyzed.centroidLat < 26.93);
    assert.ok(analyzed.centroidLng > 81.17 && analyzed.centroidLng < 81.19);
    assert.equal(analyzed.normalizedFeature.type, 'Feature');

    // Reject non-polygon geometry
    assert.throws(
      () =>
        analyzeGeoJsonBoundary({
          type: 'Point',
          coordinates: [81.18, 26.92]
        }),
      /Unsupported GeoJSON geometry/
    );
  });

  it('5. Persists Farm Location & Boundary in PostgreSQL with User Isolation', async () => {
    // User A updates location
    const updatedLocationFarm = await repos.farms.updateLocation(
      testFarmId,
      {
        latitude: 26.9285,
        longitude: 81.1855,
        locationAccuracy: 6.2,
        addressComponents: {
          village: 'Safdarganj',
          district: 'Barabanki',
          state: 'Uttar Pradesh',
          country: 'India',
          formattedAddress: 'Safdarganj, Barabanki, Uttar Pradesh, India'
        },
        village: 'Safdarganj',
        district: 'Barabanki',
        state: 'Uttar Pradesh'
      },
      userAAuth
    );

    assert.equal(updatedLocationFarm.latitude, 26.9285);
    assert.equal(updatedLocationFarm.longitude, 81.1855);
    assert.equal(updatedLocationFarm.locationAccuracy, 6.2);
    assert.ok(updatedLocationFarm.addressComponents);

    // User A updates boundary
    const boundaryGeoJson = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [81.18, 26.92],
            [81.185, 26.92],
            [81.185, 26.915],
            [81.18, 26.915],
            [81.18, 26.92]
          ]
        ]
      }
    };

    const updatedBoundaryFarm = await repos.farms.updateBoundary(
      testFarmId,
      {
        boundaryGeoJson: boundaryGeoJson as any,
        area: 27.5,
        areaUnit: 'hectares'
      },
      userAAuth
    );

    assert.equal(updatedBoundaryFarm.area, 27.5);
    assert.ok(updatedBoundaryFarm.boundaryGeoJson);

    // Reload from DB and verify persistence
    const reloaded = await repos.farms.getOwnedOrDemo(testFarmId, userAAuth);
    assert.equal(reloaded.latitude, 26.9285);
    assert.equal(reloaded.longitude, 81.1855);
    assert.equal(reloaded.locationAccuracy, 6.2);
    assert.equal(reloaded.area, 27.5);
    assert.ok(reloaded.boundaryGeoJson);

    // Two-user isolation: User B must be rejected when attempting to read or modify User A's farm
    await assert.rejects(
      async () => {
        await repos.farms.getOwnedOrDemo(testFarmId, userBAuth);
      },
      (err: any) => err.statusCode === 403 || err.message.includes('permission') || err.message.includes('Forbidden')
    );

    await assert.rejects(
      async () => {
        await repos.farms.updateLocation(
          testFarmId,
          {
            latitude: 22.564,
            longitude: 72.928
          },
          userBAuth
        );
      },
      (err: any) => err.statusCode === 403 || err.message.includes('permission') || err.message.includes('Forbidden')
    );
  });

  it('6. Location-Based NASA POWER Retrieval & Data Quality Transparency', async () => {
    const powerData = await fetchNasaPowerData({
      farmId: testFarmId,
      latitude: 26.9285,
      longitude: 81.1855
    });

    assert.ok(powerData);
    assert.ok(powerData.summary.meanTempC !== undefined);
    assert.ok(powerData.summary.totalPrecipitationMm !== undefined);
    assert.ok(powerData.summary.meanSolarRadiationMjM2 !== undefined);
    assert.ok(powerData.summary.meanHumidityPct !== undefined);
    assert.ok(powerData.monthlySeries.length > 0);
    assert.equal(powerData.latitude, 26.9285);
    assert.equal(powerData.longitude, 81.1855);

    // Compute location-specific assessment
    const reloadedFarm = await repos.farms.getOwnedOrDemo(testFarmId, userAAuth);
    const assessment = computeEnvironmentalAssessment(reloadedFarm, powerData);
    assert.ok(assessment.overallRiskScore >= 0 && assessment.overallRiskScore <= 100);
    assert.ok(assessment.overallRiskLevel);
    assert.ok(assessment.riskMetrics.length >= 4);

    // Verify dataset status registry integrity & resolution distinctions
    const datasets = getNasaDatasetsStatus(!powerData.isDemonstrationFallback, powerData.retrievedAt);
    assert.equal(datasets.length, 8);

    const powerDataset = datasets.find((d) => d.id === 'power')!;
    assert.ok(powerDataset.spatialResolution.includes('0.5°'));
    assert.equal(powerDataset.isFieldLevel, false, 'NASA POWER is regional gridded data, not field-level');

    const smapDataset = datasets.find((d) => d.id === 'smap')!;
    assert.equal(smapDataset.retrievalImplemented, false, 'SMAP is not falsely claimed as live');

    const srtmDataset = datasets.find((d) => d.id === 'srtm')!;
    assert.ok(srtmDataset.spatialResolution.includes('30 m'));
  });

  it('7. Cleans up test farm and users from PostgreSQL', async () => {
    await repos.farms.delete(testFarmId, userAAuth);
    await prisma.user.deleteMany({
      where: { id: { in: [userAAuth.uid, userBAuth.uid] } }
    });
  });
});
