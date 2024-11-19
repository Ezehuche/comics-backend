/*
  Warnings:

  - The primary key for the `FXQLStatement` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `buyPrice` on the `FXQLStatement` table. All the data in the column will be lost.
  - You are about to drop the column `capAmount` on the `FXQLStatement` table. All the data in the column will be lost.
  - You are about to drop the column `destinationCurrency` on the `FXQLStatement` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `FXQLStatement` table. All the data in the column will be lost.
  - You are about to drop the column `sellPrice` on the `FXQLStatement` table. All the data in the column will be lost.
  - You are about to drop the column `sourceCurrency` on the `FXQLStatement` table. All the data in the column will be lost.
  - Added the required column `BuyPrice` to the `FXQLStatement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `CapAmount` to the `FXQLStatement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DestinationCurrency` to the `FXQLStatement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `SellPrice` to the `FXQLStatement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `SourceCurrency` to the `FXQLStatement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FXQLStatement" DROP CONSTRAINT "FXQLStatement_pkey",
DROP COLUMN "buyPrice",
DROP COLUMN "capAmount",
DROP COLUMN "destinationCurrency",
DROP COLUMN "id",
DROP COLUMN "sellPrice",
DROP COLUMN "sourceCurrency",
ADD COLUMN     "BuyPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "CapAmount" INTEGER NOT NULL,
ADD COLUMN     "DestinationCurrency" TEXT NOT NULL,
ADD COLUMN     "EntryId" SERIAL NOT NULL,
ADD COLUMN     "SellPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "SourceCurrency" TEXT NOT NULL,
ADD CONSTRAINT "FXQLStatement_pkey" PRIMARY KEY ("EntryId");
