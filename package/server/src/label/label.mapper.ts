import type { LabelDTO, Language } from "@rezics/contract";
import type { LabelWithTranslations } from "./label.service";

export function mapLabelToDTO(label: LabelWithTranslations): LabelDTO {
  return {
    unitId: label.unitId,
    translations: label.translations.map((tr) => ({
      language: tr.language as Language,
      title: tr.title,
    })),
  };
}
