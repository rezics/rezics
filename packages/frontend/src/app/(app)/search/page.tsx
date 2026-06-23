import { SectionBoundary } from "@/components/SectionBoundary";
import { SearchContent } from "./content";

export default function SearchPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Search</h1>
      <SectionBoundary>
        <SearchContent />
      </SectionBoundary>
    </div>
  );
}
