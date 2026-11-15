import type { NasaDatasetStatus } from '../../../shared/types/agri';

export function getNasaDatasetsStatus(powerLive: boolean, powerLastUpdated: string | null): NasaDatasetStatus[] {
  const hasEarthdata = Boolean(
    process.env.NASA_EARTHDATA_TOKEN && process.env.NASA_EARTHDATA_TOKEN.trim().length > 10
  );
  const hasGee = Boolean(
    process.env.GEE_SERVICE_ACCOUNT_JSON && process.env.GEE_SERVICE_ACCOUNT_JSON.trim().length > 10
  );

  // Only NASA POWER has an implemented live retrieval pipeline in this release.
  // Additional Earthdata / GEE adapters never claim "Connected" or "Data available"
  // until an active retrieval pipeline is implemented and verified.
  return [
    {
      id: 'power',
      name: 'NASA POWER (Prediction Of Worldwide Energy Resources)',
      shortName: 'NASA POWER',
      purpose:
        'Daily & climatology agro-meteorology: temperature, rainfall, humidity, solar radiation, and baseline anomalies.',
      status: powerLive ? 'Connected' : 'Temporarily unavailable',
      retrievalImplemented: true,
      credentialsConfigured: true,
      spatialResolution: '0.5° × 0.625° (~55 km MERRA-2 grid)',
      temporalResolution: 'Daily & 25-yr Climatology',
      lastUpdated: powerLastUpdated,
      coverageNote:
        'Regional meteorological grid; does not capture micro-topographic frost pockets or individual plot irrigation.',
      configurationGuide: 'Public API — no key required.',
      isFieldLevel: false
    },
    {
      id: 'smap',
      name: 'NASA SMAP (Soil Moisture Active Passive)',
      shortName: 'SMAP L3/L4',
      purpose: 'Surface (0–5 cm) and root-zone soil moisture anomalies and agricultural water-stress monitoring.',
      status: hasEarthdata ? 'Pipeline unavailable' : 'Authentication required',
      retrievalImplemented: false,
      credentialsConfigured: hasEarthdata,
      spatialResolution: '9 km (Enhanced L3) / 36 km',
      temporalResolution: '2–3 day revisit',
      lastUpdated: null,
      coverageNote:
        'Coarse spatial grid; live granule retrieval is not wired in this build. Moisture balance uses NASA POWER P-ET0 proxy.',
      configurationGuide: hasEarthdata
        ? 'NASA_EARTHDATA_TOKEN is set, but live SMAP CMR/OPeNDAP HDF5 granule ingestion is not implemented in this Node runtime.'
        : 'Requires NASA_EARTHDATA_TOKEN and an Earthdata OPeNDAP/AppEEARS retrieval worker.',
      isFieldLevel: false
    },
    {
      id: 'gpm',
      name: 'NASA GPM IMERG (Global Precipitation Measurement)',
      shortName: 'GPM IMERG',
      purpose: 'High-frequency precipitation monitoring, monsoon onset tracking, and extreme rain events.',
      status: hasEarthdata ? 'Pipeline unavailable' : 'Authentication required',
      retrievalImplemented: false,
      credentialsConfigured: hasEarthdata,
      spatialResolution: '0.1° × 0.1° (~10 km)',
      temporalResolution: 'Half-hourly / Daily',
      lastUpdated: null,
      coverageNote:
        'Sub-district rainfall resolution; live GES DISC IMERG ingestion is not wired in this build (rainfall uses NASA POWER PRECTOTCORR).',
      configurationGuide: hasEarthdata
        ? 'NASA_EARTHDATA_TOKEN is set, but live GES DISC IMERG subsetting is not implemented in this runtime.'
        : 'Requires NASA_EARTHDATA_TOKEN and a GES DISC IMERG retrieval adapter.',
      isFieldLevel: false
    },
    {
      id: 'modis',
      name: 'NASA MODIS (Terra/Aqua Vegetation Indices - MOD13Q1)',
      shortName: 'MODIS NDVI',
      purpose: 'Seasonal vegetation greenness (NDVI / EVI) phenology and bare-field fallow window identification.',
      status: hasEarthdata || hasGee ? 'Pipeline unavailable' : 'Not configured',
      retrievalImplemented: false,
      credentialsConfigured: hasEarthdata || hasGee,
      spatialResolution: '250 m',
      temporalResolution: '16-day composite',
      lastUpdated: null,
      coverageNote:
        '250m pixels suit parcels >= 6 ha; NDVI measures canopy vigor, not soil fertility. Live NDVI extraction is not wired in this build.',
      configurationGuide:
        hasEarthdata || hasGee
          ? 'Credentials detected, but live AppEEARS/GEE NDVI extraction is not implemented in this Node runtime.'
          : 'Requires NASA_EARTHDATA_TOKEN (AppEEARS) or GEE_SERVICE_ACCOUNT_JSON plus raster extraction worker.',
      isFieldLevel: false
    },
    {
      id: 'landsat',
      name: 'NASA / USGS Landsat 8 & 9 Surface Reflectance',
      shortName: 'Landsat 8/9',
      purpose: 'Field-level NDVI, NDWI, and multi-spectral crop cover verification where field size permits.',
      status: hasGee ? 'Pipeline unavailable' : 'Not configured',
      retrievalImplemented: false,
      credentialsConfigured: hasGee,
      spatialResolution: '30 m',
      temporalResolution: '8–16 day revisit (cloud-free)',
      lastUpdated: null,
      coverageNote:
        '30m resolution resolves fields >= 0.5 ha, subject to monsoon clouds. Live Collection-2 reflectance retrieval is not wired.',
      configurationGuide: hasGee
        ? 'GEE_SERVICE_ACCOUNT_JSON is set, but @google/earthengine raster tiling is not implemented in this runtime.'
        : 'Requires GEE_SERVICE_ACCOUNT_JSON and an Earth Engine raster extraction service.',
      isFieldLevel: true
    },
    {
      id: 'ecostress',
      name: 'NASA ECOSTRESS (ISS Thermal & Evapotranspiration)',
      shortName: 'ECOSTRESS',
      purpose: 'Field-scale land surface temperature (LST), evapotranspiration (ET), and thermal water-stress detection.',
      status: hasEarthdata ? 'Pipeline unavailable' : 'Authentication required',
      retrievalImplemented: false,
      credentialsConfigured: hasEarthdata,
      spatialResolution: '70 m',
      temporalResolution: 'Variable ISS overpass (~3–5 days)',
      lastUpdated: null,
      coverageNote:
        '70m thermal footprint; live AppEEARS ECO2LSTE/ECO3ETPTJPL granule polling is not wired in this build.',
      configurationGuide: hasEarthdata
        ? 'NASA_EARTHDATA_TOKEN is set, but async AppEEARS ECOSTRESS task polling is not implemented in this runtime.'
        : 'Requires NASA_EARTHDATA_TOKEN and an async AppEEARS task adapter.',
      isFieldLevel: true
    },
    {
      id: 'grace',
      name: 'NASA GRACE & GRACE-FO Terrestrial Water Storage',
      shortName: 'GRACE-FO',
      purpose: 'Regional multi-year groundwater and terrestrial water storage trends.',
      status: hasEarthdata ? 'Pipeline unavailable' : 'Authentication required',
      retrievalImplemented: false,
      credentialsConfigured: hasEarthdata,
      spatialResolution: '~300 km (Mascon grid)',
      temporalResolution: 'Monthly',
      lastUpdated: null,
      coverageNote:
        'IMPORTANT: GRACE measures basin-scale mass anomalies (~300 km), never individual farm well depth. Live retrieval is not wired.',
      configurationGuide: hasEarthdata
        ? 'NASA_EARTHDATA_TOKEN is set, but JPL Mascon NetCDF extraction is not implemented in this runtime.'
        : 'Requires NASA_EARTHDATA_TOKEN and a JPL Mascon NetCDF adapter.',
      isFieldLevel: false
    },
    {
      id: 'srtm',
      name: 'NASA SRTM (Shuttle Radar Topography Mission)',
      shortName: 'SRTM DEM',
      purpose: 'Digital elevation, field slope gradient, drainage aspect, and runoff/erosion susceptibility.',
      status: hasGee || hasEarthdata ? 'Pipeline unavailable' : 'Not configured',
      retrievalImplemented: false,
      credentialsConfigured: hasGee || hasEarthdata,
      spatialResolution: '30 m (1 arc-second)',
      temporalResolution: 'Static elevation baseline',
      lastUpdated: null,
      coverageNote:
        '30m elevation model provides macro-slope context; live DEM tile sampling is not wired in this build.',
      configurationGuide:
        hasGee || hasEarthdata
          ? 'Credentials detected, but SRTM DEM tile sampling is not implemented in this runtime.'
          : 'Requires GEE_SERVICE_ACCOUNT_JSON or NASA_EARTHDATA_TOKEN plus DEM elevation sampler.',
      isFieldLevel: true
    }
  ];
}
