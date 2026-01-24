-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('BOOK', 'COMMENT', 'NOTE', 'REVIEW', 'DOMAIN', 'TAG', 'QUOTE', 'READLIST', 'IMAGE', 'VIDEO', 'CHAPTER');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DELETED', 'FROZEN');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('USER', 'AUTHOR', 'PRESS', 'PRODUCER');

-- CreateTable
CREATE TABLE "User" (
    "unitId" UUID NOT NULL DEFAULT uuidv7(),
    "email" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "type" "UserType" NOT NULL DEFAULT 'USER',
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "description" TEXT,
    "joinDate" TIMESTAMP(3),
    "permission" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "type" "UnitType" NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "content" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "targetUnitId" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "unitId" UUID NOT NULL DEFAULT uuidv7(),
    "title" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "coverUrl" TEXT,
    "isbn" TEXT,
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
CREATE TABLE "ReadList" (
    "unitId" UUID NOT NULL DEFAULT uuidv7(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadList_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "CommentIndex" (
    "unitId" UUID NOT NULL DEFAULT uuidv7(),
    "rootUnitId" UUID NOT NULL,
    "parentCommentId" UUID,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "CommentIndex_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionSummary" (
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "reaction" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReactionSummary_pkey" PRIMARY KEY ("targetType","targetId","reaction")
);

-- CreateTable
CREATE TABLE "Rating" (
    "unitId" UUID NOT NULL,
    "domain" UUID NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("unitId","domain")
);

-- CreateTable
CREATE TABLE "Tag" (
    "unitId" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "i18n" JSONB,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("unitId")
);

-- CreateTable
CREATE TABLE "EchoKV" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EchoKV_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "_UnitDomains" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_UnitDomains_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BookAuthor" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BookAuthor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BookPress" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BookPress_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BookProducer" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BookProducer_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ReadListForBook" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ReadListForBook_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ReviewForReadList" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ReviewForReadList_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_UnitTags" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_UnitTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Unit_type_status_createdAt_idx" ON "Unit"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Unit_userId_createdAt_idx" ON "Unit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Unit_targetUnitId_idx" ON "Unit"("targetUnitId");

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "Book"("title");

-- CreateIndex
CREATE INDEX "Book_isbn_idx" ON "Book"("isbn");

-- CreateIndex
CREATE INDEX "CommentIndex_rootUnitId_depth_idx" ON "CommentIndex"("rootUnitId", "depth");

-- CreateIndex
CREATE INDEX "CommentIndex_parentCommentId_idx" ON "CommentIndex"("parentCommentId");

-- CreateIndex
CREATE INDEX "Reaction_targetType_targetId_idx" ON "Reaction"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_targetType_targetId_reaction_key" ON "Reaction"("userId", "targetType", "targetId", "reaction");

-- CreateIndex
CREATE INDEX "Tag_type_idx" ON "Tag"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_unitId_name_type_key" ON "Tag"("unitId", "name", "type");

-- CreateIndex
CREATE INDEX "_UnitDomains_B_index" ON "_UnitDomains"("B");

-- CreateIndex
CREATE INDEX "_BookAuthor_B_index" ON "_BookAuthor"("B");

-- CreateIndex
CREATE INDEX "_BookPress_B_index" ON "_BookPress"("B");

-- CreateIndex
CREATE INDEX "_BookProducer_B_index" ON "_BookProducer"("B");

-- CreateIndex
CREATE INDEX "_ReadListForBook_B_index" ON "_ReadListForBook"("B");

-- CreateIndex
CREATE INDEX "_ReviewForReadList_B_index" ON "_ReviewForReadList"("B");

-- CreateIndex
CREATE INDEX "_UnitTags_B_index" ON "_UnitTags"("B");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_targetUnitId_fkey" FOREIGN KEY ("targetUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookIndex" ADD CONSTRAINT "BookIndex_bookUnitId_fkey" FOREIGN KEY ("bookUnitId") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadList" ADD CONSTRAINT "ReadList_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentIndex" ADD CONSTRAINT "CommentIndex_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentIndex" ADD CONSTRAINT "CommentIndex_rootUnitId_fkey" FOREIGN KEY ("rootUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentIndex" ADD CONSTRAINT "CommentIndex_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("unitId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnitDomains" ADD CONSTRAINT "_UnitDomains_A_fkey" FOREIGN KEY ("A") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnitDomains" ADD CONSTRAINT "_UnitDomains_B_fkey" FOREIGN KEY ("B") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookAuthor" ADD CONSTRAINT "_BookAuthor_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookAuthor" ADD CONSTRAINT "_BookAuthor_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookPress" ADD CONSTRAINT "_BookPress_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookPress" ADD CONSTRAINT "_BookPress_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookProducer" ADD CONSTRAINT "_BookProducer_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BookProducer" ADD CONSTRAINT "_BookProducer_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReadListForBook" ADD CONSTRAINT "_ReadListForBook_A_fkey" FOREIGN KEY ("A") REFERENCES "Book"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReadListForBook" ADD CONSTRAINT "_ReadListForBook_B_fkey" FOREIGN KEY ("B") REFERENCES "ReadList"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReviewForReadList" ADD CONSTRAINT "_ReviewForReadList_A_fkey" FOREIGN KEY ("A") REFERENCES "ReadList"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReviewForReadList" ADD CONSTRAINT "_ReviewForReadList_B_fkey" FOREIGN KEY ("B") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnitTags" ADD CONSTRAINT "_UnitTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Tag"("unitId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnitTags" ADD CONSTRAINT "_UnitTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
