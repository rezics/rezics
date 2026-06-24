CREATE TABLE "UserUnitProgressPost" (
	"progressId" uuid,
	"postUnitId" uuid,
	"status" "UserUnitProgressStatus" NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "UserUnitProgressPost_pkey" PRIMARY KEY("progressId","postUnitId")
);
--> statement-breakpoint
ALTER TABLE "UserUnitProgress" ADD COLUMN "id" uuid DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "UserUnitProgress" DROP COLUMN "extra";--> statement-breakpoint
ALTER TABLE "Shelf" DROP COLUMN "kindKey";--> statement-breakpoint
ALTER TABLE "UserUnitProgress" DROP CONSTRAINT "UserUnitProgress_pkey";--> statement-breakpoint
ALTER TABLE "UserUnitProgress" ADD PRIMARY KEY ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "UserUnitProgress_userId_unitId_key" ON "UserUnitProgress" ("userId","unitId");--> statement-breakpoint
CREATE INDEX "UserUnitProgressPost_postUnitId_idx" ON "UserUnitProgressPost" ("postUnitId");--> statement-breakpoint
CREATE INDEX "UserUnitProgressPost_progressId_status_idx" ON "UserUnitProgressPost" ("progressId","status");--> statement-breakpoint
ALTER TABLE "UserUnitProgressPost" ADD CONSTRAINT "UserUnitProgressPost_progressId_UserUnitProgress_id_fkey" FOREIGN KEY ("progressId") REFERENCES "UserUnitProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserUnitProgressPost" ADD CONSTRAINT "UserUnitProgressPost_postUnitId_Post_unitId_fkey" FOREIGN KEY ("postUnitId") REFERENCES "Post"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;
