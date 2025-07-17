import { useTranslation } from "react-i18next";

export function LongReviewPage() {
    const { t } = useTranslation();
    return <div>{t("pages.long_review_page")}</div>;
}
