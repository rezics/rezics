import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  home_mobile_cta_app_store,
  home_mobile_cta_description,
  home_mobile_cta_google_play,
  home_mobile_cta_title,
} from "@rezics/i18n/messages";
const m = {
  home_mobile_cta_app_store,
  home_mobile_cta_description,
  home_mobile_cta_google_play,
  home_mobile_cta_title,
};

const i18nMessages = {
  home_mobile_cta_app_store,
  home_mobile_cta_description,
  home_mobile_cta_google_play,
  home_mobile_cta_title,
};

export const HomeMobileDownloadCTA: React.FC = () => {
  const m = useMessage(i18nMessages);
  return (
    <div className="w-full rounded border p-4 flex items-center justify-between bg-gray-50">
      <div>
        <p className="text-base font-medium mb-1">
          {m.home_mobile_cta_title()}
        </p>
        <p className="text-sm text-text-secondary m-0">
          {m.home_mobile_cta_description()}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="default">{m.home_mobile_cta_app_store()}</Button>
        <Button variant="outline">{m.home_mobile_cta_google_play()}</Button>
      </div>
    </div>
  );
};

export default HomeMobileDownloadCTA;
