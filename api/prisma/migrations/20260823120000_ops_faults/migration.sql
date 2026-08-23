-- CreateTable
CREATE TABLE "OpsFault" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,

    CONSTRAINT "OpsFault_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsFault_createdAt_idx" ON "OpsFault"("createdAt");

-- CreateIndex
CREATE INDEX "OpsFault_path_status_createdAt_idx" ON "OpsFault"("path", "status", "createdAt");
