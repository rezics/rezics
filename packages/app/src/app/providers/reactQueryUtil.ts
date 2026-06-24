import { createQueryClient } from "@rezics/contract/api/react-query/tsr";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { toast } from "sonner";

export const qc = createQueryClient({
  onMutationError: (_error) => {
    // Show a generic translated error; raw error.message is not user-friendly
    // 显示通用的翻译错误消息；原始 error.message 对用户不友好
    const message = getI18nRuntime().i18n.t("common:mutation_error_generic");
    toast.error(message);
  },
});
