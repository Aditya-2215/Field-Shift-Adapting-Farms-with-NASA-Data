import { PrismaClient } from '@prisma/client';
import { CROP_KNOWLEDGE_BASE } from '../shared/data/crops';
import { DEMO_FARM, DEMO_FARM_ID } from '../shared/data/demoFarm';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding crop knowledge base...');

  for (const crop of CROP_KNOWLEDGE_BASE) {
    await prisma.cropKnowledge.upsert({
      where: { cropName: crop.name },
      update: {
        scientificName: crop.scientificName,
        category: crop.category,
        temperatureRange: crop.tempRangeC as any,
        waterRequirement: `${crop.waterRequirementMm.min}-${crop.waterRequirementMm.max} mm (${crop.waterRequirementMm.optimal} mm optimal)`,
        rainfallRequirement: crop.rainfallRangeMm as any,
        soilPreferences: {
          phRange: crop.phRange,
          preferredTextures: crop.preferredTextures,
          drainageRequirement: crop.drainageRequirement
        } as any,
        growingSeason: crop.seasons.join(', '),
        duration: `${crop.durationDays.min}-${crop.durationDays.max} days`,
        nitrogenFixing: (crop.nitrogenFixingKgHa ?? 0) > 0,
        agronomicMetadata: {
          durationDays: crop.durationDays,
          waterRequirementMm: crop.waterRequirementMm,
          nitrogenDemandKgHa: crop.nitrogenDemandKgHa,
          nitrogenFixingKgHa: crop.nitrogenFixingKgHa,
          rootDepth: crop.rootDepth,
          organicMatterContribution: crop.organicMatterContribution,
          erosionProtection: crop.erosionProtection,
          pestRotationGroup: crop.pestRotationGroup,
          marketSuitabilityScore: crop.marketSuitabilityScore,
          marketNotes: crop.marketNotes,
          agronomicNotes: crop.agronomicNotes,
          sourceCitation: crop.sourceCitation
        } as any
      },
      create: {
        id: crop.id,
        cropName: crop.name,
        scientificName: crop.scientificName,
        category: crop.category,
        temperatureRange: crop.tempRangeC as any,
        waterRequirement: `${crop.waterRequirementMm.min}-${crop.waterRequirementMm.max} mm (${crop.waterRequirementMm.optimal} mm optimal)`,
        rainfallRequirement: crop.rainfallRangeMm as any,
        soilPreferences: {
          phRange: crop.phRange,
          preferredTextures: crop.preferredTextures,
          drainageRequirement: crop.drainageRequirement
        } as any,
        growingSeason: crop.seasons.join(', '),
        duration: `${crop.durationDays.min}-${crop.durationDays.max} days`,
        nitrogenFixing: (crop.nitrogenFixingKgHa ?? 0) > 0,
        agronomicMetadata: {
          durationDays: crop.durationDays,
          waterRequirementMm: crop.waterRequirementMm,
          nitrogenDemandKgHa: crop.nitrogenDemandKgHa,
          nitrogenFixingKgHa: crop.nitrogenFixingKgHa,
          rootDepth: crop.rootDepth,
          organicMatterContribution: crop.organicMatterContribution,
          erosionProtection: crop.erosionProtection,
          pestRotationGroup: crop.pestRotationGroup,
          marketSuitabilityScore: crop.marketSuitabilityScore,
          marketNotes: crop.marketNotes,
          agronomicNotes: crop.agronomicNotes,
          sourceCitation: crop.sourceCitation
        } as any
      }
    });
  }

  console.log(`Seeded ${CROP_KNOWLEDGE_BASE.length} crop knowledge entries.`);

  // Seed demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@agrishift.local' },
    update: {
      fullName: 'Demonstration Farmer (UP)',
      role: 'farmer',
      preferredLanguage: 'English',
      location: 'Barabanki, Uttar Pradesh, India',
      emailVerified: true,
      accountStatus: 'active'
    },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'demo@agrishift.local',
      fullName: 'Demonstration Farmer (UP)',
      role: 'farmer',
      preferredLanguage: 'English',
      location: 'Barabanki, Uttar Pradesh, India',
      emailVerified: true,
      accountStatus: 'active'
    }
  });

  // Seed demonstration farm
  const existingFarm = await prisma.farm.findFirst({
    where: { id: DEMO_FARM_ID }
  });

  if (!existingFarm) {
    await prisma.farm.create({
      data: {
        id: DEMO_FARM_ID,
        userId: demoUser.id,
        farmName: DEMO_FARM.name,
        country: DEMO_FARM.country,
        state: DEMO_FARM.state,
        district: DEMO_FARM.district,
        village: DEMO_FARM.village,
        latitude: DEMO_FARM.latitude,
        longitude: DEMO_FARM.longitude,
        area: DEMO_FARM.area,
        areaUnit: DEMO_FARM.areaUnit,
        boundaryGeoJson: DEMO_FARM.boundaryGeoJson as any,
        irrigationAvailable: DEMO_FARM.irrigationAvailable,
        irrigationType: DEMO_FARM.irrigationMethod || 'Borewell & canal irrigation',
        waterAvailability: DEMO_FARM.waterAvailability,
        waterConstraints: DEMO_FARM.waterConstraints,
        currentCrops: DEMO_FARM.currentCrops as any,
        soilProfiles: {
          create: {
            soilType: DEMO_FARM.soilProfile.soilType,
            ph: DEMO_FARM.soilProfile.ph,
            nitrogen: DEMO_FARM.soilProfile.nitrogenKgHa,
            phosphorus: DEMO_FARM.soilProfile.phosphorusKgHa,
            potassium: DEMO_FARM.soilProfile.potassiumKgHa,
            organicCarbon: DEMO_FARM.soilProfile.organicCarbonPct,
            organicMatter: DEMO_FARM.soilProfile.organicMatterPct,
            soilTexture: DEMO_FARM.soilProfile.texture,
            drainage: DEMO_FARM.soilProfile.drainage,
            labReportFileName: DEMO_FARM.soilProfile.labReportFileName,
            labTestedDate: DEMO_FARM.soilProfile.labTestedDate,
            notes: DEMO_FARM.soilProfile.notes
          }
        },
        cropHistory: {
          create: (DEMO_FARM.cropHistory || []).map((ch) => ({
            year: ch.year,
            season: ch.season,
            cropName: ch.cropName,
            notes: ch.yieldNote
          }))
        }
      }
    });
    console.log('Seeded demo farm and soil profile.');
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
