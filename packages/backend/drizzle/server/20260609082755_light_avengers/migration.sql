CREATE TYPE "UserSubscriptionListEntryState" AS ENUM('ACTIVE', 'REMOVED');--> statement-breakpoint
CREATE TABLE "UserSubscriptionListEntry" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userUnitId" uuid NOT NULL,
	"subscribedUnitId" uuid NOT NULL,
	"subscribedType" "UnitType" NOT NULL,
	"position" varchar(64) NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"state" "UserSubscriptionListEntryState" DEFAULT 'ACTIVE'::"UserSubscriptionListEntryState" NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX "UserSubscriptionListEntry_user_state_type_order_idx" ON "UserSubscriptionListEntry" ("userUnitId","state","subscribedType","pinned" DESC NULLS LAST,"position","createdAt");--> statement-breakpoint
CREATE INDEX "UserSubscriptionListEntry_subscribedUnitId_idx" ON "UserSubscriptionListEntry" ("subscribedUnitId");--> statement-breakpoint
CREATE UNIQUE INDEX "UserSubscriptionListEntry_user_subscribed_key" ON "UserSubscriptionListEntry" ("userUnitId","subscribedUnitId");--> statement-breakpoint
ALTER TABLE "UserSubscriptionListEntry" ADD CONSTRAINT "UserSubscriptionListEntry_userUnitId_Unit_id_fkey" FOREIGN KEY ("userUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserSubscriptionListEntry" ADD CONSTRAINT "UserSubscriptionListEntry_subscribedUnitId_Unit_id_fkey" FOREIGN KEY ("subscribedUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;