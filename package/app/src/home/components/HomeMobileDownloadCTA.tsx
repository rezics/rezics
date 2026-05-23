import * as m from "@rezics/i18n/messages";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";

export const HomeMobileDownloadCTA: React.FC = () => {
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
