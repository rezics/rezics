import { SectionBoundary } from "@/components/SectionBoundary";
import { BookContentTab } from "./content-tab";

export default function BookContentPage({ params }: { readonly params: Promise<{ id: string }> }) {
  return (
    <SectionBoundary>
      <BookContentTab paramsPromise={params} />
    </SectionBoundary>
  );
}
