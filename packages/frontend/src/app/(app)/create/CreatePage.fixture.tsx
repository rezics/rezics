"use client";

import CreatePage from "./page";

export default {
  Default: <CreatePage />,
  Mobile: (
    <div className="w-[320px] p-4">
      <CreatePage />
    </div>
  ),
  UltraWide: (
    <div className="w-[1536px] p-4">
      <CreatePage />
    </div>
  ),
};
