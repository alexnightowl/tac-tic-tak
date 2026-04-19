-- AlterTable
ALTER TABLE "UserSetting" ADD COLUMN     "fixedColor" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "soundPack" TEXT NOT NULL DEFAULT 'classic';
