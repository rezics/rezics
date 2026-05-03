import { Button } from "@rezics/ui/shadcn";
import type React from "react";

export const HomeMobileDownloadCTA: React.FC = () => {
  return (
    <div className="w-full rounded border p-4 flex items-center justify-between bg-gray-50">
      <div>
        <p className="text-base font-medium mb-1">下载移动 App</p>
        <p className="text-sm text-rezics-color-fg-muted m-0">
          随时随地看书、写评、管理书单
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="default">App Store</Button>
        <Button variant="outline">Google Play</Button>
      </div>
    </div>
  );
};

export default HomeMobileDownloadCTA;
