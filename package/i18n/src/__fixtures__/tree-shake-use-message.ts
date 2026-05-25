import { common_save } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";

const i18nMessages = {
  common_save,
};

export function TreeShakeProbe() {
  const m = useMessage(i18nMessages);
  return m.common_save();
}
