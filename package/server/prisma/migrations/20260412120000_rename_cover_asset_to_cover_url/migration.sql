-- RenameColumn
ALTER TABLE "Book" RENAME COLUMN "coverAssetUnitId" TO "coverUrl";

-- RenameColumn
ALTER TABLE "Game" RENAME COLUMN "coverAssetUnitId" TO "coverUrl";

-- RenameColumn
ALTER TABLE "Media" RENAME COLUMN "coverAssetUnitId" TO "coverUrl";

-- DropType (column is no longer UUID, just a plain text URL)
ALTER TABLE "Book" ALTER COLUMN "coverUrl" TYPE TEXT;
ALTER TABLE "Game" ALTER COLUMN "coverUrl" TYPE TEXT;
ALTER TABLE "Media" ALTER COLUMN "coverUrl" TYPE TEXT;
