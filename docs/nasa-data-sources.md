# NASA Earth Observation Data Sources

Only datasets with an active, verified retrieval pipeline report `Connected` and feed quantitative calculations. Unimplemented satellite pipelines report `Authentication required`, `Not configured`, or `Pipeline unavailable` and never fabricate observations.

| Dataset | Role in AgriShift AI | Spatial Resolution | Pipeline Status | Access Mode |
|---|---|---|---|---|
| **NASA POWER** | Daily T2M, Tmax, Tmin, Precipitation, RH2M, Solar Radiation & 25-yr Climatology (Jan 2001 – Dec 2025) | 0.5° × 0.625° (~55 km) | **Live (`retrievalImplemented: true`)** | Public API (No Key) |
| **SMAP L3/L4** | Surface & root-zone soil moisture anomalies | 9 km / 36 km | **Pipeline unavailable (`retrievalImplemented: false`)** | Reserved (`NASA_EARTHDATA_TOKEN` + CMR/OPeNDAP worker) |
| **GPM IMERG** | High-frequency rainfall & extreme storm events | 0.1° (~10 km) | **Pipeline unavailable (`retrievalImplemented: false`)** | Reserved (`NASA_EARTHDATA_TOKEN` + GES DISC worker) |
| **MODIS MOD13Q1** | 16-day NDVI/EVI vegetation phenology | 250 m | **Pipeline unavailable (`retrievalImplemented: false`)** | Reserved (AppEEARS / GEE worker) |
| **Landsat 8/9** | Field-scale surface reflectance & NDVI | 30 m | **Pipeline unavailable (`retrievalImplemented: false`)** | Reserved (`GEE_SERVICE_ACCOUNT_JSON` + Earth Engine worker) |
| **ECOSTRESS** | Land surface temperature & ET thermal stress | 70 m | **Pipeline unavailable (`retrievalImplemented: false`)** | Reserved (`NASA_EARTHDATA_TOKEN` + async AppEEARS worker) |
| **GRACE / GRACE-FO** | Basin-scale terrestrial water storage trends | ~300 km | **Pipeline unavailable (`retrievalImplemented: false`)** | Reserved (`NASA_EARTHDATA_TOKEN` + JPL Mascon NetCDF worker) |
| **SRTM DEM** | Elevation, slope & runoff susceptibility | 30 m | **Pipeline unavailable (`retrievalImplemented: false`)** | Reserved (GEE / Earthdata DEM worker) |
