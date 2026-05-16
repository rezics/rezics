import type { EntityDTO } from "@rezics/contract";
import { getEntityTranslation } from "../models/types";

interface AboutTabProps {
  entity: EntityDTO;
  language: string;
}

export function AboutTab({ entity, language }: AboutTabProps) {
  const tr = getEntityTranslation(entity, language);
  const items: Array<{ label: string; value: string }> = [];

  if (entity.kind) items.push({ label: "Kind", value: entity.kind });
  if (entity.verified !== undefined) {
    items.push({ label: "Verified", value: entity.verified ? "Yes" : "No" });
  }
  if (entity.slug) items.push({ label: "Slug", value: entity.slug });
  if (tr?.language) {
    items.push({ label: "Translation", value: tr.language });
  }

  if (items.length === 0) {
    return <p className="text-sm text-text-secondary">No details available.</p>;
  }

  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-text-secondary">{item.label}</dt>
          <dd className="text-text-primary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function hasAboutData(entity: EntityDTO): boolean {
  return Boolean(
    entity.kind || entity.slug || entity.verified !== undefined,
  );
}
