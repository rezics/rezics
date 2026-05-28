import { getI18nRuntime } from "@rezics/i18n/runtime";
import type { AiDisclosureMode } from "@rezics/contract";
const AI_DISCLOSURE_LABEL: Record<AiDisclosureMode, () => string> = {
  UNKNOWN: () => getI18nRuntime().i18n.t("settings:ai_disclosure_UNKNOWN"),
  NONE: () => getI18nRuntime().i18n.t("settings:ai_disclosure_NONE"),
  AI_ASSISTED: () =>
    getI18nRuntime().i18n.t("settings:ai_disclosure_AI_ASSISTED"),
  AI_ORIGINATED: () =>
    getI18nRuntime().i18n.t("settings:ai_disclosure_AI_ORIGINATED"),
  MACHINE_GENERATED: () =>
    getI18nRuntime().i18n.t("settings:ai_disclosure_MACHINE_GENERATED"),
};

export function aiDisclosureLabel(mode: AiDisclosureMode): string {
  return AI_DISCLOSURE_LABEL[mode]();
}

export function aiDisclosureLabelMap(): Record<AiDisclosureMode, string> {
  return {
    UNKNOWN: aiDisclosureLabel("UNKNOWN"),
    NONE: aiDisclosureLabel("NONE"),
    AI_ASSISTED: aiDisclosureLabel("AI_ASSISTED"),
    AI_ORIGINATED: aiDisclosureLabel("AI_ORIGINATED"),
    MACHINE_GENERATED: aiDisclosureLabel("MACHINE_GENERATED"),
  };
}
