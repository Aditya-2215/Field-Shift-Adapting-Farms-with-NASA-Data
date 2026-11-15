-- AlterTable
ALTER TABLE "farms" ADD COLUMN "location_accuracy" DOUBLE PRECISION,
ADD COLUMN "address_components" JSONB;
