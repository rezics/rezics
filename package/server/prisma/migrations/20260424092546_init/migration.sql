-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('BOOK', 'GAME', 'MEDIA', 'POST', 'TAG', 'REALM', 'SHELF', 'IMAGE', 'VIDEO', 'QUOTE', 'LINK', 'ENTITY', 'ZONE');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "UnitVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ContentRating" AS ENUM ('GENERAL', 'R_15', 'R_18', 'R_18G');

-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('REVIEW', 'EXCERPT', 'REMARK', 'POST', 'CHAPTER');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('REPORT', 'BUG', 'FEATURE', 'OTHER');

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "type" "UnitType" NOT NULL,
    "slug" TEXT,
    "workUnitId" UUID,
    "userId" UUID,
    "defaultLanguage" VARCHAR(16),
    "isLanguageNeutral" BOOLEAN NOT NULL DEFAULT false,
    "status" "UnitStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "UnitVisibility" NOT NULL DEFAULT 'PUBLIC',
    "rating" "ContentRating" NOT NULL DEFAULT 'GENERAL',
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "translationGroupId" UUID,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationGroup" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "supportedLanguages" VARCHAR(16)[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranslationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitTranslation" (
    "unitId" UUID NOT NULL,
    "language" VARCHAR(16) NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "summary" TEXT,
    "description" TEXT,
    "extra" JSONB,
    "sourceReleaseUnitId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitTranslation_pkey" PRIMARY KEY ("unitId","language")
);

-- CreateTable
CREATE TABLE "UnitSupportLanguage" (
    "unitId" UUID NOT NULL,
    "language" VARCHAR(16) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UnitSupportLanguage_pkey" PRIMARY KEY ("unitId","language")
);

-- CreateTable
CREATE TABLE "Book" (
    "unitId" UUID NOT NULL,
    "isbn13" VARCHAR(32),
    "publicationDate" TIMESTAMP(3),
    "pageCount" INTEGER,
    "textLength" INTEGER NOT NULL DEFAULT 0,
    "formatKey" VARCHAR(32),
    "isLicensed" BOOLEAN NOT NULL DEFAULT false,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "BookIndex" (
    "bookUnitId" UUID NOT NULL,
    "index" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookIndex_pkey" PRIMARY KEY ("bookUnitId")
);

-- CreateTable
CREATE TABLE "Game" (
    "unitId" UUID NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "versionLabel" TEXT,
    "ageRatingKey" VARCHAR(32),
    "isLicensed" BOOLEAN NOT NULL DEFAULT false,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "GamePlatform" (
    "gameUnitId" UUID NOT NULL,
    "platformKey" VARCHAR(64) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GamePlatform_pkey" PRIMARY KEY ("gameUnitId","platformKey")
);

-- CreateTable
CREATE TABLE "Media" (
    "unitId" UUID NOT NULL,
    "kindKey" VARCHAR(32) NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "runtimeMinutes" INTEGER,
    "episodeCount" INTEGER,
    "seasonCount" INTEGER,
    "isLicensed" BOOLEAN NOT NULL DEFAULT false,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "Link" (
    "unitId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "siteName" VARCHAR(128),
    "faviconUrl" TEXT,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "Post" (
    "unitId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "targetUnitId" UUID,
    "realmUnitId" UUID,
    "scoreEntryId" UUID,
    "body" TEXT,
    "rootPostUnitId" UUID,
    "parentPostUnitId" UUID,
    "kind" "PostKind",
    "depth" INTEGER NOT NULL DEFAULT 0,
    "sortPath" VARCHAR(512),
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "directReplyCount" INTEGER NOT NULL DEFAULT 0,
    "lastReplyAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "Shelf" (
    "unitId" UUID NOT NULL,
    "kindKey" VARCHAR(64),
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shelf_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "ShelfItem" (
    "shelfUnitId" UUID NOT NULL,
    "itemRef" UUID NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "position" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShelfItem_pkey" PRIMARY KEY ("shelfUnitId","itemRef")
);

-- CreateTable
CREATE TABLE "ShelfUnit" (
    "shelfUnitId" UUID NOT NULL,
    "itemRef" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "role" VARCHAR(32) NOT NULL,

    CONSTRAINT "ShelfUnit_pkey" PRIMARY KEY ("shelfUnitId","itemRef","unitId","role")
);

-- CreateTable
CREATE TABLE "Realm" (
    "unitId" UUID NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Realm_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "RealmMember" (
    "realmUnitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleKey" VARCHAR(32) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealmMember_pkey" PRIMARY KEY ("realmUnitId","userId")
);

-- CreateTable
CREATE TABLE "RealmUnit" (
    "realmUnitId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealmUnit_pkey" PRIMARY KEY ("realmUnitId","unitId")
);

-- CreateTable
CREATE TABLE "RealmTagUnit" (
    "realmUnitId" UUID NOT NULL,
    "tagUnitId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealmTagUnit_pkey" PRIMARY KEY ("realmUnitId","tagUnitId","unitId")
);

-- CreateTable
CREATE TABLE "UnitTag" (
    "unitId" UUID NOT NULL,
    "tagUnitId" UUID NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitTag_pkey" PRIMARY KEY ("unitId","tagUnitId")
);

-- CreateTable
CREATE TABLE "TagVote" (
    "userId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "tagUnitId" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagVote_pkey" PRIMARY KEY ("userId","unitId","tagUnitId")
);

-- CreateTable
CREATE TABLE "Entity" (
    "unitId" UUID NOT NULL,
    "kind" VARCHAR(32),
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "Zone" (
    "unitId" UUID NOT NULL,
    "filters" JSONB NOT NULL,
    "template" VARCHAR(64) NOT NULL,
    "styling" JSONB,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "Attribution" (
    "unitId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "role" VARCHAR(64) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Attribution_pkey" PRIMARY KEY ("unitId","entityId","role")
);

-- CreateTable
CREATE TABLE "User" (
    "unitId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "description" TEXT,
    "joinDate" TIMESTAMP(3),
    "permission" JSONB,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingsCount" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "ScoreEntry" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "realm" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "fields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreAggregate" (
    "unitId" UUID NOT NULL,
    "realm" UUID NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "distribution" JSONB NOT NULL,
    "fields" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreAggregate_pkey" PRIMARY KEY ("unitId","realm")
);

-- CreateTable
CREATE TABLE "ScoreRealmField" (
    "realm" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreRealmField_pkey" PRIMARY KEY ("realm","key")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "followerId" UUID NOT NULL,
    "followingId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastIP" TEXT,
    "userAgent" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "unitId" UUID,
    "url" TEXT,
    "content" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL DEFAULT 'REPORT',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JwtService" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "serviceKey" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "jwksUrl" TEXT NOT NULL,
    "jwksPath" TEXT NOT NULL,
    "isLocalIssuer" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JwtService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jwks" (
    "id" TEXT NOT NULL,
    "jwtServiceId" UUID NOT NULL,
    "publicJwk" JSONB NOT NULL,
    "privateJwk" JSONB NOT NULL,
    "alg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Jwks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchoKV" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EchoKV_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_slug_key" ON "Unit"("slug");

-- CreateIndex
CREATE INDEX "Unit_type_status_createdAt_idx" ON "Unit"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Unit_workUnitId_idx" ON "Unit"("workUnitId");

-- CreateIndex
CREATE INDEX "Unit_userId_createdAt_idx" ON "Unit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Unit_status_visibility_idx" ON "Unit"("status", "visibility");

-- CreateIndex
CREATE INDEX "Unit_defaultLanguage_idx" ON "Unit"("defaultLanguage");

-- CreateIndex
CREATE INDEX "Unit_translationGroupId_idx" ON "Unit"("translationGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_translationGroupId_defaultLanguage_key" ON "Unit"("translationGroupId", "defaultLanguage");

-- CreateIndex
CREATE INDEX "UnitTranslation_language_title_idx" ON "UnitTranslation"("language", "title");

-- CreateIndex
CREATE INDEX "UnitSupportLanguage_language_unitId_idx" ON "UnitSupportLanguage"("language", "unitId");

-- CreateIndex
CREATE INDEX "Book_isbn13_idx" ON "Book"("isbn13");

-- CreateIndex
CREATE INDEX "Book_publicationDate_idx" ON "Book"("publicationDate");

-- CreateIndex
CREATE INDEX "GamePlatform_platformKey_gameUnitId_idx" ON "GamePlatform"("platformKey", "gameUnitId");

-- CreateIndex
CREATE INDEX "Media_kindKey_releaseDate_idx" ON "Media"("kindKey", "releaseDate");

-- CreateIndex
CREATE INDEX "Post_authorUserId_createdAt_idx" ON "Post"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_targetUnitId_createdAt_idx" ON "Post"("targetUnitId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_targetUnitId_realmUnitId_createdAt_idx" ON "Post"("targetUnitId", "realmUnitId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_targetUnitId_sortPath_idx" ON "Post"("targetUnitId", "sortPath");

-- CreateIndex
CREATE INDEX "Post_rootPostUnitId_sortPath_idx" ON "Post"("rootPostUnitId", "sortPath");

-- CreateIndex
CREATE INDEX "Post_parentPostUnitId_createdAt_idx" ON "Post"("parentPostUnitId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_kind_createdAt_idx" ON "Post"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "Post_scoreEntryId_idx" ON "Post"("scoreEntryId");

-- CreateIndex
CREATE INDEX "ShelfItem_shelfUnitId_position_idx" ON "ShelfItem"("shelfUnitId", "position");

-- CreateIndex
CREATE INDEX "ShelfUnit_unitId_idx" ON "ShelfUnit"("unitId");

-- CreateIndex
CREATE INDEX "ShelfUnit_unitId_role_idx" ON "ShelfUnit"("unitId", "role");

-- CreateIndex
CREATE INDEX "ShelfUnit_shelfUnitId_role_idx" ON "ShelfUnit"("shelfUnitId", "role");

-- CreateIndex
CREATE INDEX "RealmMember_userId_idx" ON "RealmMember"("userId");

-- CreateIndex
CREATE INDEX "RealmMember_realmUnitId_roleKey_idx" ON "RealmMember"("realmUnitId", "roleKey");

-- CreateIndex
CREATE INDEX "RealmUnit_unitId_idx" ON "RealmUnit"("unitId");

-- CreateIndex
CREATE INDEX "RealmUnit_realmUnitId_createdAt_idx" ON "RealmUnit"("realmUnitId", "createdAt");

-- CreateIndex
CREATE INDEX "RealmTagUnit_realmUnitId_unitId_idx" ON "RealmTagUnit"("realmUnitId", "unitId");

-- CreateIndex
CREATE INDEX "RealmTagUnit_unitId_realmUnitId_idx" ON "RealmTagUnit"("unitId", "realmUnitId");

-- CreateIndex
CREATE INDEX "RealmTagUnit_tagUnitId_realmUnitId_idx" ON "RealmTagUnit"("tagUnitId", "realmUnitId");

-- CreateIndex
CREATE INDEX "UnitTag_unitId_score_idx" ON "UnitTag"("unitId", "score");

-- CreateIndex
CREATE INDEX "UnitTag_tagUnitId_score_idx" ON "UnitTag"("tagUnitId", "score");

-- CreateIndex
CREATE INDEX "TagVote_unitId_tagUnitId_idx" ON "TagVote"("unitId", "tagUnitId");

-- CreateIndex
CREATE INDEX "Attribution_entityId_role_idx" ON "Attribution"("entityId", "role");

-- CreateIndex
CREATE INDEX "Attribution_unitId_role_sortOrder_idx" ON "Attribution"("unitId", "role", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

-- CreateIndex
CREATE INDEX "ScoreEntry_unitId_realm_idx" ON "ScoreEntry"("unitId", "realm");

-- CreateIndex
CREATE INDEX "ScoreEntry_userId_unitId_idx" ON "ScoreEntry"("userId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_userId_unitId_realm_key" ON "ScoreEntry"("userId", "unitId", "realm");

-- CreateIndex
CREATE INDEX "ScoreRealmField_realm_sortOrder_idx" ON "ScoreRealmField"("realm", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_userId_idx" ON "ApiToken"("userId");

-- CreateIndex
CREATE INDEX "ApiToken_tokenHash_idx" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_expiresAt_idx" ON "ApiToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "Feedback_unitId_idx" ON "Feedback"("unitId");

-- CreateIndex
CREATE INDEX "Feedback_type_idx" ON "Feedback"("type");

-- CreateIndex
CREATE INDEX "Feedback_resolved_idx" ON "Feedback"("resolved");

-- CreateIndex
CREATE UNIQUE INDEX "JwtService_serviceKey_key" ON "JwtService"("serviceKey");

-- CreateIndex
CREATE INDEX "JwtService_isLocalIssuer_isActive_idx" ON "JwtService"("isLocalIssuer", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "JwtService_issuer_audience_key" ON "JwtService"("issuer", "audience");

-- CreateIndex
CREATE INDEX "Jwks_jwtServiceId_idx" ON "Jwks"("jwtServiceId");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_workUnitId_fkey" FOREIGN KEY ("workUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_translationGroupId_fkey" FOREIGN KEY ("translationGroupId") REFERENCES "TranslationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitTranslation" ADD CONSTRAINT "UnitTranslation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitSupportLanguage" ADD CONSTRAINT "UnitSupportLanguage_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookIndex" ADD CONSTRAINT "BookIndex_bookUnitId_fkey" FOREIGN KEY ("bookUnitId") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlatform" ADD CONSTRAINT "GamePlatform_gameUnitId_fkey" FOREIGN KEY ("gameUnitId") REFERENCES "Game"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_targetUnitId_fkey" FOREIGN KEY ("targetUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_realmUnitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_rootPostUnitId_fkey" FOREIGN KEY ("rootPostUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_parentPostUnitId_fkey" FOREIGN KEY ("parentPostUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_scoreEntryId_fkey" FOREIGN KEY ("scoreEntryId") REFERENCES "ScoreEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shelf" ADD CONSTRAINT "Shelf_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfItem" ADD CONSTRAINT "ShelfItem_shelfUnitId_fkey" FOREIGN KEY ("shelfUnitId") REFERENCES "Shelf"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfUnit" ADD CONSTRAINT "ShelfUnit_shelfUnitId_fkey" FOREIGN KEY ("shelfUnitId") REFERENCES "Shelf"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfUnit" ADD CONSTRAINT "ShelfUnit_shelfUnitId_itemRef_fkey" FOREIGN KEY ("shelfUnitId", "itemRef") REFERENCES "ShelfItem"("shelfUnitId", "itemRef") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfUnit" ADD CONSTRAINT "ShelfUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Realm" ADD CONSTRAINT "Realm_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealmMember" ADD CONSTRAINT "RealmMember_realmUnitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Realm"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealmUnit" ADD CONSTRAINT "RealmUnit_realmUnitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealmUnit" ADD CONSTRAINT "RealmUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealmTagUnit" ADD CONSTRAINT "RealmTagUnit_realmUnitId_fkey" FOREIGN KEY ("realmUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealmTagUnit" ADD CONSTRAINT "RealmTagUnit_tagUnitId_fkey" FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealmTagUnit" ADD CONSTRAINT "RealmTagUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitTag" ADD CONSTRAINT "UnitTag_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitTag" ADD CONSTRAINT "UnitTag_tagUnitId_fkey" FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagVote" ADD CONSTRAINT "TagVote_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagVote" ADD CONSTRAINT "TagVote_tagUnitId_fkey" FOREIGN KEY ("tagUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attribution" ADD CONSTRAINT "Attribution_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attribution" ADD CONSTRAINT "Attribution_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jwks" ADD CONSTRAINT "Jwks_jwtServiceId_fkey" FOREIGN KEY ("jwtServiceId") REFERENCES "JwtService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
