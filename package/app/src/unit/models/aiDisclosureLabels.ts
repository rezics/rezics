import type { AiDisclosureMode } from "@rezics/contract";
const AI_DISCLOSURE_LABEL: Record<AiDisclosureMode, () => string> = {
  UNKNOWN: ai_disclosure_UNKNOWN,
  NONE: ai_disclosure_NONE,
  AI_ASSISTED: ai_disclosure_AI_ASSISTED,
  AI_ORIGINATED: ai_disclosure_AI_ORIGINATED,
  MACHINE_GENERATED: ai_disclosure_MACHINE_GENERATED,
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
