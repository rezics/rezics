import type { ContentSection } from "@/lib/about/types";

export function AboutSectionGrid({ sections }: { sections: ContentSection[] }) {
  return (
    <section className="about-section-grid">
      {sections.map((section) => (
        <article className="about-section-card" key={section.title}>
          <p className="about-eyebrow">{section.eyebrow}</p>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </article>
      ))}
    </section>
  );
}

export function AboutStorySections({
  sections,
}: {
  sections: ContentSection[];
}) {
  return (
    <section className="about-story-list">
      {sections.map((section) => (
        <article className="about-story-row" key={section.title}>
          <p className="about-eyebrow">{section.eyebrow}</p>
          <div>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
