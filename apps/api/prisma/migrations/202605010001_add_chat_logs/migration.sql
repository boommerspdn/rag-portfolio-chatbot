-- CreateEnum
CREATE TYPE "ChatLogStatus" AS ENUM ('success', 'upstream_error', 'aborted', 'stream_error');

-- CreateTable
CREATE TABLE "ChatLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "sessionId" TEXT,
    "requestId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "rawSse" TEXT NOT NULL DEFAULT '',
    "finalText" TEXT NOT NULL DEFAULT '',
    "status" "ChatLogStatus" NOT NULL,
    "upstreamStatus" INTEGER,
    "errorDetail" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "ChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatLog_createdAt_idx" ON "ChatLog"("createdAt");

-- CreateIndex
CREATE INDEX "ChatLog_sessionId_idx" ON "ChatLog"("sessionId");

-- CreateIndex
CREATE INDEX "ChatLog_status_idx" ON "ChatLog"("status");

