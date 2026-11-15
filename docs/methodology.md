# Scientific Methodology & Transparency

## 1. Environmental Risk Scoring
The Environmental Risk Engine computes a composite 0–100 index across four transparent pillars:
1. **Thermal & Heat-Wave Stress (24%)**: Combines seasonal mean temperature departure against the 20-year NASA POWER climatology baseline and count of extreme heat days (`Tmax >= 38°C`).
2. **Precipitation Deficit & Variability (26%)**: Evaluates annual rainfall percentage departure from climatology, dry-day frequency (`<1 mm`), and extreme rain events (`>=50 mm/day`).
3. **Water Balance & Irrigation Pressure (28%)**: Approximates atmospheric moisture deficit (`P - ET0` via Hargreaves-calibrated radiation/temperature proxy) alongside farmer-reported irrigation availability and water constraints.
4. **Soil & Monoculture Vulnerability (22%)**: Evaluates lab Soil Organic Carbon (`<0.5%` low threshold), available Nitrogen (`<220 kg/ha`), and continuous cereal-only cropping intensity.

## 2. Crop Suitability (0–100)
Each of the 17 representative crops is evaluated deterministically against:
- Soil compatibility (`28%`): pH range, texture match, drainage class.
- Climate compatibility (`30%`): seasonal mean temperature envelope and terminal heat risk.
- Water compatibility (`27%`): seasonal rainfall + irrigation buffer vs optimal crop water demand, with a Liebig limiting-factor cap when water availability is scarce.
- Nutrient compatibility (`15%`): soil N status vs crop N demand / biological N fixation.

## 3. Multi-Criteria Crop Rotation Scoring
After applying seasonal continuity (`Kharif -> Rabi -> Zaid`), annual duration (`<= 365 days`), and water-availability constraints, strategies are scored across five normalized 0–100 components (`Water Efficiency`, `Climate Resilience`, `Soil Improvement`, `Erosion Protection`, `Market Suitability`) weighted by farmer priority sliders.

## 4. Scientific Caveats
- NASA POWER grid cells are `0.5° x 0.625°` (~55 km) and represent regional weather, not plot-level microclimates.
- MODIS/Landsat NDVI measures canopy greenness, not direct soil fertility or organic carbon.
- GRACE-FO (~300 km) tracks regional terrestrial water storage anomalies, never individual farm well depth.
- Modeled scores are comparative decision-support indicators, not yield guarantees. Always consult local Krishi Vigyan Kendra (KVK) experts.
