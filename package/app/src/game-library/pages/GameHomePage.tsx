import { useTranslation } from "@rezics/i18n/react";
export const GameHomePage: React.FC = () => {
  const { t } = useTranslation(["common"]);
return <div>{t("common:game_library_title")}</div>;
};
