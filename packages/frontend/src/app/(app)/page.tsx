import { SectionBoundary } from "@/components/SectionBoundary";
import { HomeContent } from "./content";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-xl font-bold">Editor Picks</h2>
        <SectionBoundary>
          <HomeContent section="editorPicks" />
        </SectionBoundary>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">New Releases</h2>
        <SectionBoundary>
          <HomeContent section="newReleases" />
        </SectionBoundary>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Active Realms</h2>
        <SectionBoundary>
          <HomeContent section="activeRealms" />
        </SectionBoundary>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Trending</h2>
        <SectionBoundary>
          <HomeContent section="trending" />
        </SectionBoundary>
      </section>
    </div>
  );
}
