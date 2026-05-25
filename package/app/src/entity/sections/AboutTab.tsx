import type { EntityDTO } from "@rezics/contract";
import { getEntityTranslation } from "../models/types";
import { useMessage } from "@rezics/i18n/react";
import {
  common_no,
  common_translation,
  common_yes,
  entity_kind_label,
  entity_no_details_available,
  entity_slug_label,
  entity_verified,
} from "@rezics/i18n/messages";
const i18nMessages = {
  common_no,
  common_translation,
  common_yes,
  entity_kind_label,
  entity_no_details_available,
  entity_slug_label,
  entity_verified,
};

interface AboutTabProps {
  entity: EntityDTO;
  language: string;
}

export function AboutTab({ entity, language }: AboutTabProps) {
  const m = useMessage(i18nMessages);
  const tr = getEntityTranslation(entity, language);
  const items: Array<{ label: string; value: string }> = [];

  if (entity.kind)
    items.push({ label: m.entity_kind_label(), value: entity.kind });
  if (entity.verified !== undefined) {
    items.push({
      label: m.entity_verified(),
      value: entity.verified ? m.common_yes() : m.common_no(),
    });
  }
  if (entity.slug)
    items.push({ label: m.entity_slug_label(), value: entity.slug });
  if (tr?.language) {
    items.push({ label: m.common_translation(), value: tr.language });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        {m.entity_no_details_available()}
      </p>
    );
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
  return Boolean(entity.kind || entity.slug || entity.verified !== undefined);
}
