import { useTranslation } from "@rezics/i18n/react";
export const MediaHomePage: React.FC = () => {
  const { t } = useTranslation(["shell"]);
return <div>{t("shell:media_library_title")}</div>;
};
