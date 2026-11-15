-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "account_status" TEXT NOT NULL DEFAULT 'active',
    "role" TEXT NOT NULL DEFAULT 'farmer',
    "preferred_language" TEXT NOT NULL DEFAULT 'English',
    "location" TEXT NOT NULL DEFAULT 'India',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "farm_name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "village" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "area_unit" TEXT NOT NULL DEFAULT 'hectares',
    "boundary_geojson" JSONB,
    "irrigation_type" TEXT,
    "irrigation_available" BOOLEAN NOT NULL DEFAULT true,
    "water_availability" TEXT NOT NULL DEFAULT 'moderate',
    "water_constraints" TEXT,
    "current_crops" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soil_profiles" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "soil_type" TEXT,
    "ph" DOUBLE PRECISION,
    "nitrogen" DOUBLE PRECISION,
    "phosphorus" DOUBLE PRECISION,
    "potassium" DOUBLE PRECISION,
    "organic_carbon" DOUBLE PRECISION,
    "organic_matter" DOUBLE PRECISION,
    "soil_texture" TEXT,
    "drainage" TEXT,
    "lab_report_file_name" TEXT,
    "lab_tested_date" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "soil_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_history" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "crop_id" TEXT,
    "season" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sowing_date" TIMESTAMP(3),
    "harvest_date" TIMESTAMP(3),
    "crop_name" TEXT,
    "notes" TEXT,

    CONSTRAINT "crop_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environmental_observations" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "observation_date" TIMESTAMP(3) NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "spatial_resolution" TEXT,
    "quality_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "environmental_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environmental_assessments" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "assessment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperature_risk" TEXT NOT NULL,
    "rainfall_risk" TEXT NOT NULL,
    "water_stress" TEXT NOT NULL,
    "vegetation_health" TEXT NOT NULL,
    "overall_risk" TEXT NOT NULL,
    "overall_risk_score" DOUBLE PRECISION,
    "methodology" JSONB,
    "data_completeness" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "environmental_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_knowledge" (
    "id" TEXT NOT NULL,
    "crop_name" TEXT NOT NULL,
    "scientific_name" TEXT,
    "category" TEXT NOT NULL,
    "temperature_range" JSONB NOT NULL,
    "water_requirement" TEXT NOT NULL,
    "rainfall_requirement" JSONB NOT NULL,
    "soil_preferences" JSONB NOT NULL,
    "growing_season" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "nitrogen_fixing" BOOLEAN NOT NULL,
    "agronomic_metadata" JSONB NOT NULL,

    CONSTRAINT "crop_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmer_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "farm_id" TEXT,
    "water_priority" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "soil_priority" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "climate_priority" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "market_priority" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "erosion_priority" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farmer_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotation_scenarios" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scenario_name" TEXT NOT NULL,
    "strategy_type" TEXT,
    "crop_sequence" JSONB NOT NULL,
    "component_scores" JSONB NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT,
    "risks" JSONB,
    "uncertainty_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rotation_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "file_path" TEXT,
    "report_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "farms_user_id_idx" ON "farms"("user_id");

-- CreateIndex
CREATE INDEX "farms_latitude_longitude_idx" ON "farms"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "soil_profiles_farm_id_idx" ON "soil_profiles"("farm_id");

-- CreateIndex
CREATE INDEX "crop_history_farm_id_idx" ON "crop_history"("farm_id");

-- CreateIndex
CREATE INDEX "environmental_observations_farm_id_idx" ON "environmental_observations"("farm_id");

-- CreateIndex
CREATE INDEX "environmental_observations_observation_date_idx" ON "environmental_observations"("observation_date");

-- CreateIndex
CREATE INDEX "environmental_assessments_farm_id_idx" ON "environmental_assessments"("farm_id");

-- CreateIndex
CREATE INDEX "environmental_assessments_assessment_date_idx" ON "environmental_assessments"("assessment_date");

-- CreateIndex
CREATE UNIQUE INDEX "crop_knowledge_crop_name_key" ON "crop_knowledge"("crop_name");

-- CreateIndex
CREATE INDEX "crop_knowledge_category_idx" ON "crop_knowledge"("category");

-- CreateIndex
CREATE INDEX "farmer_preferences_user_id_idx" ON "farmer_preferences"("user_id");

-- CreateIndex
CREATE INDEX "farmer_preferences_farm_id_idx" ON "farmer_preferences"("farm_id");

-- CreateIndex
CREATE INDEX "rotation_scenarios_farm_id_idx" ON "rotation_scenarios"("farm_id");

-- CreateIndex
CREATE INDEX "rotation_scenarios_user_id_idx" ON "rotation_scenarios"("user_id");

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_idx" ON "ai_conversations"("user_id");

-- CreateIndex
CREATE INDEX "ai_conversations_farm_id_idx" ON "ai_conversations"("farm_id");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "reports_user_id_idx" ON "reports"("user_id");

-- CreateIndex
CREATE INDEX "reports_farm_id_idx" ON "reports"("farm_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soil_profiles" ADD CONSTRAINT "soil_profiles_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_history" ADD CONSTRAINT "crop_history_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_observations" ADD CONSTRAINT "environmental_observations_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmental_assessments" ADD CONSTRAINT "environmental_assessments_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_preferences" ADD CONSTRAINT "farmer_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_preferences" ADD CONSTRAINT "farmer_preferences_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotation_scenarios" ADD CONSTRAINT "rotation_scenarios_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotation_scenarios" ADD CONSTRAINT "rotation_scenarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
