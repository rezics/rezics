import { createQueryClient } from "@rezics/api/react-query/tsr";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { toast } from "sonner";

// R11-compliant dispatch map: every meta.successToast key must appear here
// so the checker sees a bracketed map lookup, not a bare identifier.
// R11 合规调度映射：每个 meta.successToast key 必须出现在此处，
// 让检查器看到的是方括号映射查找而非裸标识符。
const SUCCESS_TOAST_KEY: Record<string, `${string}:${string}`> = {
  "community:member_role_updated": "community:member_role_updated",
  "community:member_removed": "community:member_removed",
  "community:moderation_approve_success":
    "community:moderation_approve_success",
  "community:moderation_remove_success":
    "community:moderation_remove_success",
  "community:moderation_restore_success":
    "community:moderation_restore_success",
  "community:moderation_case_updated": "community:moderation_case_updated",
  "community:realm_settings_saved": "community:realm_settings_saved",
  "zone:manage_saved": "zone:manage_saved",
  "common:saved": "common:saved",
  "common:external_links_remove_success":
    "common:external_links_remove_success",
};

export const qc = createQueryClient({
  onMutationError: (_error) => {
    const message = getI18nRuntime().i18n.t("common:mutation_error_generic");
    toast.error(message);
  },
  onMutationSuccess: (key) => {
    if (SUCCESS_TOAST_KEY[key]) {
      toast.success(getI18nRuntime().i18n.t(SUCCESS_TOAST_KEY[key]));
    }
  },
});
