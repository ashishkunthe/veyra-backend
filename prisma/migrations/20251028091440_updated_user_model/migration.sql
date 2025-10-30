-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profileImageUrl" TEXT;
