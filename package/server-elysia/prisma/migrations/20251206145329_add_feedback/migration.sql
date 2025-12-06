-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('REPORT', 'BUG', 'FEATURE', 'OTHER');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "unitId" UUID,
    "content" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL DEFAULT 'REPORT',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);
