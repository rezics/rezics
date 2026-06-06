import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { PollComposer } from "../components/PollComposer";

/** Route-level entry for `/poll/new`: mounts the standalone poll composer. */
export const PollNewPage: React.FC = () => {
  const { t } = useTranslation(["community"]);
  return (
    <div className="mx-auto mt-16 w-11/12 max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-text-primary">
        {t("community:poll_composer_title")}
      </h1>
      <PollComposer />
    </div>
  );
};
