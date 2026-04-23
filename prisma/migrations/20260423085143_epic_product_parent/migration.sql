-- AlterTable
ALTER TABLE "Epic" ADD COLUMN     "productId" TEXT,
ALTER COLUMN "initiativeId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Epic_productId_idx" ON "Epic"("productId");

-- CreateIndex
CREATE INDEX "Epic_initiativeId_idx" ON "Epic"("initiativeId");

-- AddForeignKey
ALTER TABLE "Epic" ADD CONSTRAINT "Epic_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
