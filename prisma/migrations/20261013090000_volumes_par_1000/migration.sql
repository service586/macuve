-- DropForeignKey
ALTER TABLE "Price" DROP CONSTRAINT "Price_tierId_fkey";

-- DropForeignKey
ALTER TABLE "Price" DROP CONSTRAINT "Price_zoneId_fkey";

-- AlterTable
ALTER TABLE "Zone" ADD COLUMN     "pricePer1000Xaf" INTEGER NOT NULL DEFAULT 5000;

-- DropTable
DROP TABLE "Price";

-- DropTable
DROP TABLE "VolumeTier";

