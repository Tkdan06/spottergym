-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('female', 'male');
CREATE TYPE "Intent" AS ENUM ('dating', 'buddy', 'both');
CREATE TYPE "ExperienceLevel" AS ENUM ('newbie', 'confident', 'experienced', 'pro');
CREATE TYPE "PrivacyMode" AS ENUM ('open', 'anonymous');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL DEFAULT 25,
    "gender" "Gender" NOT NULL DEFAULT 'male',
    "bio" TEXT NOT NULL DEFAULT '',
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avatar" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "homeGymId" TEXT,
    "intent" "Intent" NOT NULL DEFAULT 'both',
    "experienceLevel" "ExperienceLevel" NOT NULL DEFAULT 'confident',
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isCoach" BOOLEAN NOT NULL DEFAULT false,
    "coachSports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visitSlots" JSONB NOT NULL DEFAULT '[]',
    "breakUntil" TEXT,
    "privacy" "PrivacyMode" NOT NULL DEFAULT 'open',
    "lookingToMeet" BOOLEAN NOT NULL DEFAULT true,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isMasterAdmin" BOOLEAN NOT NULL DEFAULT false,
    "adminPermissions" JSONB,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Gym" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gym_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserGym" (
    "userId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGym_pkey" PRIMARY KEY ("userId","gymId")
);

CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" TIMESTAMP(3),

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_city_idx" ON "User"("city");
CREATE INDEX "Gym_city_idx" ON "Gym"("city");
CREATE INDEX "Gym_network_idx" ON "Gym"("network");
CREATE INDEX "UserGym_gymId_idx" ON "UserGym"("gymId");
CREATE INDEX "CheckIn_gymId_checkedOutAt_idx" ON "CheckIn"("gymId", "checkedOutAt");
CREATE INDEX "CheckIn_userId_checkedOutAt_idx" ON "CheckIn"("userId", "checkedOutAt");

ALTER TABLE "UserGym" ADD CONSTRAINT "UserGym_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserGym" ADD CONSTRAINT "UserGym_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
