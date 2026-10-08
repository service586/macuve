-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "openedToAllAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "available" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "locatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrderOffer" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "OrderOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderOffer_orderId_idx" ON "OrderOffer"("orderId");

-- CreateIndex
CREATE INDEX "OrderOffer_supplierId_status_idx" ON "OrderOffer"("supplierId", "status");

-- AddForeignKey
ALTER TABLE "OrderOffer" ADD CONSTRAINT "OrderOffer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOffer" ADD CONSTRAINT "OrderOffer_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Une seule proposition en attente à la fois, par commande et par livreur.
CREATE UNIQUE INDEX "OrderOffer_one_pending_per_order" ON "OrderOffer"("orderId") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "OrderOffer_one_pending_per_supplier" ON "OrderOffer"("supplierId") WHERE "status" = 'PENDING';

-- Pilote : seules Libreville et Akanda sont ouvertes aux commandes.
UPDATE "Zone" SET "active" = false WHERE "name" IN ('Owendo', 'Ntoum');
