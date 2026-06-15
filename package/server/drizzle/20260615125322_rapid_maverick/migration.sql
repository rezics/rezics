CREATE TYPE "UserNotificationPreferenceChannel" AS ENUM('feed', 'email', 'push');--> statement-breakpoint
CREATE TYPE "UserNotificationPreferenceKind" AS ENUM('reply', 'follow', 'dm', 'moderation', 'realm', 'system');--> statement-breakpoint
CREATE TYPE "UserPrivacyPreferenceField" AS ENUM('userTags');--> statement-breakpoint
CREATE TYPE "UserProfileFieldVisibility" AS ENUM('private', 'followers', 'public');--> statement-breakpoint
CREATE TYPE "UserSubscriptionListPreferenceKind" AS ENUM('zones', 'realms');--> statement-breakpoint
CREATE TYPE "UserSubscriptionListSortPreference" AS ENUM('manualAsc', 'manualDesc', 'addedDesc', 'addedAsc');--> statement-breakpoint
CREATE TABLE "UserContentRatingPreference" (
	"userId" uuid,
	"rating" varchar(32),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "UserContentRatingPreference_userId_rating_pk" PRIMARY KEY("userId","rating")
);
--> statement-breakpoint
CREATE TABLE "UserNotificationPreference" (
	"userId" uuid,
	"kind" "UserNotificationPreferenceKind",
	"channel" "UserNotificationPreferenceChannel" DEFAULT 'feed'::"UserNotificationPreferenceChannel",
	"enabled" boolean NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "UserNotificationPreference_user_kind_channel_pk" PRIMARY KEY("userId","kind","channel")
);
--> statement-breakpoint
CREATE TABLE "UserPreference" (
	"userId" uuid PRIMARY KEY,
	"defaultLicenseSlug" text,
	"realmManageModeDefault" boolean,
	"bookshelfConfig" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserPreferredLanguage" (
	"userId" uuid,
	"language" varchar(16),
	"position" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "UserPreferredLanguage_userId_language_pk" PRIMARY KEY("userId","language")
);
--> statement-breakpoint
CREATE TABLE "UserPrivacyPreference" (
	"userId" uuid,
	"field" "UserPrivacyPreferenceField",
	"visibility" "UserProfileFieldVisibility" NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "UserPrivacyPreference_userId_field_pk" PRIMARY KEY("userId","field")
);
--> statement-breakpoint
CREATE TABLE "UserRealmTagDisplayPreference" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userId" uuid NOT NULL,
	"targetKey" varchar(64) NOT NULL,
	"maxVisibleTags" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserRealmTagDisplayRealm" (
	"preferenceId" uuid,
	"realmId" uuid,
	"position" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "UserRealmTagDisplayRealm_preferenceId_realmId_pk" PRIMARY KEY("preferenceId","realmId")
);
--> statement-breakpoint
CREATE TABLE "UserSubscriptionListPreference" (
	"userId" uuid,
	"list" "UserSubscriptionListPreferenceKind",
	"defaultSort" "UserSubscriptionListSortPreference" NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "UserSubscriptionListPreference_userId_list_pk" PRIMARY KEY("userId","list")
);
--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN "settings";--> statement-breakpoint
CREATE INDEX "UserNotificationPreference_kind_enabled_idx" ON "UserNotificationPreference" ("kind","enabled");--> statement-breakpoint
CREATE INDEX "UserPreferredLanguage_userId_position_idx" ON "UserPreferredLanguage" ("userId","position");--> statement-breakpoint
CREATE UNIQUE INDEX "UserRealmTagDisplayPreference_user_target_key" ON "UserRealmTagDisplayPreference" ("userId","targetKey");--> statement-breakpoint
CREATE INDEX "UserRealmTagDisplayRealm_preference_position_idx" ON "UserRealmTagDisplayRealm" ("preferenceId","position");--> statement-breakpoint
ALTER TABLE "UserContentRatingPreference" ADD CONSTRAINT "UserContentRatingPreference_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserPreferredLanguage" ADD CONSTRAINT "UserPreferredLanguage_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserPrivacyPreference" ADD CONSTRAINT "UserPrivacyPreference_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserRealmTagDisplayPreference" ADD CONSTRAINT "UserRealmTagDisplayPreference_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserRealmTagDisplayRealm" ADD CONSTRAINT "UserRealmTagDisplayRealm_MbJSpfxtOlO0_fkey" FOREIGN KEY ("preferenceId") REFERENCES "UserRealmTagDisplayPreference"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserRealmTagDisplayRealm" ADD CONSTRAINT "UserRealmTagDisplayRealm_realmId_Unit_id_fkey" FOREIGN KEY ("realmId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserSubscriptionListPreference" ADD CONSTRAINT "UserSubscriptionListPreference_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;