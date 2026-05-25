import {
  initI18n as initAdapterI18n,
  registerParaglideRuntime,
} from "@rezics/i18n/react";
import * as productRuntime from "@rezics/i18n/runtime";
import * as uiRuntime from "@rezics/ui/i18n/runtime";

let runtimesRegistered = false;

export function initI18n() {
  if (!runtimesRegistered) {
    registerParaglideRuntime(productRuntime);
    registerParaglideRuntime(uiRuntime);
    runtimesRegistered = true;
  }

  initAdapterI18n();
}
