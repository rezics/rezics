import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import type React from "react";

export const NotificationPage: React.FC = () => {
  return (
    <div className="w-11/12 mx-auto mt-16">
      <AccentBarWithText text="Notification" />
    </div>
  );
};
