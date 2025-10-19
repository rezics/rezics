-- AlterTable
ALTER TABLE "Tag" ALTER COLUMN "unitId" SET DEFAULT uuidv7();

-- AlterTable
ALTER TABLE "Unit" ALTER COLUMN "id" SET DEFAULT uuidv7();

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "unitId" SET DEFAULT uuidv7();
