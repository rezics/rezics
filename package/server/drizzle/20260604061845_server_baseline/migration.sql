CREATE TYPE "AccountEnforcementKind" AS ENUM('WARNING', 'SILENCE', 'SUSPENSION', 'BAN', 'RATE_LIMIT', 'TRUST_RESTRICTION');--> statement-breakpoint
CREATE TYPE "AccountEnforcementState" AS ENUM('ACTIVE', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "AiDisclosureMode" AS ENUM('UNKNOWN', 'NONE', 'AI_ASSISTED', 'AI_ORIGINATED', 'MACHINE_GENERATED');--> statement-breakpoint
CREATE TYPE "CatalogEntryKind" AS ENUM('MAIN', 'VARIANT', 'NONE');--> statement-breakpoint
CREATE TYPE "ContentRating" AS ENUM('GENERAL', 'R_15', 'R_18', 'R_18G');--> statement-breakpoint
CREATE TYPE "ContentTranslationStatus" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "EmailVerificationContractStatus" AS ENUM('PENDING', 'VERIFIED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "FeedbackType" AS ENUM('REPORT', 'BUG', 'FEATURE', 'OTHER');--> statement-breakpoint
CREATE TYPE "GovernanceGrantState" AS ENUM('ACTIVE', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "ModerationActionKind" AS ENUM('APPROVE', 'REMOVE', 'RESTORE', 'LOCK', 'UNLOCK', 'FIELD_LOCK', 'FIELD_UNLOCK', 'WARNING', 'SILENCE', 'SUSPENSION', 'BAN', 'RATE_LIMIT', 'TRUST_RESTRICTION', 'REVOKE_ENFORCEMENT', 'MUTE_MEMBER', 'REMOVE_MEMBER', 'BAN_MEMBER', 'RESTORE_MEMBER', 'ESCALATE', 'REVERSE', 'NOTE');--> statement-breakpoint
CREATE TYPE "ModerationActorKind" AS ENUM('USER', 'SYSTEM', 'AUTOMATION', 'IMPORT');--> statement-breakpoint
CREATE TYPE "ModerationAuthority" AS ENUM('PLATFORM', 'REALM', 'OWNER');--> statement-breakpoint
CREATE TYPE "ModerationCaseState" AS ENUM('NEW', 'TRIAGED', 'ASSIGNED', 'ACTIONED', 'RESOLVED', 'DUPLICATE', 'REJECTED', 'ESCALATED', 'REVIEWING');--> statement-breakpoint
CREATE TYPE "ModerationScope" AS ENUM('PLATFORM', 'REALM');--> statement-breakpoint
CREATE TYPE "ModerationStatus" AS ENUM('APPROVED', 'PENDING', 'REMOVED');--> statement-breakpoint
CREATE TYPE "ModerationTargetKind" AS ENUM('UNIT', 'UNIT_REALM', 'COMMENT', 'UNIT_FIELD', 'ACCOUNT', 'REALM_MEMBER', 'FEEDBACK');--> statement-breakpoint
CREATE TYPE "PinKind" AS ENUM('ACCEPTED_ANSWER', 'PINNED', 'HIGHLIGHT');--> statement-breakpoint
CREATE TYPE "PollResultVisibility" AS ENUM('LIVE', 'AFTER_CLOSE');--> statement-breakpoint
CREATE TYPE "PollVoteMode" AS ENUM('SINGLE', 'MULTI');--> statement-breakpoint
CREATE TYPE "PostKind" AS ENUM('REVIEW', 'EXCERPT', 'REMARK', 'POST', 'CHAPTER', 'WIKI');--> statement-breakpoint
CREATE TYPE "RealmMemberState" AS ENUM('ACTIVE', 'PENDING', 'MUTED', 'REMOVED', 'BANNED');--> statement-breakpoint
CREATE TYPE "UnitAliasKind" AS ENUM('COMMON', 'ABBREVIATION', 'TRANSLITERATION', 'ALTERNATE_TITLE', 'LEGACY_TITLE', 'MISSPELLING', 'OTHER');--> statement-breakpoint
CREATE TYPE "UnitAliasStatus" AS ENUM('ACTIVE', 'HIDDEN');--> statement-breakpoint
CREATE TYPE "UnitStatus" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED', 'DELETED');--> statement-breakpoint
CREATE TYPE "UnitType" AS ENUM('BOOK', 'GAME', 'MEDIA', 'POST', 'TAG', 'REALM', 'SHELF', 'IMAGE', 'VIDEO', 'QUOTE', 'LINK', 'ENTITY', 'ZONE', 'USER', 'SCOPE', 'SERIES', 'LABEL', 'POLL', 'COMMENT');--> statement-breakpoint
CREATE TYPE "UnitVisibility" AS ENUM('PUBLIC', 'UNLISTED', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "UserUnitProgressStatus" AS ENUM('BACKLOG', 'ACTIVE', 'PAUSED', 'COMPLETED', 'DROPPED');--> statement-breakpoint
CREATE SEQUENCE "public"."post_path_label_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "AccountEnforcement" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"targetUserId" uuid NOT NULL,
	"kind" "AccountEnforcementKind" NOT NULL,
	"state" "AccountEnforcementState" DEFAULT 'ACTIVE'::"AccountEnforcementState" NOT NULL,
	"reason" text NOT NULL,
	"safeMessage" text,
	"decidedById" uuid NOT NULL,
	"decisionCode" varchar(64) NOT NULL,
	"startsAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expiresAt" timestamp(3),
	"revokedAt" timestamp(3),
	"revokedById" uuid,
	"metadata" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"decisionActionId" uuid,
	"revocationActionId" uuid
);
--> statement-breakpoint
CREATE TABLE "ApiToken" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userId" uuid NOT NULL,
	"name" text NOT NULL,
	"tokenHash" text NOT NULL,
	"scopes" jsonb DEFAULT '{}' NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expiresAt" timestamp(3),
	"lastUsedAt" timestamp(3),
	"lastIP" text,
	"userAgent" text,
	"revoked" boolean DEFAULT false NOT NULL,
	"revokedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "Book" (
	"unitId" uuid PRIMARY KEY,
	"isbn13" varchar(32),
	"publicationDate" timestamp(3),
	"pageCount" integer,
	"textLength" integer DEFAULT 0 NOT NULL,
	"formatKey" varchar(32),
	"isLicensed" boolean DEFAULT false NOT NULL,
	"extra" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"chapterCount" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Comment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"rootUnitId" uuid NOT NULL,
	"realmUnitId" uuid,
	"parentCommentId" uuid,
	"authorUserId" uuid NOT NULL,
	"content" jsonb,
	"depth" integer DEFAULT 1 NOT NULL,
	"path" ltree,
	"replyCount" integer DEFAULT 0 NOT NULL,
	"directReplyCount" integer DEFAULT 0 NOT NULL,
	"lastReplyAt" timestamp(3),
	"isLocked" boolean DEFAULT false NOT NULL,
	"state" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"deletedAt" timestamp(3),
	"moderationStatus" "ModerationStatus" DEFAULT 'APPROVED'::"ModerationStatus" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CommentPromotion" (
	"scopeUnitId" uuid,
	"commentId" uuid,
	"kind" "PinKind" NOT NULL,
	"position" varchar(64) NOT NULL,
	"byUserId" uuid NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "CommentPromotion_pkey" PRIMARY KEY("scopeUnitId","commentId")
);
--> statement-breakpoint
CREATE TABLE "ContentStructure" (
	"ownerUnitId" uuid PRIMARY KEY,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ContentStructureAnchor" (
	"nodeId" uuid PRIMARY KEY,
	"ownerUnitId" uuid NOT NULL,
	"contentUnitId" uuid NOT NULL,
	"parentNodeId" uuid,
	"ancestorNodeIds" jsonb NOT NULL,
	"path" jsonb NOT NULL,
	"depth" integer NOT NULL,
	"position" text NOT NULL,
	"positionPath" text NOT NULL,
	"titlePath" jsonb NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ContentStructureNode" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"ownerUnitId" uuid NOT NULL,
	"parentId" uuid,
	"position" text NOT NULL,
	"contentUnitId" uuid,
	"title" text NOT NULL,
	"noContent" boolean DEFAULT false NOT NULL,
	"rating" "ContentRating",
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"deletedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "ContentTranslation" (
	"unitId" uuid,
	"language" varchar(16),
	"content" jsonb NOT NULL,
	"status" "ContentTranslationStatus" DEFAULT 'PUBLISHED'::"ContentTranslationStatus" NOT NULL,
	"sourceUnitId" uuid,
	"authorUserId" uuid,
	"provenance" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "ContentTranslation_pkey" PRIMARY KEY("unitId","language")
);
--> statement-breakpoint
CREATE TABLE "CreditAttribution" (
	"unitId" uuid,
	"entityId" uuid,
	"role" varchar(64),
	"sortOrder" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "CreditAttribution_pkey" PRIMARY KEY("unitId","entityId","role")
);
--> statement-breakpoint
CREATE TABLE "CreditAttributionEvidence" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unitId" uuid NOT NULL,
	"entityId" uuid NOT NULL,
	"role" varchar(64) NOT NULL,
	"sourceRefId" uuid NOT NULL,
	"claimPath" text,
	"observedUrl" text,
	"observedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"confidence" double precision,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EchoKV" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EmailVerificationContract" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"contractName" varchar(96) NOT NULL,
	"ownerId" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"status" "EmailVerificationContractStatus" DEFAULT 'PENDING'::"EmailVerificationContractStatus" NOT NULL,
	"codeHash" text,
	"deliveryStatus" varchar(64),
	"source" varchar(64),
	"verifiedAt" timestamp(3),
	"expiresAt" timestamp(3),
	"lastSentAt" timestamp(3),
	"attempts" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Entity" (
	"unitId" uuid PRIMARY KEY,
	"kind" varchar(32),
	"verified" boolean DEFAULT false NOT NULL,
	"avatar" text,
	"eligibleCreditRoles" text[] DEFAULT ARRAY::text[] NOT NULL,
	"eligibleSubjectRoles" text[] DEFAULT ARRAY::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Feedback" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userId" uuid NOT NULL,
	"url" text,
	"content" text NOT NULL,
	"type" "FeedbackType" DEFAULT 'REPORT'::"FeedbackType" NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolvedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"addressedUnitId" uuid,
	"targetId" varchar(128),
	"targetKind" "ModerationTargetKind"
);
--> statement-breakpoint
CREATE TABLE "Game" (
	"unitId" uuid PRIMARY KEY,
	"releaseDate" timestamp(3),
	"versionLabel" text,
	"isLicensed" boolean DEFAULT false NOT NULL,
	"extra" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "GameSystemRequirement" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"gameUnitId" uuid NOT NULL,
	"platformEntityId" uuid,
	"tier" varchar(32) NOT NULL,
	"language" varchar(16),
	"sourceRefId" uuid,
	"hardware" jsonb NOT NULL,
	"rawText" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "HistoryOutbox" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unitId" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"actorUserId" uuid NOT NULL,
	"category" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"payloadHash" varchar(64),
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"nextAttemptAt" timestamp(3),
	"processedAt" timestamp(3),
	"processedById" uuid,
	"lastError" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Jwks" (
	"id" text PRIMARY KEY,
	"jwtServiceId" uuid NOT NULL,
	"publicJwk" jsonb NOT NULL,
	"privateJwk" jsonb NOT NULL,
	"alg" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expiresAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "JwtService" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"serviceKey" text NOT NULL,
	"issuer" text NOT NULL,
	"audience" text NOT NULL,
	"jwksUrl" text NOT NULL,
	"jwksPath" text NOT NULL,
	"isLocalIssuer" boolean DEFAULT false NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Link" (
	"unitId" uuid PRIMARY KEY,
	"url" text NOT NULL,
	"siteName" varchar(128),
	"faviconUrl" text,
	"extra" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Media" (
	"unitId" uuid PRIMARY KEY,
	"kindKey" varchar(32) NOT NULL,
	"releaseDate" timestamp(3),
	"runtimeMinutes" integer,
	"episodeCount" integer,
	"seasonCount" integer,
	"isLicensed" boolean DEFAULT false NOT NULL,
	"extra" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ModerationAction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"authority" "ModerationAuthority" NOT NULL,
	"realmUnitId" uuid,
	"targetKind" "ModerationTargetKind" NOT NULL,
	"targetId" varchar(128) NOT NULL,
	"targetPath" text,
	"actorKind" "ModerationActorKind" DEFAULT 'USER'::"ModerationActorKind" NOT NULL,
	"actorUserId" uuid,
	"actionKind" "ModerationActionKind" NOT NULL,
	"resultingStatus" "ModerationStatus",
	"resultingLocked" boolean,
	"reasonCode" varchar(64) NOT NULL,
	"reasonText" text,
	"publicMessage" text,
	"caseId" uuid,
	"reversesActionId" uuid,
	"requestId" varchar(128),
	"idempotencyKey" varchar(256),
	"importedFrom" varchar(128),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ModerationCase" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"state" "ModerationCaseState" DEFAULT 'NEW'::"ModerationCaseState" NOT NULL,
	"severity" varchar(32),
	"reporterUserId" uuid,
	"subjectUserId" uuid,
	"targetId" varchar(128) NOT NULL,
	"addressedUnitId" uuid,
	"realmUnitId" uuid,
	"sourceFeedbackId" uuid,
	"assignedToUserId" uuid,
	"duplicateOfCaseId" uuid,
	"reason" text,
	"safeSummary" text,
	"metadata" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"parentCaseId" uuid,
	"scope" "ModerationScope" DEFAULT 'PLATFORM'::"ModerationScope" NOT NULL,
	"targetKind" "ModerationTargetKind" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Poll" (
	"unitId" uuid PRIMARY KEY,
	"voteMode" "PollVoteMode" DEFAULT 'SINGLE'::"PollVoteMode" NOT NULL,
	"resultVisibility" "PollResultVisibility" DEFAULT 'LIVE'::"PollResultVisibility" NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"closesAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"usageCount" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PollOption" (
	"pollUnitId" uuid,
	"optionId" uuid DEFAULT uuidv7(),
	"position" varchar(64) NOT NULL,
	"voteCount" integer DEFAULT 0 NOT NULL,
	"label" text,
	"unitId" uuid,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "PollOption_pkey" PRIMARY KEY("pollUnitId","optionId")
);
--> statement-breakpoint
CREATE TABLE "PollVote" (
	"pollUnitId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"optionId" uuid NOT NULL,
	"voteMode" "PollVoteMode" NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"realmUnitId" uuid
);
--> statement-breakpoint
CREATE TABLE "Post" (
	"unitId" uuid PRIMARY KEY,
	"authorUserId" uuid NOT NULL,
	"scoreEntryId" uuid,
	"kind" "PostKind",
	"replyCount" integer DEFAULT 0 NOT NULL,
	"directReplyCount" integer DEFAULT 0 NOT NULL,
	"lastReplyAt" timestamp(3),
	"isLocked" boolean DEFAULT false NOT NULL,
	"extra" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"state" text,
	"variantUnitId" uuid
);
--> statement-breakpoint
CREATE TABLE "PostPollReference" (
	"postUnitId" uuid,
	"pollUnitId" uuid,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "PostPollReference_pkey" PRIMARY KEY("postUnitId","pollUnitId")
);
--> statement-breakpoint
CREATE TABLE "Realm" (
	"unitId" uuid PRIMARY KEY,
	"isPublic" boolean DEFAULT true NOT NULL,
	"isOfficial" boolean DEFAULT false NOT NULL,
	"memberCount" integer DEFAULT 0 NOT NULL,
	"extra" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"ruleVersion" integer DEFAULT 1 NOT NULL,
	"ruleRequireOnJoin" boolean DEFAULT false NOT NULL,
	"ruleRequireOnPost" boolean DEFAULT false NOT NULL,
	"ruleRequireOnUpdate" boolean DEFAULT true NOT NULL,
	"rulePolicyUpdatedAt" timestamp(3),
	"joinRequiresApproval" boolean DEFAULT false NOT NULL,
	"contentRequiresApproval" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RealmCapabilityGrant" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"realmUnitId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"capability" varchar(96) NOT NULL,
	"state" "GovernanceGrantState" DEFAULT 'ACTIVE'::"GovernanceGrantState" NOT NULL,
	"grantedById" uuid NOT NULL,
	"revokedById" uuid,
	"expiresAt" timestamp(3),
	"revokedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "RealmMember" (
	"realmUnitId" uuid,
	"userId" uuid,
	"roleKey" varchar(32) NOT NULL,
	"joinedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"state" "RealmMemberState" DEFAULT 'ACTIVE'::"RealmMemberState" NOT NULL,
	"onboardingCompletedAt" timestamp(3),
	CONSTRAINT "RealmMember_pkey" PRIMARY KEY("realmUnitId","userId")
);
--> statement-breakpoint
CREATE TABLE "RealmRuleAcknowledgement" (
	"realmUnitId" uuid,
	"ruleUnitId" uuid,
	"version" integer,
	"userId" uuid,
	"acceptedLanguage" varchar(16),
	"acceptedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "RealmRuleAcknowledgement_pkey" PRIMARY KEY("realmUnitId","ruleUnitId","version","userId")
);
--> statement-breakpoint
CREATE TABLE "RealmTagApplication" (
	"realmUnitId" uuid,
	"tagUnitId" uuid,
	"unitId" uuid,
	"score" integer DEFAULT 0 NOT NULL,
	"voteCount" integer DEFAULT 0 NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"position" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "RealmTagApplication_pkey" PRIMARY KEY("realmUnitId","tagUnitId","unitId")
);
--> statement-breakpoint
CREATE TABLE "RealmTagApplicationVote" (
	"realmUnitId" uuid,
	"tagUnitId" uuid,
	"unitId" uuid,
	"userId" uuid,
	"value" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "RealmTagApplicationVote_pkey" PRIMARY KEY("realmUnitId","tagUnitId","unitId","userId")
);
--> statement-breakpoint
CREATE TABLE "RealmTagContext" (
	"realmUnitId" uuid,
	"tagUnitId" uuid,
	"contextUnitId" uuid,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "RealmTagContext_pkey" PRIMARY KEY("realmUnitId","tagUnitId")
);
--> statement-breakpoint
CREATE TABLE "ScoreAggregate" (
	"unitId" uuid,
	"realm" uuid,
	"totalScore" integer DEFAULT 0 NOT NULL,
	"totalCount" integer DEFAULT 0 NOT NULL,
	"distribution" jsonb NOT NULL,
	"fields" jsonb,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "ScoreAggregate_pkey" PRIMARY KEY("unitId","realm")
);
--> statement-breakpoint
CREATE TABLE "ScoreEntry" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userId" uuid NOT NULL,
	"unitId" uuid NOT NULL,
	"realm" uuid NOT NULL,
	"value" integer NOT NULL,
	"fields" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ScoreRealmField" (
	"realm" uuid,
	"key" varchar(64),
	"label" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "ScoreRealmField_pkey" PRIMARY KEY("realm","key")
);
--> statement-breakpoint
CREATE TABLE "Series" (
	"unitId" uuid PRIMARY KEY,
	"kindKey" varchar(64) NOT NULL,
	"extra" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SeriesContentIndex" (
	"seriesUnitId" uuid,
	"releaseUnitId" uuid,
	"contentNodeId" uuid,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "SeriesContentIndex_pkey" PRIMARY KEY("seriesUnitId","releaseUnitId","contentNodeId")
);
--> statement-breakpoint
CREATE TABLE "Shelf" (
	"unitId" uuid PRIMARY KEY,
	"kindKey" varchar(64),
	"extra" jsonb,
	"itemCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ShelfUnit" (
	"shelfId" uuid,
	"unitId" uuid,
	"kind" varchar(32) NOT NULL,
	"position" varchar(64) NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"variantUnitId" uuid,
	CONSTRAINT "ShelfUnit_pkey" PRIMARY KEY("shelfId","unitId")
);
--> statement-breakpoint
CREATE TABLE "ShelfUnitRelation" (
	"shelfId" uuid,
	"parentUnitId" uuid,
	"childUnitId" uuid,
	"role" varchar(32),
	CONSTRAINT "ShelfUnitRelation_pkey" PRIMARY KEY("shelfId","parentUnitId","childUnitId","role")
);
--> statement-breakpoint
CREATE TABLE "SlugScope" (
	"slug" text PRIMARY KEY,
	"unitId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SourceSite" (
	"entityUnitId" uuid PRIMARY KEY,
	"key" varchar(64) NOT NULL,
	"crawlSupport" varchar(32) NOT NULL,
	"crawlEnabled" boolean DEFAULT false NOT NULL,
	"crawlerAdapterKey" varchar(64),
	"refRules" jsonb NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StaffAuditLog" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"actorUserId" uuid NOT NULL,
	"action" varchar(128) NOT NULL,
	"targetKind" varchar(64) NOT NULL,
	"targetId" varchar(128) NOT NULL,
	"decisionCode" varchar(64) NOT NULL,
	"requestId" varchar(128),
	"reason" text NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StaffGrant" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"userId" uuid NOT NULL,
	"capability" varchar(96) NOT NULL,
	"scopeKind" varchar(32) DEFAULT 'global' NOT NULL,
	"realmUnitId" uuid,
	"state" "GovernanceGrantState" DEFAULT 'ACTIVE'::"GovernanceGrantState" NOT NULL,
	"grantedById" uuid NOT NULL,
	"revokedById" uuid,
	"expiresAt" timestamp(3),
	"revokedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SubjectAttribution" (
	"unitId" uuid,
	"entityId" uuid,
	"role" varchar(64),
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"weight" double precision,
	CONSTRAINT "SubjectAttribution_pkey" PRIMARY KEY("unitId","entityId","role")
);
--> statement-breakpoint
CREATE TABLE "Subscription" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"subscriberUnitId" uuid NOT NULL,
	"subscribedUnitId" uuid NOT NULL,
	"channels" text[],
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TagVote" (
	"userId" uuid,
	"unitId" uuid,
	"tagUnitId" uuid,
	"value" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "TagVote_pkey" PRIMARY KEY("userId","unitId","tagUnitId")
);
--> statement-breakpoint
CREATE TABLE "Unit" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"type" "UnitType" NOT NULL,
	"slug" text,
	"slugScope" uuid NOT NULL,
	"userId" uuid,
	"defaultLanguage" varchar(16),
	"isLanguageNeutral" boolean DEFAULT false NOT NULL,
	"status" "UnitStatus" DEFAULT 'DRAFT'::"UnitStatus" NOT NULL,
	"visibility" "UnitVisibility" DEFAULT 'PUBLIC'::"UnitVisibility" NOT NULL,
	"rating" "ContentRating" DEFAULT 'GENERAL'::"ContentRating" NOT NULL,
	"extra" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"publishedAt" timestamp(3),
	"subscriberCount" integer DEFAULT 0 NOT NULL,
	"licenseSlug" text,
	"aiDisclosureMode" "AiDisclosureMode" DEFAULT 'UNKNOWN'::"AiDisclosureMode" NOT NULL,
	"aiDisclosureDetails" jsonb,
	"catalogEntryKind" "CatalogEntryKind",
	"targetUnitId" uuid,
	"moderationStatus" "ModerationStatus" DEFAULT 'APPROVED'::"ModerationStatus" NOT NULL,
	CONSTRAINT "Unit_series_catalogEntryKind_check" CHECK (((type <> 'SERIES'::"UnitType") OR ("catalogEntryKind" IS NULL))),
	CONSTRAINT "Unit_variant_targetUnitId_check" CHECK ((("catalogEntryKind" <> 'VARIANT'::"CatalogEntryKind") OR ("targetUnitId" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "UnitAlias" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unitId" uuid NOT NULL,
	"value" text NOT NULL,
	"normalizedValue" text NOT NULL,
	"language" varchar(16),
	"kind" "UnitAliasKind" DEFAULT 'COMMON'::"UnitAliasKind" NOT NULL,
	"status" "UnitAliasStatus" DEFAULT 'ACTIVE'::"UnitAliasStatus" NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"voteCount" integer DEFAULT 0 NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"position" text,
	"createdById" uuid,
	"updatedById" uuid,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UnitAliasVote" (
	"aliasId" uuid,
	"userId" uuid,
	"value" integer NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "UnitAliasVote_pkey" PRIMARY KEY("aliasId","userId")
);
--> statement-breakpoint
CREATE TABLE "UnitCollaborator" (
	"unitId" uuid,
	"userId" uuid,
	"roleKey" varchar(32) NOT NULL,
	"addedById" uuid NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "UnitCollaborator_pkey" PRIMARY KEY("unitId","userId")
);
--> statement-breakpoint
CREATE TABLE "UnitExternalRef" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"unitId" uuid NOT NULL,
	"sourceSiteEntityUnitId" uuid NOT NULL,
	"externalKind" varchar(64) NOT NULL,
	"externalId" text NOT NULL,
	"canonicalUrl" text NOT NULL,
	"originalUrl" text,
	"firstSeenAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lastSeenAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UnitFieldLock" (
	"unitId" uuid,
	"path" varchar(256),
	"lockedById" uuid NOT NULL,
	"reason" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "UnitFieldLock_pkey" PRIMARY KEY("unitId","path")
);
--> statement-breakpoint
CREATE TABLE "UnitHistoryClock" (
	"unitId" uuid PRIMARY KEY,
	"nextSequence" bigint DEFAULT 1 NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UnitRealm" (
	"realmUnitId" uuid,
	"unitId" uuid,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"isLocked" boolean DEFAULT false NOT NULL,
	"moderationStatus" "ModerationStatus" DEFAULT 'APPROVED'::"ModerationStatus" NOT NULL,
	CONSTRAINT "UnitRealm_pkey" PRIMARY KEY("realmUnitId","unitId")
);
--> statement-breakpoint
CREATE TABLE "UnitSupportLanguage" (
	"unitId" uuid,
	"language" varchar(16),
	"isPrimary" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "UnitSupportLanguage_pkey" PRIMARY KEY("unitId","language")
);
--> statement-breakpoint
CREATE TABLE "UnitTag" (
	"unitId" uuid,
	"tagUnitId" uuid,
	"score" integer DEFAULT 0 NOT NULL,
	"voteCount" integer DEFAULT 0 NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"position" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "UnitTag_pkey" PRIMARY KEY("unitId","tagUnitId")
);
--> statement-breakpoint
CREATE TABLE "UnitTranslation" (
	"unitId" uuid,
	"language" varchar(16),
	"title" text,
	"subtitle" text,
	"summary" text,
	"description" jsonb,
	"extra" jsonb,
	"sourceUnitId" uuid,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "UnitTranslation_pkey" PRIMARY KEY("unitId","language")
);
--> statement-breakpoint
CREATE TABLE "User" (
	"unitId" uuid PRIMARY KEY,
	"authUserId" uuid,
	"email" varchar(320),
	"name" text,
	"avatar" text,
	"bio" text,
	"description" jsonb,
	"joinDate" timestamp(3),
	"permission" jsonb,
	"followersCount" integer DEFAULT 0 NOT NULL,
	"followingsCount" integer DEFAULT 0 NOT NULL,
	"settings" jsonb,
	"extra" jsonb,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserBlock" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"blockerId" uuid NOT NULL,
	"blockedId" uuid NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserContentNodeProgress" (
	"userId" uuid,
	"nodeId" uuid,
	"completedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "UserContentNodeProgress_pkey" PRIMARY KEY("userId","nodeId")
);
--> statement-breakpoint
CREATE TABLE "UserTagApplication" (
	"userId" uuid,
	"unitId" uuid,
	"tagUnitId" uuid,
	"position" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "UserTagApplication_pkey" PRIMARY KEY("userId","unitId","tagUnitId")
);
--> statement-breakpoint
CREATE TABLE "UserUnitCollection" (
	"userId" uuid,
	"unitId" uuid,
	"searchText" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	CONSTRAINT "UserUnitCollection_pkey" PRIMARY KEY("userId","unitId")
);
--> statement-breakpoint
CREATE TABLE "UserUnitProgress" (
	"userId" uuid,
	"unitId" uuid,
	"progress" double precision DEFAULT 0 NOT NULL,
	"status" "UserUnitProgressStatus" DEFAULT 'BACKLOG'::"UserUnitProgressStatus" NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"completedCount" integer DEFAULT 0 NOT NULL,
	"totalTimeMs" bigint DEFAULT 0 NOT NULL,
	"extra" jsonb,
	"firstSeenAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lastSeenAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lastReadNodeId" uuid,
	"lastReadAnchor" jsonb,
	CONSTRAINT "UserUnitProgress_pkey" PRIMARY KEY("userId","unitId")
);
--> statement-breakpoint
CREATE TABLE "Zone" (
	"unitId" uuid PRIMARY KEY,
	"filters" jsonb NOT NULL,
	"template" varchar(64) NOT NULL,
	"styling" jsonb,
	"startsAt" timestamp(3),
	"endsAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"wiki" jsonb
);
--> statement-breakpoint
CREATE INDEX "AccountEnforcement_decidedById_createdAt_idx" ON "AccountEnforcement" ("decidedById","createdAt");--> statement-breakpoint
CREATE INDEX "AccountEnforcement_decisionActionId_idx" ON "AccountEnforcement" ("decisionActionId");--> statement-breakpoint
CREATE INDEX "AccountEnforcement_kind_state_createdAt_idx" ON "AccountEnforcement" ("kind","state","createdAt");--> statement-breakpoint
CREATE INDEX "AccountEnforcement_revocationActionId_idx" ON "AccountEnforcement" ("revocationActionId");--> statement-breakpoint
CREATE INDEX "AccountEnforcement_revokedById_idx" ON "AccountEnforcement" ("revokedById");--> statement-breakpoint
CREATE INDEX "AccountEnforcement_targetUserId_state_kind_expiresAt_idx" ON "AccountEnforcement" ("targetUserId","state","kind","expiresAt");--> statement-breakpoint
CREATE INDEX "ApiToken_expiresAt_idx" ON "ApiToken" ("expiresAt");--> statement-breakpoint
CREATE INDEX "ApiToken_tokenHash_idx" ON "ApiToken" ("tokenHash");--> statement-breakpoint
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken" ("tokenHash");--> statement-breakpoint
CREATE INDEX "ApiToken_userId_idx" ON "ApiToken" ("userId");--> statement-breakpoint
CREATE INDEX "Book_isbn13_idx" ON "Book" ("isbn13");--> statement-breakpoint
CREATE INDEX "Book_publicationDate_idx" ON "Book" ("publicationDate");--> statement-breakpoint
CREATE INDEX "Comment_authorUserId_createdAt_idx" ON "Comment" ("authorUserId","createdAt");--> statement-breakpoint
CREATE INDEX "Comment_deletedAt_idx" ON "Comment" ("deletedAt");--> statement-breakpoint
CREATE INDEX "Comment_moderationStatus_idx" ON "Comment" ("moderationStatus");--> statement-breakpoint
CREATE INDEX "Comment_parentCommentId_createdAt_idx" ON "Comment" ("parentCommentId","createdAt");--> statement-breakpoint
CREATE INDEX "Comment_path_gist_idx" ON "Comment" USING gist ("path");--> statement-breakpoint
CREATE INDEX "Comment_rootUnitId_realmUnitId_createdAt_idx" ON "Comment" ("rootUnitId","realmUnitId","createdAt");--> statement-breakpoint
CREATE INDEX "Comment_rootUnitId_realmUnitId_parentCommentId_createdAt_idx" ON "Comment" ("rootUnitId","realmUnitId","parentCommentId","createdAt");--> statement-breakpoint
CREATE INDEX "Comment_state_idx" ON "Comment" ("state");--> statement-breakpoint
CREATE INDEX "CommentPromotion_commentId_idx" ON "CommentPromotion" ("commentId");--> statement-breakpoint
CREATE INDEX "CommentPromotion_scopeUnitId_kind_position_idx" ON "CommentPromotion" ("scopeUnitId","kind","position");--> statement-breakpoint
CREATE INDEX "ContentStructure_updatedAt_idx" ON "ContentStructure" ("updatedAt" DESC);--> statement-breakpoint
CREATE INDEX "ContentStructureAnchor_contentUnitId_ownerUnitId_idx" ON "ContentStructureAnchor" ("contentUnitId","ownerUnitId");--> statement-breakpoint
CREATE INDEX "ContentStructureAnchor_ownerUnitId_depth_idx" ON "ContentStructureAnchor" ("ownerUnitId","depth");--> statement-breakpoint
CREATE INDEX "ContentStructureAnchor_ownerUnitId_parentNodeId_position_idx" ON "ContentStructureAnchor" ("ownerUnitId","parentNodeId","position");--> statement-breakpoint
CREATE INDEX "ContentStructureAnchor_ownerUnitId_positionPath_idx" ON "ContentStructureAnchor" ("ownerUnitId","positionPath");--> statement-breakpoint
CREATE INDEX "ContentStructureNode_contentUnitId_idx" ON "ContentStructureNode" ("contentUnitId");--> statement-breakpoint
CREATE INDEX "ContentStructureNode_ownerUnitId_isDeleted_updatedAt_idx" ON "ContentStructureNode" ("ownerUnitId","isDeleted","updatedAt" DESC);--> statement-breakpoint
CREATE INDEX "ContentStructureNode_ownerUnitId_parentId_position_isDelete_idx" ON "ContentStructureNode" ("ownerUnitId","parentId","position","isDeleted");--> statement-breakpoint
CREATE INDEX "ContentStructureNode_ownerUnitId_updatedAt_idx" ON "ContentStructureNode" ("ownerUnitId","updatedAt" DESC);--> statement-breakpoint
CREATE INDEX "ContentTranslation_authorUserId_idx" ON "ContentTranslation" ("authorUserId");--> statement-breakpoint
CREATE INDEX "ContentTranslation_language_status_idx" ON "ContentTranslation" ("language","status");--> statement-breakpoint
CREATE INDEX "ContentTranslation_sourceUnitId_idx" ON "ContentTranslation" ("sourceUnitId");--> statement-breakpoint
CREATE INDEX "ContentTranslation_status_updatedAt_idx" ON "ContentTranslation" ("status","updatedAt");--> statement-breakpoint
CREATE INDEX "CreditAttribution_entityId_role_idx" ON "CreditAttribution" ("entityId","role");--> statement-breakpoint
CREATE INDEX "CreditAttribution_unitId_role_sortOrder_idx" ON "CreditAttribution" ("unitId","role","sortOrder");--> statement-breakpoint
CREATE INDEX "CreditAttributionEvidence_sourceRefId_idx" ON "CreditAttributionEvidence" ("sourceRefId");--> statement-breakpoint
CREATE INDEX "CreditAttributionEvidence_unitId_entityId_role_idx" ON "CreditAttributionEvidence" ("unitId","entityId","role");--> statement-breakpoint
CREATE UNIQUE INDEX "EmailVerificationContract_contractName_ownerId_email_key" ON "EmailVerificationContract" ("contractName","ownerId","email");--> statement-breakpoint
CREATE INDEX "EmailVerificationContract_contractName_ownerId_status_idx" ON "EmailVerificationContract" ("contractName","ownerId","status");--> statement-breakpoint
CREATE INDEX "EmailVerificationContract_email_idx" ON "EmailVerificationContract" ("email");--> statement-breakpoint
CREATE INDEX "Feedback_addressedUnitId_idx" ON "Feedback" ("addressedUnitId");--> statement-breakpoint
CREATE INDEX "Feedback_resolved_idx" ON "Feedback" ("resolved");--> statement-breakpoint
CREATE INDEX "Feedback_targetKind_targetId_idx" ON "Feedback" ("targetKind","targetId");--> statement-breakpoint
CREATE INDEX "Feedback_type_idx" ON "Feedback" ("type");--> statement-breakpoint
CREATE INDEX "Feedback_userId_idx" ON "Feedback" ("userId");--> statement-breakpoint
CREATE INDEX "GameSystemRequirement_gameUnitId_idx" ON "GameSystemRequirement" ("gameUnitId");--> statement-breakpoint
CREATE INDEX "GameSystemRequirement_gameUnitId_platformEntityId_tier_sour_idx" ON "GameSystemRequirement" ("gameUnitId","platformEntityId","tier","sourceRefId");--> statement-breakpoint
CREATE INDEX "GameSystemRequirement_platformEntityId_idx" ON "GameSystemRequirement" ("platformEntityId");--> statement-breakpoint
CREATE INDEX "GameSystemRequirement_sourceRefId_idx" ON "GameSystemRequirement" ("sourceRefId");--> statement-breakpoint
CREATE INDEX "GameSystemRequirement_tier_idx" ON "GameSystemRequirement" ("tier");--> statement-breakpoint
CREATE INDEX "HistoryOutbox_actorUserId_createdAt_idx" ON "HistoryOutbox" ("actorUserId","createdAt");--> statement-breakpoint
CREATE INDEX "HistoryOutbox_processedById_idx" ON "HistoryOutbox" ("processedById");--> statement-breakpoint
CREATE INDEX "HistoryOutbox_status_nextAttemptAt_createdAt_idx" ON "HistoryOutbox" ("status","nextAttemptAt","createdAt");--> statement-breakpoint
CREATE INDEX "HistoryOutbox_unitId_createdAt_idx" ON "HistoryOutbox" ("unitId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "HistoryOutbox_unitId_sequence_key" ON "HistoryOutbox" ("unitId","sequence");--> statement-breakpoint
CREATE INDEX "Jwks_jwtServiceId_idx" ON "Jwks" ("jwtServiceId");--> statement-breakpoint
CREATE INDEX "JwtService_isLocalIssuer_isActive_idx" ON "JwtService" ("isLocalIssuer","isActive");--> statement-breakpoint
CREATE UNIQUE INDEX "JwtService_issuer_audience_key" ON "JwtService" ("issuer","audience");--> statement-breakpoint
CREATE UNIQUE INDEX "JwtService_serviceKey_key" ON "JwtService" ("serviceKey");--> statement-breakpoint
CREATE INDEX "Media_kindKey_releaseDate_idx" ON "Media" ("kindKey","releaseDate");--> statement-breakpoint
CREATE INDEX "ModerationAction_actionKind_createdAt_id_idx" ON "ModerationAction" ("actionKind","createdAt","id");--> statement-breakpoint
CREATE INDEX "ModerationAction_actorUserId_createdAt_id_idx" ON "ModerationAction" ("actorUserId","createdAt","id");--> statement-breakpoint
CREATE INDEX "ModerationAction_caseId_createdAt_id_idx" ON "ModerationAction" ("caseId","createdAt","id");--> statement-breakpoint
CREATE UNIQUE INDEX "ModerationAction_idempotencyKey_key" ON "ModerationAction" ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "ModerationAction_realmUnitId_createdAt_id_idx" ON "ModerationAction" ("realmUnitId","createdAt","id");--> statement-breakpoint
CREATE INDEX "ModerationAction_requestId_idx" ON "ModerationAction" ("requestId");--> statement-breakpoint
CREATE INDEX "ModerationAction_targetKind_targetId_actionKind_createdAt_i_idx" ON "ModerationAction" ("targetKind","targetId","actionKind","createdAt","id");--> statement-breakpoint
CREATE INDEX "ModerationAction_targetKind_targetId_createdAt_id_idx" ON "ModerationAction" ("targetKind","targetId","createdAt","id");--> statement-breakpoint
CREATE INDEX "ModerationCase_addressedUnitId_state_idx" ON "ModerationCase" ("addressedUnitId","state");--> statement-breakpoint
CREATE INDEX "ModerationCase_assignedToUserId_state_createdAt_idx" ON "ModerationCase" ("assignedToUserId","state","createdAt");--> statement-breakpoint
CREATE INDEX "ModerationCase_duplicateOfCaseId_idx" ON "ModerationCase" ("duplicateOfCaseId");--> statement-breakpoint
CREATE INDEX "ModerationCase_parentCaseId_idx" ON "ModerationCase" ("parentCaseId");--> statement-breakpoint
CREATE INDEX "ModerationCase_realmUnitId_state_createdAt_idx" ON "ModerationCase" ("realmUnitId","state","createdAt");--> statement-breakpoint
CREATE INDEX "ModerationCase_reporterUserId_createdAt_idx" ON "ModerationCase" ("reporterUserId","createdAt");--> statement-breakpoint
CREATE INDEX "ModerationCase_scope_state_createdAt_idx" ON "ModerationCase" ("scope","state","createdAt");--> statement-breakpoint
CREATE INDEX "ModerationCase_sourceFeedbackId_idx" ON "ModerationCase" ("sourceFeedbackId");--> statement-breakpoint
CREATE INDEX "ModerationCase_state_severity_createdAt_idx" ON "ModerationCase" ("state","severity","createdAt");--> statement-breakpoint
CREATE INDEX "ModerationCase_subjectUserId_state_createdAt_idx" ON "ModerationCase" ("subjectUserId","state","createdAt");--> statement-breakpoint
CREATE INDEX "ModerationCase_targetKind_targetId_idx" ON "ModerationCase" ("targetKind","targetId");--> statement-breakpoint
CREATE INDEX "PollOption_pollUnitId_position_idx" ON "PollOption" ("pollUnitId","position");--> statement-breakpoint
CREATE INDEX "PollOption_unitId_idx" ON "PollOption" ("unitId");--> statement-breakpoint
CREATE INDEX "PollVote_pollUnitId_optionId_idx" ON "PollVote" ("pollUnitId","optionId");--> statement-breakpoint
CREATE INDEX "PollVote_pollUnitId_realmUnitId_optionId_idx" ON "PollVote" ("pollUnitId","realmUnitId","optionId");--> statement-breakpoint
CREATE INDEX "PollVote_pollUnitId_userId_idx" ON "PollVote" ("pollUnitId","userId");--> statement-breakpoint
CREATE UNIQUE INDEX "PollVote_pollUnitId_userId_optionId_key" ON "PollVote" ("pollUnitId","userId","optionId");--> statement-breakpoint
CREATE UNIQUE INDEX "PollVote_single_choice_uniq" ON "PollVote" ("pollUnitId","userId") WHERE ("voteMode" = 'SINGLE'::"PollVoteMode");--> statement-breakpoint
CREATE INDEX "PollVote_userId_idx" ON "PollVote" ("userId");--> statement-breakpoint
CREATE INDEX "Post_authorUserId_createdAt_idx" ON "Post" ("authorUserId","createdAt");--> statement-breakpoint
CREATE INDEX "Post_kind_createdAt_idx" ON "Post" ("kind","createdAt");--> statement-breakpoint
CREATE INDEX "Post_scoreEntryId_idx" ON "Post" ("scoreEntryId");--> statement-breakpoint
CREATE INDEX "Post_variantUnitId_idx" ON "Post" ("variantUnitId");--> statement-breakpoint
CREATE INDEX "PostPollReference_pollUnitId_idx" ON "PostPollReference" ("pollUnitId");--> statement-breakpoint
CREATE INDEX "PostPollReference_postUnitId_idx" ON "PostPollReference" ("postUnitId");--> statement-breakpoint
CREATE INDEX "RealmCapabilityGrant_grantedById_createdAt_idx" ON "RealmCapabilityGrant" ("grantedById","createdAt");--> statement-breakpoint
CREATE INDEX "RealmCapabilityGrant_realmUnitId_capability_state_idx" ON "RealmCapabilityGrant" ("realmUnitId","capability","state");--> statement-breakpoint
CREATE INDEX "RealmCapabilityGrant_realmUnitId_userId_state_idx" ON "RealmCapabilityGrant" ("realmUnitId","userId","state");--> statement-breakpoint
CREATE INDEX "RealmCapabilityGrant_revokedById_idx" ON "RealmCapabilityGrant" ("revokedById");--> statement-breakpoint
CREATE INDEX "RealmCapabilityGrant_userId_capability_state_idx" ON "RealmCapabilityGrant" ("userId","capability","state");--> statement-breakpoint
CREATE INDEX "RealmMember_realmUnitId_roleKey_idx" ON "RealmMember" ("realmUnitId","roleKey");--> statement-breakpoint
CREATE INDEX "RealmMember_realmUnitId_state_idx" ON "RealmMember" ("realmUnitId","state");--> statement-breakpoint
CREATE INDEX "RealmMember_userId_idx" ON "RealmMember" ("userId");--> statement-breakpoint
CREATE INDEX "RealmRuleAcknowledgement_realmUnitId_userId_acceptedAt_idx" ON "RealmRuleAcknowledgement" ("realmUnitId","userId","acceptedAt");--> statement-breakpoint
CREATE INDEX "RealmRuleAcknowledgement_userId_acceptedAt_idx" ON "RealmRuleAcknowledgement" ("userId","acceptedAt");--> statement-breakpoint
CREATE INDEX "RealmTagApplication_realmUnitId_unitId_idx" ON "RealmTagApplication" ("realmUnitId","unitId");--> statement-breakpoint
CREATE INDEX "RealmTagApplication_realmUnitId_unitId_pinned_position_idx" ON "RealmTagApplication" ("realmUnitId","unitId","pinned","position");--> statement-breakpoint
CREATE INDEX "RealmTagApplication_score_idx" ON "RealmTagApplication" ("score");--> statement-breakpoint
CREATE INDEX "RealmTagApplication_tagUnitId_realmUnitId_idx" ON "RealmTagApplication" ("tagUnitId","realmUnitId");--> statement-breakpoint
CREATE INDEX "RealmTagApplication_unitId_realmUnitId_idx" ON "RealmTagApplication" ("unitId","realmUnitId");--> statement-breakpoint
CREATE INDEX "RealmTagApplicationVote_userId_idx" ON "RealmTagApplicationVote" ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "RealmTagContext_contextUnitId_key" ON "RealmTagContext" ("contextUnitId");--> statement-breakpoint
CREATE INDEX "RealmTagContext_tagUnitId_idx" ON "RealmTagContext" ("tagUnitId");--> statement-breakpoint
CREATE INDEX "ScoreEntry_unitId_realm_idx" ON "ScoreEntry" ("unitId","realm");--> statement-breakpoint
CREATE INDEX "ScoreEntry_userId_unitId_idx" ON "ScoreEntry" ("userId","unitId");--> statement-breakpoint
CREATE UNIQUE INDEX "ScoreEntry_userId_unitId_realm_key" ON "ScoreEntry" ("userId","unitId","realm");--> statement-breakpoint
CREATE INDEX "ScoreRealmField_realm_sortOrder_idx" ON "ScoreRealmField" ("realm","sortOrder");--> statement-breakpoint
CREATE INDEX "Series_kindKey_idx" ON "Series" ("kindKey");--> statement-breakpoint
CREATE INDEX "Series_updatedAt_idx" ON "Series" ("updatedAt" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "SeriesContentIndex_contentNodeId_key" ON "SeriesContentIndex" ("contentNodeId");--> statement-breakpoint
CREATE INDEX "SeriesContentIndex_releaseUnitId_seriesUnitId_idx" ON "SeriesContentIndex" ("releaseUnitId","seriesUnitId");--> statement-breakpoint
CREATE INDEX "SeriesContentIndex_seriesUnitId_releaseUnitId_idx" ON "SeriesContentIndex" ("seriesUnitId","releaseUnitId");--> statement-breakpoint
CREATE INDEX "ShelfUnit_shelfId_position_idx" ON "ShelfUnit" ("shelfId","position");--> statement-breakpoint
CREATE INDEX "ShelfUnit_variantUnitId_idx" ON "ShelfUnit" ("variantUnitId");--> statement-breakpoint
CREATE INDEX "ShelfUnitRelation_childUnitId_role_idx" ON "ShelfUnitRelation" ("childUnitId","role");--> statement-breakpoint
CREATE INDEX "ShelfUnitRelation_parentUnitId_role_idx" ON "ShelfUnitRelation" ("parentUnitId","role");--> statement-breakpoint
CREATE INDEX "ShelfUnitRelation_shelfId_childUnitId_idx" ON "ShelfUnitRelation" ("shelfId","childUnitId");--> statement-breakpoint
CREATE INDEX "ShelfUnitRelation_shelfId_parentUnitId_role_idx" ON "ShelfUnitRelation" ("shelfId","parentUnitId","role");--> statement-breakpoint
CREATE UNIQUE INDEX "SlugScope_unitId_key" ON "SlugScope" ("unitId");--> statement-breakpoint
CREATE INDEX "SourceSite_crawlSupport_crawlEnabled_idx" ON "SourceSite" ("crawlSupport","crawlEnabled");--> statement-breakpoint
CREATE UNIQUE INDEX "SourceSite_key_key" ON "SourceSite" ("key");--> statement-breakpoint
CREATE INDEX "StaffAuditLog_action_createdAt_idx" ON "StaffAuditLog" ("action","createdAt");--> statement-breakpoint
CREATE INDEX "StaffAuditLog_actorUserId_createdAt_idx" ON "StaffAuditLog" ("actorUserId","createdAt");--> statement-breakpoint
CREATE INDEX "StaffAuditLog_decisionCode_createdAt_idx" ON "StaffAuditLog" ("decisionCode","createdAt");--> statement-breakpoint
CREATE INDEX "StaffAuditLog_requestId_idx" ON "StaffAuditLog" ("requestId");--> statement-breakpoint
CREATE INDEX "StaffAuditLog_targetKind_targetId_createdAt_idx" ON "StaffAuditLog" ("targetKind","targetId","createdAt");--> statement-breakpoint
CREATE INDEX "StaffGrant_capability_scopeKind_realmUnitId_idx" ON "StaffGrant" ("capability","scopeKind","realmUnitId");--> statement-breakpoint
CREATE INDEX "StaffGrant_grantedById_createdAt_idx" ON "StaffGrant" ("grantedById","createdAt");--> statement-breakpoint
CREATE INDEX "StaffGrant_revokedById_idx" ON "StaffGrant" ("revokedById");--> statement-breakpoint
CREATE INDEX "StaffGrant_userId_state_expiresAt_idx" ON "StaffGrant" ("userId","state","expiresAt");--> statement-breakpoint
CREATE INDEX "SubjectAttribution_entityId_role_sortOrder_idx" ON "SubjectAttribution" ("entityId","role","sortOrder");--> statement-breakpoint
CREATE INDEX "SubjectAttribution_entityId_sortOrder_idx" ON "SubjectAttribution" ("entityId","sortOrder");--> statement-breakpoint
CREATE INDEX "SubjectAttribution_unitId_role_sortOrder_idx" ON "SubjectAttribution" ("unitId","role","sortOrder");--> statement-breakpoint
CREATE INDEX "subscription_channels_gin" ON "Subscription" USING gin ("channels");--> statement-breakpoint
CREATE INDEX "Subscription_subscribedUnitId_idx" ON "Subscription" ("subscribedUnitId");--> statement-breakpoint
CREATE INDEX "Subscription_subscriberUnitId_idx" ON "Subscription" ("subscriberUnitId");--> statement-breakpoint
CREATE UNIQUE INDEX "Subscription_subscriberUnitId_subscribedUnitId_key" ON "Subscription" ("subscriberUnitId","subscribedUnitId");--> statement-breakpoint
CREATE INDEX "TagVote_unitId_tagUnitId_idx" ON "TagVote" ("unitId","tagUnitId");--> statement-breakpoint
CREATE INDEX "Unit_catalogEntryKind_targetUnitId_idx" ON "Unit" ("catalogEntryKind","targetUnitId");--> statement-breakpoint
CREATE INDEX "Unit_defaultLanguage_idx" ON "Unit" ("defaultLanguage");--> statement-breakpoint
CREATE INDEX "Unit_moderationStatus_idx" ON "Unit" ("moderationStatus");--> statement-breakpoint
CREATE UNIQUE INDEX "Unit_slugScope_slug_key" ON "Unit" ("slugScope","slug");--> statement-breakpoint
CREATE INDEX "Unit_slugScope_type_idx" ON "Unit" ("slugScope","type");--> statement-breakpoint
CREATE INDEX "Unit_status_visibility_idx" ON "Unit" ("status","visibility");--> statement-breakpoint
CREATE INDEX "Unit_targetUnitId_idx" ON "Unit" ("targetUnitId");--> statement-breakpoint
CREATE INDEX "Unit_type_status_createdAt_idx" ON "Unit" ("type","status","createdAt");--> statement-breakpoint
CREATE INDEX "Unit_userId_createdAt_idx" ON "Unit" ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "UnitAlias_createdById_createdAt_idx" ON "UnitAlias" ("createdById","createdAt");--> statement-breakpoint
CREATE INDEX "UnitAlias_normalizedValue_idx" ON "UnitAlias" ("normalizedValue");--> statement-breakpoint
CREATE INDEX "UnitAlias_status_score_idx" ON "UnitAlias" ("status","score");--> statement-breakpoint
CREATE UNIQUE INDEX "UnitAlias_unitId_normalizedValue_key" ON "UnitAlias" ("unitId","normalizedValue");--> statement-breakpoint
CREATE INDEX "UnitAlias_unitId_pinned_position_idx" ON "UnitAlias" ("unitId","pinned","position");--> statement-breakpoint
CREATE INDEX "UnitAlias_unitId_status_score_idx" ON "UnitAlias" ("unitId","status","score");--> statement-breakpoint
CREATE INDEX "UnitAliasVote_userId_idx" ON "UnitAliasVote" ("userId");--> statement-breakpoint
CREATE INDEX "UnitCollaborator_unitId_roleKey_idx" ON "UnitCollaborator" ("unitId","roleKey");--> statement-breakpoint
CREATE INDEX "UnitCollaborator_userId_roleKey_idx" ON "UnitCollaborator" ("userId","roleKey");--> statement-breakpoint
CREATE UNIQUE INDEX "UnitExternalRef_sourceSiteEntityUnitId_externalKind_externa_key" ON "UnitExternalRef" ("sourceSiteEntityUnitId","externalKind","externalId");--> statement-breakpoint
CREATE INDEX "UnitExternalRef_sourceSiteEntityUnitId_externalKind_idx" ON "UnitExternalRef" ("sourceSiteEntityUnitId","externalKind");--> statement-breakpoint
CREATE INDEX "UnitExternalRef_unitId_sourceSiteEntityUnitId_externalKind_idx" ON "UnitExternalRef" ("unitId","sourceSiteEntityUnitId","externalKind");--> statement-breakpoint
CREATE INDEX "UnitFieldLock_lockedById_createdAt_idx" ON "UnitFieldLock" ("lockedById","createdAt");--> statement-breakpoint
CREATE INDEX "UnitRealm_realmUnitId_createdAt_idx" ON "UnitRealm" ("realmUnitId","createdAt");--> statement-breakpoint
CREATE INDEX "UnitRealm_realmUnitId_moderationStatus_createdAt_idx" ON "UnitRealm" ("realmUnitId","moderationStatus","createdAt");--> statement-breakpoint
CREATE INDEX "UnitRealm_realmUnitId_moderationStatus_isLocked_createdAt_idx" ON "UnitRealm" ("realmUnitId","moderationStatus","isLocked","createdAt");--> statement-breakpoint
CREATE INDEX "UnitRealm_unitId_idx" ON "UnitRealm" ("unitId");--> statement-breakpoint
CREATE INDEX "UnitSupportLanguage_language_unitId_idx" ON "UnitSupportLanguage" ("language","unitId");--> statement-breakpoint
CREATE INDEX "UnitTag_tagUnitId_score_idx" ON "UnitTag" ("tagUnitId","score");--> statement-breakpoint
CREATE INDEX "UnitTag_unitId_pinned_position_idx" ON "UnitTag" ("unitId","pinned","position");--> statement-breakpoint
CREATE INDEX "UnitTag_unitId_score_idx" ON "UnitTag" ("unitId","score");--> statement-breakpoint
CREATE INDEX "UnitTranslation_language_title_idx" ON "UnitTranslation" ("language","title");--> statement-breakpoint
CREATE UNIQUE INDEX "User_authUserId_key" ON "User" ("authUserId");--> statement-breakpoint
CREATE INDEX "User_email_idx" ON "User" ("email");--> statement-breakpoint
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock" ("blockedId");--> statement-breakpoint
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock" ("blockerId","blockedId");--> statement-breakpoint
CREATE INDEX "UserBlock_blockerId_idx" ON "UserBlock" ("blockerId");--> statement-breakpoint
CREATE INDEX "UserContentNodeProgress_nodeId_idx" ON "UserContentNodeProgress" ("nodeId");--> statement-breakpoint
CREATE INDEX "UserTagApplication_userId_tagUnitId_unitId_idx" ON "UserTagApplication" ("userId","tagUnitId","unitId");--> statement-breakpoint
CREATE INDEX "UserTagApplication_userId_unitId_idx" ON "UserTagApplication" ("userId","unitId");--> statement-breakpoint
CREATE INDEX "UserTagApplication_userId_unitId_position_idx" ON "UserTagApplication" ("userId","unitId","position");--> statement-breakpoint
CREATE INDEX "UserUnitCollection_unitId_idx" ON "UserUnitCollection" ("unitId");--> statement-breakpoint
CREATE INDEX "UserUnitCollection_userId_updatedAt_idx" ON "UserUnitCollection" ("userId","updatedAt");--> statement-breakpoint
CREATE INDEX "UserUnitProgress_lastReadNodeId_idx" ON "UserUnitProgress" ("lastReadNodeId");--> statement-breakpoint
CREATE INDEX "UserUnitProgress_unitId_status_idx" ON "UserUnitProgress" ("unitId","status");--> statement-breakpoint
CREATE INDEX "UserUnitProgress_userId_isDeleted_lastSeenAt_idx" ON "UserUnitProgress" ("userId","isDeleted","lastSeenAt" DESC);--> statement-breakpoint
CREATE INDEX "UserUnitProgress_userId_lastSeenAt_idx" ON "UserUnitProgress" ("userId","lastSeenAt" DESC);--> statement-breakpoint
ALTER TABLE "AccountEnforcement" ADD CONSTRAINT "AccountEnforcement_targetUserId_User_unitId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "AccountEnforcement" ADD CONSTRAINT "AccountEnforcement_decidedById_User_unitId_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "AccountEnforcement" ADD CONSTRAINT "AccountEnforcement_revokedById_User_unitId_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "AccountEnforcement" ADD CONSTRAINT "AccountEnforcement_decisionActionId_ModerationAction_id_fkey" FOREIGN KEY ("decisionActionId") REFERENCES "ModerationAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "AccountEnforcement" ADD CONSTRAINT "AccountEnforcement_revocationActionId_ModerationAction_id_fkey" FOREIGN KEY ("revocationActionId") REFERENCES "ModerationAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Book" ADD CONSTRAINT "Book_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_rootUnitId_Unit_id_fkey" FOREIGN KEY ("rootUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_realmUnitId_Unit_id_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorUserId_User_unitId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "CommentPromotion" ADD CONSTRAINT "CommentPromotion_scopeUnitId_Unit_id_fkey" FOREIGN KEY ("scopeUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "CommentPromotion" ADD CONSTRAINT "CommentPromotion_commentId_Comment_id_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ContentStructure" ADD CONSTRAINT "ContentStructure_ownerUnitId_Unit_id_fkey" FOREIGN KEY ("ownerUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ContentStructureAnchor" ADD CONSTRAINT "ContentStructureAnchor_nodeId_ContentStructureNode_id_fkey" FOREIGN KEY ("nodeId") REFERENCES "ContentStructureNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ContentStructureAnchor" ADD CONSTRAINT "ContentStructureAnchor_gELoJtlxOqDA_fkey" FOREIGN KEY ("ownerUnitId") REFERENCES "ContentStructure"("ownerUnitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ContentStructureAnchor" ADD CONSTRAINT "ContentStructureAnchor_contentUnitId_Unit_id_fkey" FOREIGN KEY ("contentUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ContentStructureNode" ADD CONSTRAINT "ContentStructureNode_fs63TGvmKX6x_fkey" FOREIGN KEY ("ownerUnitId") REFERENCES "ContentStructure"("ownerUnitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ContentStructureNode" ADD CONSTRAINT "ContentStructureNode_contentUnitId_Unit_id_fkey" FOREIGN KEY ("contentUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ContentStructureNode" ADD CONSTRAINT "ContentStructureNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ContentStructureNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ContentTranslation" ADD CONSTRAINT "ContentTranslation_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "CreditAttribution" ADD CONSTRAINT "CreditAttribution_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "CreditAttribution" ADD CONSTRAINT "CreditAttribution_entityId_Unit_id_fkey" FOREIGN KEY ("entityId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "CreditAttributionEvidence" ADD CONSTRAINT "CreditAttributionEvidence_sourceRefId_UnitExternalRef_id_fkey" FOREIGN KEY ("sourceRefId") REFERENCES "UnitExternalRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "CreditAttributionEvidence" ADD CONSTRAINT "CreditAttributionEvidence_unitId_entityId_role_fkey" FOREIGN KEY ("unitId","entityId","role") REFERENCES "CreditAttribution"("unitId","entityId","role") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Game" ADD CONSTRAINT "Game_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "GameSystemRequirement" ADD CONSTRAINT "GameSystemRequirement_gameUnitId_Game_unitId_fkey" FOREIGN KEY ("gameUnitId") REFERENCES "Game"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "GameSystemRequirement" ADD CONSTRAINT "GameSystemRequirement_platformEntityId_Unit_id_fkey" FOREIGN KEY ("platformEntityId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "GameSystemRequirement" ADD CONSTRAINT "GameSystemRequirement_sourceRefId_UnitExternalRef_id_fkey" FOREIGN KEY ("sourceRefId") REFERENCES "UnitExternalRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "HistoryOutbox" ADD CONSTRAINT "HistoryOutbox_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "HistoryOutbox" ADD CONSTRAINT "HistoryOutbox_actorUserId_User_unitId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "HistoryOutbox" ADD CONSTRAINT "HistoryOutbox_processedById_User_unitId_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Jwks" ADD CONSTRAINT "Jwks_jwtServiceId_JwtService_id_fkey" FOREIGN KEY ("jwtServiceId") REFERENCES "JwtService"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Link" ADD CONSTRAINT "Link_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Media" ADD CONSTRAINT "Media_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_realmUnitId_Unit_id_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_actorUserId_User_unitId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_caseId_ModerationCase_id_fkey" FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_reversesActionId_fkey" FOREIGN KEY ("reversesActionId") REFERENCES "ModerationAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_reporterUserId_User_unitId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_subjectUserId_User_unitId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_addressedUnitId_Unit_id_fkey" FOREIGN KEY ("addressedUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_realmUnitId_Unit_id_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_sourceFeedbackId_Feedback_id_fkey" FOREIGN KEY ("sourceFeedbackId") REFERENCES "Feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_assignedToUserId_User_unitId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_duplicateOfCaseId_fkey" FOREIGN KEY ("duplicateOfCaseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ModerationCase" ADD CONSTRAINT "ModerationCase_parentCaseId_fkey" FOREIGN KEY ("parentCaseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollUnitId_Poll_unitId_fkey" FOREIGN KEY ("pollUnitId") REFERENCES "Poll"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollUnitId_Poll_unitId_fkey" FOREIGN KEY ("pollUnitId") REFERENCES "Poll"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollUnitId_optionId_fkey" FOREIGN KEY ("pollUnitId","optionId") REFERENCES "PollOption"("pollUnitId","optionId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Post" ADD CONSTRAINT "Post_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Post" ADD CONSTRAINT "Post_scoreEntryId_ScoreEntry_id_fkey" FOREIGN KEY ("scoreEntryId") REFERENCES "ScoreEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Realm" ADD CONSTRAINT "Realm_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmCapabilityGrant" ADD CONSTRAINT "RealmCapabilityGrant_realmUnitId_Realm_unitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmCapabilityGrant" ADD CONSTRAINT "RealmCapabilityGrant_grantedById_User_unitId_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmCapabilityGrant" ADD CONSTRAINT "RealmCapabilityGrant_revokedById_User_unitId_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmCapabilityGrant" ADD CONSTRAINT "RealmCapabilityGrant_realmUnitId_userId_fkey" FOREIGN KEY ("realmUnitId","userId") REFERENCES "RealmMember"("realmUnitId","userId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmMember" ADD CONSTRAINT "RealmMember_realmUnitId_Realm_unitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" ADD CONSTRAINT "RealmRuleAcknowledgement_realmUnitId_Realm_unitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" ADD CONSTRAINT "RealmRuleAcknowledgement_ruleUnitId_Unit_id_fkey" FOREIGN KEY ("ruleUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmRuleAcknowledgement" ADD CONSTRAINT "RealmRuleAcknowledgement_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmTagApplication" ADD CONSTRAINT "RealmTagApplication_realmUnitId_Realm_unitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmTagApplication" ADD CONSTRAINT "RealmTagApplication_tagUnitId_Unit_id_fkey" FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmTagApplication" ADD CONSTRAINT "RealmTagApplication_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmTagApplicationVote" ADD CONSTRAINT "RealmTagApplicationVote_realmUnitId_tagUnitId_unitId_fkey" FOREIGN KEY ("realmUnitId","tagUnitId","unitId") REFERENCES "RealmTagApplication"("realmUnitId","tagUnitId","unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmTagContext" ADD CONSTRAINT "RealmTagContext_realmUnitId_Realm_unitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmTagContext" ADD CONSTRAINT "RealmTagContext_tagUnitId_Unit_id_fkey" FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "RealmTagContext" ADD CONSTRAINT "RealmTagContext_contextUnitId_Unit_id_fkey" FOREIGN KEY ("contextUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Series" ADD CONSTRAINT "Series_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SeriesContentIndex" ADD CONSTRAINT "SeriesContentIndex_seriesUnitId_Series_unitId_fkey" FOREIGN KEY ("seriesUnitId") REFERENCES "Series"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SeriesContentIndex" ADD CONSTRAINT "SeriesContentIndex_releaseUnitId_Unit_id_fkey" FOREIGN KEY ("releaseUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SeriesContentIndex" ADD CONSTRAINT "SeriesContentIndex_contentNodeId_ContentStructureNode_id_fkey" FOREIGN KEY ("contentNodeId") REFERENCES "ContentStructureNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Shelf" ADD CONSTRAINT "Shelf_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ShelfUnit" ADD CONSTRAINT "ShelfUnit_shelfId_Shelf_unitId_fkey" FOREIGN KEY ("shelfId") REFERENCES "Shelf"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ShelfUnitRelation" ADD CONSTRAINT "ShelfUnitRelation_shelfId_Shelf_unitId_fkey" FOREIGN KEY ("shelfId") REFERENCES "Shelf"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ShelfUnitRelation" ADD CONSTRAINT "ShelfUnitRelation_shelfId_childUnitId_fkey" FOREIGN KEY ("shelfId","childUnitId") REFERENCES "ShelfUnit"("shelfId","unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ShelfUnitRelation" ADD CONSTRAINT "ShelfUnitRelation_shelfId_parentUnitId_fkey" FOREIGN KEY ("shelfId","parentUnitId") REFERENCES "ShelfUnit"("shelfId","unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SourceSite" ADD CONSTRAINT "SourceSite_entityUnitId_Entity_unitId_fkey" FOREIGN KEY ("entityUnitId") REFERENCES "Entity"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "StaffAuditLog" ADD CONSTRAINT "StaffAuditLog_actorUserId_User_unitId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "StaffGrant" ADD CONSTRAINT "StaffGrant_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "StaffGrant" ADD CONSTRAINT "StaffGrant_realmUnitId_Unit_id_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "StaffGrant" ADD CONSTRAINT "StaffGrant_grantedById_User_unitId_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "StaffGrant" ADD CONSTRAINT "StaffGrant_revokedById_User_unitId_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SubjectAttribution" ADD CONSTRAINT "SubjectAttribution_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SubjectAttribution" ADD CONSTRAINT "SubjectAttribution_entityId_Unit_id_fkey" FOREIGN KEY ("entityId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriberUnitId_Unit_id_fkey" FOREIGN KEY ("subscriberUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscribedUnitId_Unit_id_fkey" FOREIGN KEY ("subscribedUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TagVote" ADD CONSTRAINT "TagVote_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "TagVote" ADD CONSTRAINT "TagVote_tagUnitId_Unit_id_fkey" FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_targetUnitId_fkey" FOREIGN KEY ("targetUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitAlias" ADD CONSTRAINT "UnitAlias_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitAlias" ADD CONSTRAINT "UnitAlias_createdById_User_unitId_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitAlias" ADD CONSTRAINT "UnitAlias_updatedById_User_unitId_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitAliasVote" ADD CONSTRAINT "UnitAliasVote_aliasId_UnitAlias_id_fkey" FOREIGN KEY ("aliasId") REFERENCES "UnitAlias"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitAliasVote" ADD CONSTRAINT "UnitAliasVote_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitCollaborator" ADD CONSTRAINT "UnitCollaborator_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitCollaborator" ADD CONSTRAINT "UnitCollaborator_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitCollaborator" ADD CONSTRAINT "UnitCollaborator_addedById_User_unitId_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitExternalRef" ADD CONSTRAINT "UnitExternalRef_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitExternalRef" ADD CONSTRAINT "UnitExternalRef_5Rjayl5mUUqX_fkey" FOREIGN KEY ("sourceSiteEntityUnitId") REFERENCES "SourceSite"("entityUnitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitFieldLock" ADD CONSTRAINT "UnitFieldLock_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitFieldLock" ADD CONSTRAINT "UnitFieldLock_lockedById_User_unitId_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitHistoryClock" ADD CONSTRAINT "UnitHistoryClock_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitRealm" ADD CONSTRAINT "UnitRealm_realmUnitId_Unit_id_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitRealm" ADD CONSTRAINT "UnitRealm_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitSupportLanguage" ADD CONSTRAINT "UnitSupportLanguage_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitTag" ADD CONSTRAINT "UnitTag_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitTag" ADD CONSTRAINT "UnitTag_tagUnitId_Unit_id_fkey" FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UnitTranslation" ADD CONSTRAINT "UnitTranslation_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserContentNodeProgress" ADD CONSTRAINT "UserContentNodeProgress_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserContentNodeProgress" ADD CONSTRAINT "UserContentNodeProgress_nodeId_ContentStructureNode_id_fkey" FOREIGN KEY ("nodeId") REFERENCES "ContentStructureNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserTagApplication" ADD CONSTRAINT "UserTagApplication_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserTagApplication" ADD CONSTRAINT "UserTagApplication_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserTagApplication" ADD CONSTRAINT "UserTagApplication_tagUnitId_Unit_id_fkey" FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserUnitCollection" ADD CONSTRAINT "UserUnitCollection_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserUnitCollection" ADD CONSTRAINT "UserUnitCollection_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserUnitProgress" ADD CONSTRAINT "UserUnitProgress_userId_User_unitId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserUnitProgress" ADD CONSTRAINT "UserUnitProgress_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "UserUnitProgress" ADD CONSTRAINT "UserUnitProgress_lastReadNodeId_ContentStructureNode_id_fkey" FOREIGN KEY ("lastReadNodeId") REFERENCES "ContentStructureNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_unitId_Unit_id_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
