import React from "react";
import { useTranslation } from "react-i18next";

export const BookEditMainPage: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div>
            <h1>{t("pages.book_edit_page")}</h1>
        </div>
    );
};
