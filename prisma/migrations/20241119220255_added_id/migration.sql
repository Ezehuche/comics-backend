/*
  Warnings:

  - The primary key for the `FXQLStatement` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `EntryId` on the `FXQLStatement` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FXQLStatement" DROP CONSTRAINT "FXQLStatement_pkey",
DROP COLUMN "EntryId",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "FXQLStatement_pkey" PRIMARY KEY ("id");
