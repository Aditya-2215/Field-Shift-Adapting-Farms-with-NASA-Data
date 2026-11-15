# AgriShift AI
### NASA-Powered Agricultural Decision Support | Crop Rotation Intelligence | Environmental Risk Analysis

<p align="center">
  <strong>Adapting Farms with NASA Data</strong><br/>
  An explainable, geospatial agricultural decision-support platform for climate-resilient farming.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Agricultural%20Decision%20Support-2E8B57?style=for-the-badge" alt="Platform"/>
  <img src="https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Backend"/>
  <img src="https://img.shields.io/badge/Frontend-React%20%7C%20TypeScript-3178C6?style=for-the-badge&logo=react&logoColor=white" alt="Frontend"/>
  <img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Geospatial-Leaflet%20%7C%20GeoJSON-7CB342?style=for-the-badge" alt="Geospatial"/>
</p>

---

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Problem Statement](#2-problem-statement)
- [3. Vision and Objectives](#3-vision-and-objectives)
- [4. Core Features](#4-core-features)
- [5. System Architecture](#5-system-architecture)
- [6. Complete Application Workflow](#6-complete-application-workflow)
- [7. NASA and Earth Observation Data](#7-nasa-and-earth-observation-data)
- [8. Geospatial Intelligence](#8-geospatial-intelligence)
- [9. Environmental Risk Assessment](#9-environmental-risk-assessment)
- [10. Intelligent Crop Rotation Engine](#10-intelligent-crop-rotation-engine)
- [11. What-If Simulation Engine](#11-what-if-simulation-engine)
- [12. AI Agricultural Assistant](#12-ai-agricultural-assistant)
- [13. Database Architecture](#13-database-architecture)
- [14. Authentication and Security](#14-authentication-and-security)
- [15. Technology Stack](#15-technology-stack)
- [16. Backend Architecture](#16-backend-architecture)
- [17. API and Integration Design](#17-api-and-integration-design)
- [18. Installation and Local Setup](#18-installation-and-local-setup)
- [19. Environment Variables](#19-environment-variables)
- [20. Database Management](#20-database-management)
- [21. Testing and Quality Assurance](#21-testing-and-quality-assurance)
- [22. Data Reliability and Scientific Explainability](#22-data-reliability-and-scientific-explainability)
- [23. Project Structure](#23-project-structure)
- [24. Development Roadmap](#24-development-roadmap)
- [25. Future Enhancements](#25-future-enhancements)
- [26. Responsible Use and Limitations](#26-responsible-use-and-limitations)
- [27. Contributing](#27-contributing)
- [28. Acknowledgements and Data Sources](#28-acknowledgements-and-data-sources)
- [29. License](#29-license)

---

# 1. Introduction

**AgriShift AI** is a full-stack agricultural decision-support platform developed for the NASA Space Apps Challenge theme:

**Field Shift: Adapting Farms with NASA Data**

The platform helps farmers and agricultural stakeholders understand changing environmental conditions, evaluate field-level constraints, and explore scientifically informed crop rotation strategies.

Agriculture is increasingly affected by unpredictable rainfall, soil degradation, temperature variations, water scarcity, and changing growing conditions. Traditional crop planning often depends on historical practices and fragmented environmental information.

AgriShift AI aims to bridge this gap by combining:

- NASA Earth observation and environmental datasets.
- Geospatial farm mapping and boundary analysis.
- Soil and crop knowledge profiles.
- Environmental risk assessment.
- Multi-criteria crop suitability analysis.
- Explainable crop rotation recommendations.
- Interactive scenario simulation.
- AI-assisted agricultural insights.

Rather than producing unexplained crop predictions, AgriShift AI focuses on **transparent recommendations**: farmers should be able to understand what the system recommends, why it recommends it, which environmental factors influenced the decision, and what uncertainties remain.

## 1.1 Project Philosophy

> Better environmental intelligence leads to better agricultural decisions.

AgriShift AI is designed around five principles:

1. **Data-driven:** Use real environmental observations and traceable agricultural information.
2. **Location-aware:** Analyze the selected farm rather than relying on generic regional assumptions.
3. **Explainable:** Show the factors influencing recommendations.
4. **Farmer-centric:** Allow farmer preferences and practical constraints to influence planning.
5. **Persistent and secure:** Maintain user data through a relational database with strict ownership isolation.

---

# 2. Problem Statement

Farmers face several interconnected challenges when selecting crops and planning rotations.

| Challenge | Agricultural impact | AgriShift AI approach |
|---|---|---|
| Unpredictable rainfall | Planting uncertainty and water stress | Historical and recent precipitation analysis |
| Soil degradation | Declining productivity | Soil profile and rotation analysis |
| Water scarcity | Irrigation constraints | Soil moisture and rainfall indicators |
| Temperature extremes | Crop stress and yield risks | Temperature and heat-stress assessment |
| Fragmented datasets | Difficult decision-making | Unified environmental intelligence |
| Repeated monocropping | Soil nutrient imbalance and pest pressure | Multi-season rotation planning |
| Unexplained recommendations | Low trust and adoption | Explainable scoring and evidence |

## 2.1 The Core Question

AgriShift AI attempts to answer:

**Given a farm's location, soil characteristics, environmental conditions, historical cropping patterns, and farmer priorities, which crop rotation strategies are worth considering for upcoming seasons?**

The application provides decision support rather than guaranteed yield predictions or agricultural prescriptions.

---

# 3. Vision and Objectives

## Vision

Build an accessible agricultural intelligence platform that connects Earth observation data with practical crop planning.

## Primary Objectives

- Enable farmers to register and map their agricultural parcels.
- Retrieve relevant environmental observations for selected farm locations.
- Analyze soil, water, climate, and terrain constraints.
- Assess the suitability of candidate crops.
- Generate explainable multi-season rotation strategies.
- Allow farmers to adjust assumptions and compare scenarios.
- Produce reports containing recommendations, supporting evidence, and data provenance.

## Intended Users

- Farmers and farm managers.
- Agricultural students and researchers.
- Agronomists and agricultural consultants.
- Climate-resilience organizations.
- Agricultural technology developers.
- Decision-makers working with agricultural and environmental data.

---

# 4. Core Features

## 4.1 Farm Management

Users can create and manage multiple agricultural parcels.

Capabilities:

- Create, edit, and delete owned farms.
- Store farm name, location, area, irrigation details, and water availability.
- Select a location using browser GPS.
- Search using an address or place name.
- Select a farm location using an interactive Leaflet map.
- Move a marker to refine coordinates.
- Draw and edit farm boundaries.
- Calculate farm area from polygon geometry.
- Save GeoJSON boundaries.
- Maintain separate soil profiles and crop histories.

## 4.2 Environmental Intelligence

Environmental observations are associated with the selected farm and observation period.

Potential data categories:

- Temperature.
- Precipitation.
- Humidity.
- Solar radiation.
- Soil moisture.
- Vegetation indices.
- Elevation.
- Terrain slope.
- Drought indicators.

Each observation should retain its original source, measurement units, temporal coverage, and spatial resolution.

## 4.3 Crop Knowledge Database

AgriShift AI includes 17 curated crop knowledge profiles intended to support agricultural suitability analysis.

Crop attributes can include:

- Crop category.
- Growing season.
- Temperature requirements.
- Soil pH tolerance.
- Water requirements.
- Soil nutrient requirements.
- Drainage requirements.
- Nitrogen fixation characteristics.
- Root characteristics.
- Rotation compatibility.
- Ecological considerations.

The knowledge base is designed to be extensible as additional crop profiles and verified agronomic references are incorporated.

## 4.4 Crop Suitability Analysis

Evaluate candidate crops using available environmental and soil information.

Example evaluation dimensions:

- Climate compatibility.
- Soil compatibility.
- Water availability.
- Growing-season compatibility.
- Terrain constraints.
- Farmer preferences.

The result should include a suitability score, contributing factors, and data-quality warnings.

## 4.5 Crop Rotation Planning

Generate and compare multi-season crop sequences.

Example:

| Season | Example crop | Intended consideration |
|---|---|---|
| Kharif | Rice | Water availability and seasonal rainfall |
| Rabi | Wheat | Temperature and residual soil conditions |
| Zaid | Green gram | Short-duration crop and soil improvement potential |

This is an illustrative sequence, not a universal recommendation. Actual suitability depends on location, irrigation, soil, variety, and local agronomic practices.

## 4.6 Interactive What-If Simulator

Users can modify selected assumptions and compare outcomes.

Examples:

- What happens if rainfall decreases?
- What happens if water availability improves?
- How does a change in soil pH affect crop suitability?
- What happens if the farmer prioritizes soil health over market considerations?
- How does a different crop sequence affect the overall rotation score?

## 4.7 AI Agricultural Assistant

The AI assistant provides contextual explanations using available farm and assessment information.

Potential capabilities:

- Explain environmental risk indicators.
- Describe crop suitability results.
- Explain rotation strategies.
- Summarize changes between scenarios.
- Answer questions about available farm records.

AI-generated content should be grounded in available application data and should not invent observations or present unsupported claims as scientific findings.

## 4.8 Reports and Notifications

The reporting module is designed to generate PDF decision-support reports containing:

- Farm profile.
- Soil characteristics.
- Environmental summary.
- Risk assessment.
- Crop suitability results.
- Rotation alternatives.
- Recommendation explanations.
- Data sources and observation dates.
- Important limitations and uncertainty.

Notifications can communicate relevant farm advisories and system events.

---

# 5. System Architecture

AgriShift AI uses a layered architecture that separates the user interface, application services, data persistence, and external data providers.

## 5.1 High-Level Architecture

```mermaid
flowchart TB
    U["Farmer / Researcher"]
    FE["React + TypeScript Frontend"]
    API["Express + TypeScript Backend"]
    AUTH["Authentication & Authorization"]
    FARM["Farm Management"]
    GEO["Geospatial Services"]
    ENV["Environmental Data Services"]
    RISK["Risk Assessment Engine"]
    ROT["Crop Rotation Engine"]
    AI["AI Assistant"]
    REPORT["Reporting Service"]
    DB[("PostgreSQL + Prisma")]
    NASA["NASA Data Providers"]
    USGS["USGS Data Providers"]
    GEE["Google Earth Engine"]
    GEM["Gemini API"]

    U --> FE
    FE --> API
    API --> AUTH
    API --> FARM
    API --> GEO
    API --> ENV
    API --> RISK
    API --> ROT
    API --> AI
    API --> REPORT

    AUTH --> DB
    FARM --> DB
    GEO --> DB
    ENV --> NASA
    ENV --> USGS
    ENV --> GEE
    ENV --> DB

    RISK --> DB
    ROT --> DB
    AI --> GEM
    AI --> DB
    REPORT --> DB
```

**Integration note:** NASA, USGS, and Earth Engine are provider integrations, not a single unified API. Each provider requires its own access method, product selection, and validation. A provider should be shown as operational only after successful real-data retrieval.

## 5.2 Architectural Layers

| Layer | Responsibility |
|---|---|
| Presentation | User interface, maps, dashboards, visualizations |
| API | Request validation, routing, response handling |
| Authentication | Identity, sessions, token rotation, permissions |
| Business logic | Farm management, risk analysis, crop planning |
| Geospatial | Coordinates, GeoJSON, spatial calculations |
| Data integration | NASA, USGS, Earth Engine, and other providers |
| Persistence | PostgreSQL and Prisma |
| AI | Contextual explanation and conversational assistance |
| Reporting | PDF generation and report metadata |

---

# 6. Complete Application Workflow

## 6.1 End-to-End User Workflow

```mermaid
flowchart TD
    A["User opens AgriShift AI"]
    B["Register or Sign In"]
    C["Create Farm Profile"]
    D["Select Farm Location"]
    E["Define Farm Boundary"]
    F["Add Soil Profile"]
    G["Add Crop History"]
    H["Retrieve Environmental Data"]
    I["Validate and Process Observations"]
    J["Calculate Environmental Risks"]
    K["Evaluate Candidate Crops"]
    L["Generate Rotation Strategies"]
    M["Explore What-If Scenarios"]
    N["Review Explainable Results"]
    O["Generate and Save Report"]

    A --> B --> C --> D --> E --> F --> G --> H
    H --> I --> J --> K --> L --> M --> N --> O
```

## 6.2 Detailed Workflow Explanation

**Step 1 — Authentication**

A user registers using email and password or optionally signs in through Google.

**Step 2 — Farm Registration**

The user creates a farm profile containing its name, location, area, irrigation type, and available water information.

**Step 3 — Geospatial Mapping**

The user selects coordinates and draws a farm boundary. The application validates the polygon and calculates its area.

**Step 4 — Agricultural Profile**

The user enters available soil characteristics and previous crop history.

**Step 5 — Environmental Data Retrieval**

The backend requests relevant observations from configured data providers.

**Step 6 — Data Validation**

The system validates observation dates, units, quality indicators, missing values, and spatial coverage.

**Step 7 — Risk Assessment**

The environmental assessment engine calculates risk indicators and records the methodology used.

**Step 8 — Crop Suitability**

Candidate crops are evaluated against available climate, soil, water, and seasonal requirements.

**Step 9 — Rotation Generation**

The rotation engine generates alternative crop sequences and scores them against configured criteria.

**Step 10 — Scenario Comparison**

Users modify assumptions and compare how their decisions affect the results.

**Step 11 — Reporting**

The system saves the selected results and generates a shareable decision-support report.

---

# 7. NASA and Earth Observation Data

Earth observation data is an important component of AgriShift AI.

The platform is designed to integrate multiple environmental datasets because no single satellite product provides every variable required for agricultural planning.

## 7.1 NASA SMAP — Soil Moisture

**Source:** https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap

SMAP (Soil Moisture Active Passive) provides satellite-based soil-moisture information.

Potential agricultural applications:

- Monitor surface soil moisture.
- Assess root-zone soil moisture using suitable derived products.
- Identify changing moisture conditions.
- Support water-stress analysis.
- Complement precipitation information.

Example derived indicator:

```text
Soil Moisture Status =
    Current Soil Moisture
    compared with
    Historical Seasonal Baseline
```

A deviation from the seasonal baseline can help identify unusually dry or wet conditions.

**Important:** SMAP products have different spatial resolutions, temporal frequencies, and retrieval methods. The application must identify the exact product used rather than describing all SMAP observations as field-level measurements.

## 7.2 NASA GPM — Precipitation

**Source:** https://gpm.nasa.gov/data

GPM (Global Precipitation Measurement) provides precipitation observations and estimates.

Potential applications:

- Daily rainfall summaries.
- Monthly precipitation aggregation.
- Seasonal rainfall analysis.
- Rainfall anomaly estimation.
- Drought and excessive-rainfall indicators.

Example:

```text
Seasonal Rainfall Anomaly (%) =
    ((Observed Rainfall - Historical Average)
    / Historical Average) * 100
```

The historical comparison must use compatible periods and a clearly defined baseline.

## 7.3 Landsat 8 and Landsat 9

**Source:** https://earthexplorer.usgs.gov/

Landsat imagery supports land-surface and vegetation analysis.

Potential applications:

- Vegetation monitoring.
- Land-cover analysis.
- Surface reflectance analysis.
- Seasonal vegetation trends.
- NDVI calculation.

Normalized Difference Vegetation Index:

```text
NDVI = (NIR - Red) / (NIR + Red)
```

NDVI is an indicator of vegetation greenness. It is not a direct measurement of crop yield, plant health, or soil fertility.

Landsat surface-reflectance products require appropriate quality masking and cloud filtering before index calculation.

## 7.4 MODIS — Vegetation Monitoring

MODIS can complement Landsat through more frequent observations.

Potential applications:

- NDVI and EVI time series.
- Seasonal vegetation trends.
- Regional vegetation monitoring.
- Crop growth pattern analysis.

MODIS and Landsat have different spatial and temporal characteristics. Their observations should not be treated as interchangeable.

## 7.5 SRTM — Elevation and Terrain

SRTM elevation data can support:

- Elevation analysis.
- Terrain visualization.
- Slope estimation.
- Drainage-related terrain indicators.
- Topographic constraints for crop planning.

Elevation and slope are supporting environmental factors, not direct measures of soil quality or drainage performance.

## 7.6 Dataset Comparison

| Data source | Primary variable | Potential use |
|---|---|---|
| SMAP | Soil moisture | Water stress |
| GPM | Precipitation | Rainfall analysis |
| Landsat | Surface reflectance | Vegetation indices |
| MODIS | Vegetation indices | Seasonal monitoring |
| SRTM | Elevation | Terrain analysis |
| NASA POWER | Meteorological variables | Climate assessment |

### Data Integration Strategy

AgriShift AI can use Google Earth Engine as a geospatial processing layer for supported collections, while direct NASA Earthdata and USGS integrations can be used where product access or processing requirements justify them.

Avoid retrieving and processing the same product through multiple providers without a clear reason.

---

# 8. Geospatial Intelligence

Farm location is central to the application's data pipeline.

A farm's environmental profile must be linked to its actual selected coordinates and boundary.

## 8.1 Location Selection

Three supported interaction methods are intended:

1. Browser GPS with explicit user permission.
2. Address search and geocoding.
3. Interactive map selection using Leaflet.

## 8.2 Farm Boundary Representation

Farm boundaries are represented using GeoJSON Polygon or MultiPolygon geometry.

Example:

```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [80.90, 26.90],
      [80.91, 26.90],
      [80.91, 26.91],
      [80.90, 26.91],
      [80.90, 26.90]
    ]
  ]
}
```

Coordinates follow the GeoJSON order:

```text
[longitude, latitude]
```

## 8.3 Geospatial Processing Flow

```mermaid
flowchart TD
    A["Farm GPS / Address / Map Selection"]
    B["Validate Coordinates"]
    C["Create or Edit Farm Polygon"]
    D["Validate GeoJSON Geometry"]
    E["Calculate Area"]
    F["Save Location and Boundary"]
    G["Query Environmental Providers"]
    H["Intersect Observations with Farm Area"]
    I["Aggregate Available Data"]
    J["Store Results and Provenance"]

    A --> B --> C --> D --> E --> F
    F --> G --> H --> I --> J
```

## 8.4 Spatial Calculations

Potential operations:

- Polygon validation.
- Polygon area calculation.
- Point-in-polygon checks.
- Bounding-box generation.
- Spatial intersection.
- Raster clipping and zonal statistics.

Turf.js can perform several client-side and server-side GeoJSON calculations.

For advanced spatial indexing and database-level operations, PostGIS is an optional extension.

## 8.5 Resolution Awareness

GPS accuracy and satellite spatial resolution are different concepts.

For example, a GPS receiver may locate a farm marker within several meters, while a satellite product may represent a grid cell covering several square kilometres.

Therefore, the application must not imply that a coarse-resolution environmental dataset measures conditions at every individual field location.

---

# 9. Environmental Risk Assessment

The Environmental Risk Assessment Engine translates environmental observations into interpretable agricultural indicators.

## 9.1 Risk Categories

| Category | Example indicators | Agricultural relevance |
|---|---|---|
| Water risk | Soil moisture, precipitation anomaly | Irrigation and water stress |
| Temperature risk | Mean temperature, heat extremes | Crop heat tolerance |
| Rainfall risk | Rainfall deficit, extreme precipitation | Seasonal water availability |
| Vegetation risk | NDVI/EVI trends | Vegetation condition |
| Terrain risk | Slope and elevation | Topographic constraints |
| Soil risk | pH, nutrients, organic carbon | Soil suitability |

## 9.2 Risk Assessment Workflow

```mermaid
flowchart TD
    A["Environmental Observations"]
    B["Data Quality Validation"]
    C["Normalize Units and Time Periods"]
    D["Calculate Derived Indicators"]
    E["Compare Against Relevant Baselines"]
    F["Evaluate Crop-Specific Thresholds"]
    G["Calculate Risk Scores"]
    H["Assign Risk Categories"]
    I["Save Assessment Snapshot"]
    J["Display Evidence and Uncertainty"]

    A --> B --> C --> D --> E --> F --> G --> H --> I --> J
```

## 9.3 Example Risk Classification

| Score range | Illustrative category |
|---|---|
| 0–20 | Low |
| 21–40 | Moderate |
| 41–60 | Elevated |
| 61–80 | High |
| 81–100 | Very High |

These are illustrative application thresholds. They must be calibrated and validated against appropriate agronomic references before being presented as scientifically established thresholds.

## 9.4 Explainable Assessment

Every assessment should ideally contain:

- Risk category.
- Numerical score.
- Contributing observations.
- Applicable threshold or baseline.
- Source dataset.
- Observation date.
- Missing-data information.
- Confidence or uncertainty information.
- Assessment methodology version.

This makes the result auditable and easier to interpret.

---

# 10. Intelligent Crop Rotation Engine

The Crop Rotation Engine is one of AgriShift AI's central decision-support components.

It combines crop knowledge, environmental observations, soil characteristics, seasonal constraints, crop history, and farmer priorities.

## 10.1 Inputs

| Input | Description |
|---|---|
| Soil profile | pH, N, P, K, organic carbon, texture |
| Climate | Temperature, rainfall, humidity |
| Water availability | Irrigation and moisture indicators |
| Season | Kharif, Rabi, or Zaid |
| Crop history | Previously cultivated crops |
| Crop knowledge | Crop-specific growing requirements |
| Farmer preferences | Water, soil, climate, market, erosion |
| Farm constraints | Area, terrain, water access |

## 10.2 Rotation Generation Workflow

```mermaid
flowchart TD
    A["Farm and Soil Profile"]
    B["Environmental Risk Snapshot"]
    C["Crop Knowledge Database"]
    D["Farmer Preferences"]
    E["Historical Crop Sequence"]
    F["Candidate Crop Selection"]
    G["Agronomic Constraint Filtering"]
    H["Crop Suitability Scoring"]
    I["Rotation Sequence Generation"]
    J["Sequence Compatibility Analysis"]
    K["Rank Alternative Strategies"]
    L["Explain Recommendations"]

    A --> F
    B --> F
    C --> F
    D --> H
    E --> I
    F --> G --> H --> I --> J --> K --> L
```

## 10.3 Multi-Criteria Decision Analysis

A possible scoring framework:

```text
Crop Suitability Score =
    (Climate Compatibility × W1)
  + (Soil Compatibility × W2)
  + (Water Compatibility × W3)
  + (Season Compatibility × W4)
  + (Farmer Preference × W5)
```

Where:

- W1 = Climate weight.
- W2 = Soil weight.
- W3 = Water weight.
- W4 = Seasonal weight.
- W5 = Farmer preference weight.

Weights should be configurable and normalized.

The score should be calculated only from available, validated inputs. Missing information should not silently receive an artificially favourable score.

## 10.4 Rotation-Specific Considerations

A multi-season rotation strategy should consider more than the suitability of individual crops.

Potential rotation factors:

- Crop-family diversity.
- Legume inclusion and nitrogen fixation potential.
- Nutrient demand across consecutive seasons.
- Root-depth diversity.
- Water demand across the rotation.
- Pest and disease break considerations.
- Crop history.
- Seasonal feasibility.
- Irrigation constraints.
- Local agronomic practices.

## 10.5 Explainable Recommendations

Example output:

```text
Recommended candidate: Green Gram

Reasons:
- Potential suitability for the selected growing season.
- Legume characteristics may support soil fertility objectives.
- Short-duration cropping may fit the selected seasonal window.

Considerations:
- Confirm local variety suitability.
- Validate water availability.
- Review previous crop and disease history.
- Confirm market and sowing-date feasibility.

Evidence:
- Farm soil profile.
- Seasonal climate observations.
- Crop knowledge profile.
- Farmer preferences.
```

The example illustrates explanation structure, not a verified recommendation for every farm.

---

# 11. What-If Simulation Engine

The What-If Simulator allows farmers to explore alternative environmental conditions and planning priorities without modifying their original farm records.

## 11.1 Example Scenarios

| Scenario | Variable changed | Question |
|---|---|---|
| Reduced rainfall | Precipitation | Which crops remain suitable? |
| Improved irrigation | Water availability | How does suitability change? |
| Higher temperature | Temperature | Which crops are more resilient? |
| Soil improvement | Soil pH or nutrients | Which new candidates become feasible? |
| Farmer priority | Decision weights | How does the ranking change? |

## 11.2 Simulation Flow

```mermaid
flowchart TD
    A["Load Existing Farm Assessment"]
    B["Create Scenario Copy"]
    C["Modify Selected Parameters"]
    D["Validate Scenario Inputs"]
    E["Recalculate Environmental Indicators"]
    F["Recalculate Crop Suitability"]
    G["Regenerate Rotation Options"]
    H["Compare with Baseline"]
    I["Display Differences"]
    J["Save Scenario if Requested"]

    A --> B --> C --> D --> E --> F --> G --> H --> I --> J
```

## 11.3 Baseline vs Scenario

The simulator should clearly distinguish:

- Original observed data.
- User-modified assumptions.
- Derived estimates.
- Simulated outcomes.

A scenario must never overwrite the original environmental observation record.

---

# 12. AI Agricultural Assistant

AgriShift AI uses Gemini as an optional conversational assistant.

## 12.1 Context-Aware Interaction

The assistant can use authorized application context such as:

- Selected farm profile.
- Soil characteristics.
- Environmental assessment.
- Crop suitability results.
- Rotation scenarios.
- Available data sources.

## 12.2 AI Interaction Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as React Frontend
    participant API as Express Backend
    participant DB as PostgreSQL
    participant AI as Gemini API

    User->>UI: Ask agricultural question
    UI->>API: Submit question and farm context ID
    API->>API: Authenticate and authorize user
    API->>DB: Retrieve authorized farm context
    DB-->>API: Farm and assessment data
    API->>AI: Send grounded context and question
    AI-->>API: Generate response
    API->>DB: Persist conversation and response
    API-->>UI: Return assistant response
    UI-->>User: Display explanation
```

## 12.3 AI Safety and Reliability

- Never expose the Gemini API key in frontend code.
- Never allow the model to access another user's farm information.
- Distinguish measured observations from estimates.
- Avoid fabricating scientific citations or environmental measurements.
- Communicate uncertainty and missing information.
- Present recommendations as decision support, not guaranteed outcomes.

---

# 13. Database Architecture

AgriShift AI has migrated from Firebase/Firestore to PostgreSQL with Prisma ORM.

The relational model supports durable storage, referential integrity, ownership enforcement, and chronological analysis.

## 13.1 Database Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ OAUTH_ACCOUNTS : links
    USERS ||--o{ REFRESH_TOKENS : owns
    USERS ||--o{ PASSWORD_RESET_TOKENS : requests
    USERS ||--o{ FARMS : manages
    USERS ||--o{ FARMER_PREFERENCES : configures
    USERS ||--o{ AI_CONVERSATIONS : starts
    USERS ||--o{ REPORTS : generates
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDIT_LOGS : creates

    FARMS ||--o| SOIL_PROFILES : has
    FARMS ||--o{ CROP_HISTORY : records
    FARMS ||--o{ ENVIRONMENTAL_OBSERVATIONS : collects
    FARMS ||--o{ ENVIRONMENTAL_ASSESSMENTS : evaluates
    FARMS ||--o{ ROTATION_SCENARIOS : plans
    FARMS ||--o{ AI_CONVERSATIONS : contextualizes

    AI_CONVERSATIONS ||--o{ AI_MESSAGES : contains
    CROP_KNOWLEDGE ||--o{ ROTATION_SCENARIOS : informs
```

The diagram shows conceptual relationships. Actual foreign keys and cardinalities should be checked against the current Prisma schema.

## 13.2 Database Tables

| No. | Table | Responsibility |
|---:|---|---|
| 1 | `users` | User identity and profile |
| 2 | `oauth_accounts` | External authentication accounts |
| 3 | `refresh_tokens` | Hashed refresh-token sessions |
| 4 | `password_reset_tokens` | One-time password reset records |
| 5 | `farms` | Farm location, boundary, and management details |
| 6 | `soil_profiles` | Soil characteristics |
| 7 | `crop_history` | Historical crop records |
| 8 | `environmental_observations` | Environmental time-series data |
| 9 | `environmental_assessments` | Risk assessment snapshots |
| 10 | `crop_knowledge` | Crop agronomic profiles |
| 11 | `farmer_preferences` | Decision criteria and weights |
| 12 | `rotation_scenarios` | Generated rotation plans |
| 13 | `ai_conversations` | AI conversation sessions |
| 14 | `ai_messages` | Conversation messages |
| 15 | `reports` | Report metadata and generated files |
| 16 | `notifications` | Advisory and system notifications |
| 17 | `audit_logs` | Security and activity audit trail |

## 13.3 Persistence Strategy

- UUID primary keys.
- Foreign-key constraints.
- Composite uniqueness constraints where applicable.
- Indexes for ownership and chronological queries.
- JSONB for flexible GeoJSON and structured metadata.
- Explicit timestamps for observations and records.
- Cascading deletion where appropriate.
- User-scoped repository operations.

## 13.4 Optional PostGIS

PostgreSQL can be extended with PostGIS for native geometric operations and spatial indexing.

Example:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

PostGIS is an optional enhancement. The default architecture uses validated GeoJSON stored in PostgreSQL JSONB columns.

---

# 14. Authentication and Security

AgriShift AI uses native JWT authentication with optional Google OAuth 2.0.

## 14.1 Email and Password Authentication

- Passwords are hashed using bcrypt with 12 salt rounds.
- Access tokens have a 15-minute lifetime.
- Refresh tokens have a 7-day lifetime.
- Access tokens are maintained in frontend memory.
- Refresh tokens are stored as SHA-256 hashes in PostgreSQL.
- Refresh tokens are delivered through HttpOnly cookies.
- Token rotation is performed during refresh.
- Reuse detection supports session revocation.
- Logout and device/session revocation are supported.

## 14.2 Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as React Frontend
    participant API as Express API
    participant DB as PostgreSQL

    User->>UI: Submit email and password
    UI->>API: POST login request
    API->>API: Validate credentials
    API->>DB: Retrieve user record
    DB-->>API: Password hash and account data
    API->>API: Verify bcrypt hash
    API->>API: Generate access and refresh tokens
    API->>DB: Store SHA-256 refresh-token hash
    API-->>UI: Access token + HttpOnly cookie
    UI->>API: Authenticated API request
    API->>API: Verify access JWT
    API-->>UI: Authorized response
```

## 14.3 Google OAuth

Google Sign-In is an optional secondary authentication method.

The backend verifies Google ID tokens and checks the verified email claim before account linking.

Unverified Google email identities must not be allowed to claim an existing account.

## 14.4 Security Principles

- Server-side secret management.
- Strict user ownership checks.
- Password hashing.
- Short-lived access tokens.
- Refresh-token rotation.
- Session revocation.
- Input validation.
- CORS restrictions.
- Audit logging.
- Secure cookie configuration.
- Protection against cross-user data access.

Production deployments must additionally review CSRF protections, cookie behavior, HTTPS, rate limiting, password-reset abuse, and security headers.

---

# 15. Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React | User interface |
| Language | TypeScript | Type safety |
| Build tool | Vite | Development and production builds |
| Styling | Tailwind CSS | Responsive interface |
| Charts | Recharts | Environmental visualizations |
| Maps | Leaflet | Interactive geospatial maps |
| Geospatial utilities | Turf.js | GeoJSON calculations |
| Backend | Node.js | Server runtime |
| API framework | Express.js | REST API |
| Database | PostgreSQL | Persistent relational storage |
| ORM | Prisma | Database access and migrations |
| Authentication | JWT | Access authorization |
| Password hashing | bcryptjs | Password security |
| OAuth | Google OAuth 2.0 | Optional external sign-in |
| AI | Gemini API | Conversational agricultural assistance |
| Earth observation | NASA / USGS / GEE | Environmental data |
| Testing | Project test suite | Automated verification |
| PDF | Reporting service | Decision-support documents |

---

# 16. Backend Architecture

The backend follows a modular service-oriented structure.

Conceptual request lifecycle:

```mermaid
flowchart TD
    A["HTTP Request"]
    B["Express Router"]
    C["Authentication Middleware"]
    D["Authorization and Ownership Check"]
    E["Request Validation"]
    F["Controller"]
    G["Business Service"]
    H["Repository / Prisma"]
    I[("PostgreSQL")]
    J["Response Formatter"]

    A --> B --> C --> D --> E --> F --> G --> H --> I
    I --> H --> G --> J
```

## 16.1 Responsibility Separation

**Routes:** Define endpoint paths and middleware.

**Middleware:** Handle authentication, validation, and access restrictions.

**Controllers:** Translate HTTP requests into service operations.

**Services:** Implement application business logic.

**Repositories:** Perform database operations through Prisma.

**Providers:** Integrate external APIs such as NASA, USGS, and Gemini.

This separation makes individual components easier to test, maintain, and extend.

---

# 17. API and Integration Design

The backend exposes API endpoints for application modules.

The following are documented integration patterns; exact paths should match the implemented route files.

## 17.1 Authentication

Authentication operations include:

- Registration.
- Login.
- Refresh.
- Logout.
- Logout all sessions.
- Password change.
- Password reset.
- Google authentication.

## 17.2 Geospatial Services

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/geospatial/geocode?q=` | Search an address |
| GET | `/api/geospatial/reverse-geocode?lat=&lon=` | Resolve coordinates |
| GET | `/api/geospatial/elevation?lat=&lon=` | Retrieve elevation |
| PATCH/PUT | `/api/farms/:id/location` | Update farm location |
| PATCH/PUT | `/api/farms/:id/boundary` | Update farm boundary |

## 17.3 Environmental Services

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/environmental/observations?farmId=` | Retrieve farm observations |

Additional endpoints for provider-specific observations, risk assessments, crop suitability, and rotation scenarios should follow the same authorization and validation conventions.

## 17.4 Provider Integration Requirements

Each external data provider should have:

- A separate adapter.
- Server-side credentials.
- Request validation.
- Timeouts and retry policies.
- Rate-limit handling.
- Caching where appropriate.
- Product and collection identification.
- Data-quality checks.
- Provenance metadata.
- Clear unavailable-data responses.

An API endpoint must not return hardcoded sample observations while presenting them as live NASA data.

---

# 18. Installation and Local Setup

## 18.1 Prerequisites

Install:

- Node.js 20 or later.
- npm.
- PostgreSQL 14 or later.
- Git.
- A code editor such as Visual Studio Code.

Confirm installations:

```bash
node --version
npm --version
psql --version
git --version
```

## 18.2 Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/agrishift-ai.git

cd agrishift-ai
```

Replace `YOUR_USERNAME` with the actual GitHub username or organization.

## 18.3 Install Dependencies

```bash
npm install
```

## 18.4 Configure Environment Variables

Create a local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure the required values.

## 18.5 Create PostgreSQL Database

Open pgAdmin or PostgreSQL shell and create:

```sql
CREATE DATABASE agrishift_db;
```

Ensure PostgreSQL is running and the configured port matches the local server.

## 18.6 Generate Prisma Client

```bash
npx prisma generate
```

## 18.7 Run Database Migrations

```bash
npm run db:migrate
```

## 18.8 Seed the Database

```bash
npm run db:seed
```

The seed operation initializes the curated crop knowledge profiles and demo farm/soil data.

## 18.9 Run Quality Checks

```bash
npm run lint
npm run test
npm run build
```

## 18.10 Start Development Server

```bash
npm run dev
```

The development application is configured to serve the frontend and Express API through:

```text
http://localhost:3000
```

Verify the actual port and scripts in `package.json` if your local configuration differs.

---

# 19. Environment Variables

Example configuration:

```env
# Application
NODE_ENV=development
APP_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/agrishift_db"

# JWT
JWT_ACCESS_SECRET="your_secure_access_secret"
JWT_REFRESH_SECRET="your_secure_refresh_secret"

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback"

# Gemini (optional)
GEMINI_API_KEY=""

# Google Earth Engine (optional)
GEE_PROJECT_ID=""
GEE_SERVICE_ACCOUNT_JSON=""
```

### Environment Security

- Never commit `.env` to GitHub.
- Never expose private keys in frontend variables.
- Use strong, independently generated JWT secrets.
- Use a secrets manager in production.
- Prefer Google Cloud Application Default Credentials when deploying on supported Google Cloud infrastructure.
- If service-account JSON is used, store it securely as a deployment secret or protected file.
- Never log private-key material or full credentials.

`GEE_SERVICE_ACCOUNT_JSON` is only required if the configured Earth Engine authentication implementation uses a service-account JSON credential. Confirm the required format in the backend provider adapter.

---

# 20. Database Management

Useful Prisma commands:

```bash
# Generate Prisma client
npx prisma generate

# Create/apply migrations in development
npm run db:migrate

# Seed database
npm run db:seed

# Inspect database visually
npx prisma studio

# Validate Prisma schema
npx prisma validate
```

## 20.1 Database Migration Principles

- Never remove production data to solve a migration issue.
- Back up the database before destructive schema changes.
- Review migration SQL before applying it.
- Keep schema and migrations in version control.
- Validate data ownership after migrations.
- Test both fresh database setup and existing database upgrades.

---

# 21. Testing and Quality Assurance

Testing should cover business logic, data persistence, authorization, external integrations, and end-to-end workflows.

## 21.1 Test Categories

| Test category | What it verifies |
|---|---|
| Authentication | Registration, login, token rotation |
| Security | Token reuse and access control |
| Database | Persistence and relational integrity |
| Ownership | Cross-user data isolation |
| Geospatial | Coordinates and polygon validation |
| Environmental | Data validation and calculations |
| Agronomy | Crop suitability and rotation logic |
| Simulation | Scenario changes and comparisons |
| Reporting | Report generation and metadata |
| Integration | External provider failure handling |

## 21.2 Core End-to-End Scenario

```mermaid
flowchart TD
    A["Register User"]
    B["Authenticate"]
    C["Create Farm"]
    D["Save Soil Profile"]
    E["Add Crop History"]
    F["Retrieve Environmental Observations"]
    G["Generate Assessment"]
    H["Generate Rotation"]
    I["Create Report"]
    J["Verify PostgreSQL Persistence"]
    K["Verify User Isolation"]

    A --> B --> C --> D --> E --> F --> G --> H --> I --> J --> K
```

## 21.3 Quality Gates

Before merging a major change:

```bash
npm run lint
npm run test
npm run build
```

External integrations should additionally be tested against actual provider responses, not only mocked unit tests.

---

# 22. Data Reliability and Scientific Explainability

Scientific reliability is essential for an agricultural decision-support system.

AgriShift AI should retain enough metadata to trace a displayed result back to its source.

## 22.1 Recommended Observation Metadata

| Field | Purpose |
|---|---|
| Provider | NASA, USGS, or other source |
| Dataset | Exact product or collection |
| Product version | Data version |
| Observation time | Date/time represented |
| Retrieval time | When the application fetched it |
| Coordinates/boundary | Spatial reference |
| Resolution | Native spatial resolution |
| Units | Measurement units |
| Quality flag | Source quality information |
| Processing method | Transformation or aggregation |
| Missing-data status | Completeness |
| Uncertainty | Known limitations |

## 22.2 Observation Processing Principles

1. Preserve original provider values when practical.
2. Convert units explicitly.
3. Avoid mixing incompatible temporal periods.
4. Apply quality and cloud masks where relevant.
5. Record the product's spatial resolution.
6. Distinguish observations from derived indicators.
7. Retain the calculation methodology.
8. Clearly mark missing or unavailable data.

## 22.3 Observed, Derived, and Simulated Data

| Data type | Meaning | Example |
|---|---|---|
| Observed | Retrieved from a data provider | Satellite precipitation estimate |
| Derived | Calculated from observations | Seasonal rainfall anomaly |
| Simulated | Generated by a scenario | Rainfall reduced by 15% |
| Reference | Curated background knowledge | Crop growing requirements |

These categories must remain distinguishable throughout the interface and reports.

---

# 23. Project Structure

The following is a conceptual organization. Keep it aligned with the actual repository structure rather than renaming existing working files unnecessarily.

```text
agrishift-ai/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── features/
│   │   │   ├── authentication/
│   │   │   ├── farms/
│   │   │   ├── geospatial/
│   │   │   ├── environment/
│   │   │   ├── crop-planning/
│   │   │   ├── simulator/
│   │   │   └── reports/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   ├── types/
│   │   └── utils/
│   │
│   └── public/
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── services/
│   │   │   ├── auth/
│   │   │   ├── farm/
│   │   │   ├── geospatial/
│   │   │   ├── environmental/
│   │   │   ├── assessment/
│   │   │   ├── rotation/
│   │   │   ├── simulation/
│   │   │   ├── ai/
│   │   │   └── reporting/
│   │   ├── providers/
│   │   │   ├── nasa/
│   │   │   ├── usgs/
│   │   │   ├── earth-engine/
│   │   │   └── gemini/
│   │   ├── repositories/
│   │   ├── validators/
│   │   └── utils/
│   │
│   └── tests/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── docs/
│   ├── architecture.md
│   ├── data-sources.md
│   ├── api-reference.md
│   ├── security.md
│   └── deployment.md
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

# 24. Development Roadmap

| Phase | Focus | Expected outcome |
|---|---|---|
| Phase 1 | Relational migration | PostgreSQL and Prisma foundation |
| Phase 2 | Authentication | Secure native authentication and OAuth |
| Phase 3 | Farm management | Location, boundary, soil, and crop history |
| Phase 4 | Environmental integration | NASA/USGS provider adapters |
| Phase 5 | Environmental assessment | Validated risk indicators |
| Phase 6 | Crop intelligence | Suitability and rotation algorithms |
| Phase 7 | Scenario simulation | Interactive what-if comparisons |
| Phase 8 | AI assistant | Context-aware explanations |
| Phase 9 | Reporting | Evidence-backed PDF reports |
| Phase 10 | Production readiness | Deployment, monitoring, security, and validation |

### Implementation Status

The current application architecture and migration work provide the foundation for these modules. Actual completion status should be determined from the current source code and live integration tests.

In particular, do not mark a NASA, USGS, or Earth Engine provider as fully integrated until authenticated data retrieval and validation have succeeded.

---

# 25. Future Enhancements

## 25.1 Advanced Satellite Analytics

- Multi-year vegetation trend analysis.
- Crop growth-stage monitoring.
- Drought severity indicators.
- Historical environmental comparisons.
- Farm-level raster summaries where supported by data resolution.
- Additional Earth observation collections.

## 25.2 Advanced Agronomic Intelligence

- Crop-specific stress thresholds.
- Improved nutrient balance modelling.
- Rotation compatibility constraints.
- Pest and disease break considerations.
- Local crop calendar integration.
- Regional agronomic knowledge bases.

## 25.3 Predictive Analytics

Potential future research directions:

- Crop suitability modelling.
- Seasonal environmental forecasting.
- Vegetation anomaly detection.
- Drought-risk prediction.
- Crop rotation optimization.

Any predictive model should have documented training data, validation methodology, limitations, and performance metrics before being used for decision support.

## 25.4 Farmer-Centric Capabilities

- Multilingual interface.
- Voice-assisted interaction.
- Low-bandwidth operation.
- Offline farm profile access.
- Mobile-friendly field workflows.
- Localized crop knowledge.
- Agricultural advisory integrations.

## 25.5 Platform Scalability

- Background job processing.
- Provider-specific data caches.
- Raster processing pipelines.
- PostGIS spatial indexing.
- Object storage for generated reports.
- Observability and structured logging.
- Production monitoring and backups.

---

# 26. Responsible Use and Limitations

AgriShift AI is a decision-support platform, not a substitute for local agronomic expertise.

Important limitations:

1. Satellite datasets have different spatial resolutions and temporal frequencies.
2. Regional satellite estimates may not represent exact field conditions.
3. Crop suitability depends on local varieties, sowing dates, management practices, and soil conditions.
4. Environmental observations may be missing, delayed, or affected by quality limitations.
5. AI-generated explanations can be incomplete and must be grounded in verified information.
6. Rotation scores depend on the methodology, available inputs, and selected weights.
7. Scenario simulations are hypothetical and must not be confused with forecasts.

The application should communicate these limitations wherever they materially affect a recommendation.

---

# 27. Contributing

Contributions are welcome from developers, agricultural researchers, geospatial engineers, and students.

Suggested contribution areas:

- Frontend development.
- Backend services.
- Geospatial processing.
- NASA and USGS integrations.
- Agronomic knowledge modelling.
- Crop rotation algorithms.
- Data visualization.
- Testing and documentation.

## Contribution Workflow

1. Fork the repository.
2. Create a feature branch.
3. Implement the change.
4. Add or update tests.
5. Run lint, tests, and production build.
6. Submit a pull request with a clear description.

Example:

```bash
git checkout -b feature/environmental-provider
git add .
git commit -m "Add environmental data provider"
git push origin feature/environmental-provider
```

---

# 28. Acknowledgements and Data Sources

AgriShift AI builds on publicly documented Earth observation resources and agricultural knowledge.

### NASA

- [NASA Earthdata](https://www.earthdata.nasa.gov/)
- [NASA SMAP](https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap)
- [NASA Global Precipitation Measurement](https://gpm.nasa.gov/data)
- [NASA POWER](https://power.larc.nasa.gov/)

### USGS

- [USGS EarthExplorer](https://earthexplorer.usgs.gov/)
- [USGS Landsat Missions](https://www.usgs.gov/landsat-missions)

### Google Earth Engine

- [Google Earth Engine](https://earthengine.google.com/)
- [Earth Engine Documentation](https://developers.google.com/earth-engine)

### Geospatial Technologies

- [Leaflet](https://leafletjs.com/)
- [Turf.js](https://turfjs.org/)
- [GeoJSON Specification](https://www.rfc-editor.org/rfc/rfc7946)

### Agricultural Knowledge

- [ICAR](https://icar.org.in/)
- [FAO](https://www.fao.org/)

Dataset attribution, product-specific citations, and licensing conditions should be retained when data is displayed, processed, or redistributed.

---

# 29. License

Choose and add an appropriate open-source license before publishing the repository.

For example, an MIT License can be used if the project owners intend to permit broad reuse, modification, and distribution under its terms.

---

## Project Summary

**AgriShift AI — Field Shift Decision-Support Platform**

AgriShift AI brings together geospatial farm management, Earth observation data, environmental risk analysis, agricultural knowledge, and explainable crop rotation strategies.

Its goal is to help farmers explore how environmental conditions influence agricultural decisions and evaluate alternative crop rotations with transparent evidence.

**From satellite observations to agricultural intelligence.**

<p align="center">
  <strong>AgriShift AI</strong><br/>
  Building a more informed and climate-resilient agricultural future.
</p>
