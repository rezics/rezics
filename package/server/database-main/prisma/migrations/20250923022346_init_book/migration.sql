-- CreateEnum
CREATE TYPE "public"."PostType" AS ENUM ('BOOK', 'COMMENT', 'NOTE', 'REVIEW', 'QUOTE', 'READLIST', 'IMAGE', 'VIDEO', 'CHAPTER');

-- CreateEnum
CREATE TYPE "public"."PostStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DELETED', 'FROZEN');

-- CreateEnum
CREATE TYPE "public"."UserType" AS ENUM ('USER', 'AUTHOR');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "type" "public"."UserType" NOT NULL DEFAULT 'USER',
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "bio" TEXT,
    "joinDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Post" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "public"."PostType" NOT NULL,
    "status" "public"."PostStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "content" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "targetPostId" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Book" (
    "postId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "isbn" TEXT,
    "chaptersIndex" TEXT,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "public"."CommentIndex" (
    "postId" UUID NOT NULL,
    "rootPostId" UUID NOT NULL,
    "parentCommentId" UUID,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "CommentIndex_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "public"."PostStats" (
    "postId" UUID NOT NULL,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostStats_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "public"."PostReactions" (
    "postId" UUID NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "dislikeCount" INTEGER NOT NULL DEFAULT 0,
    "loveCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostReactions_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "public"."Rating" (
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("postId","userId")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "postId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "public"."_PostDomains" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_PostDomains_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_PostTags" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_PostTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_BookToUser" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_BookToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "public"."User"("slug");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "public"."User"("name");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Post_type_status_createdAt_idx" ON "public"."Post"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Post_userId_createdAt_idx" ON "public"."Post"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_targetPostId_idx" ON "public"."Post"("targetPostId");

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "public"."Book"("title");

-- CreateIndex
CREATE INDEX "Book_isbn_idx" ON "public"."Book"("isbn");

-- CreateIndex
CREATE INDEX "CommentIndex_rootPostId_depth_idx" ON "public"."CommentIndex"("rootPostId", "depth");

-- CreateIndex
CREATE INDEX "CommentIndex_parentCommentId_idx" ON "public"."CommentIndex"("parentCommentId");

-- CreateIndex
CREATE INDEX "Tag_type_idx" ON "public"."Tag"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_postId_name_type_key" ON "public"."Tag"("postId", "name", "type");

-- CreateIndex
CREATE INDEX "_PostDomains_B_index" ON "public"."_PostDomains"("B");

-- CreateIndex
CREATE INDEX "_PostTags_B_index" ON "public"."_PostTags"("B");

-- CreateIndex
CREATE INDEX "_BookToUser_B_index" ON "public"."_BookToUser"("B");

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_targetPostId_fkey" FOREIGN KEY ("targetPostId") REFERENCES "public"."Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Book" ADD CONSTRAINT "Book_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentIndex" ADD CONSTRAINT "CommentIndex_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentIndex" ADD CONSTRAINT "CommentIndex_rootPostId_fkey" FOREIGN KEY ("rootPostId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommentIndex" ADD CONSTRAINT "CommentIndex_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "public"."Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PostStats" ADD CONSTRAINT "PostStats_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PostReactions" ADD CONSTRAINT "PostReactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tag" ADD CONSTRAINT "Tag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PostDomains" ADD CONSTRAINT "_PostDomains_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PostDomains" ADD CONSTRAINT "_PostDomains_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PostTags" ADD CONSTRAINT "_PostTags_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PostTags" ADD CONSTRAINT "_PostTags_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Tag"("postId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_BookToUser" ADD CONSTRAINT "_BookToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Book"("postId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_BookToUser" ADD CONSTRAINT "_BookToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
