-- DropForeignKey
ALTER TABLE "public"."_UnitDomains" DROP CONSTRAINT "_UnitDomains_B_fkey";

-- AddForeignKey
ALTER TABLE "_UnitDomains" ADD CONSTRAINT "_UnitDomains_B_fkey" FOREIGN KEY ("B") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
