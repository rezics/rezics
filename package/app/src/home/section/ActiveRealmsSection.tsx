import { Alert, Button, CircularProgress, Typography } from "@mui/material";
import { realmListQuery } from "@rezics/api/realm/realm";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import { RealmCard } from "@/realm/component/RealmCard";

export const ActiveRealmsSection: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(
    realmListQuery({ isPublic: true, sort: { field: "memberCount", order: "desc" }, limit: 5 }),
  );

  const realms = data?.realms ?? [];

  if (error) {
    return <Alert severity="error">{String(error)}</Alert>;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{t("page.home.sections.active_realms.title")}</h2>
        <Button variant="text" color="primary" onClick={() => navigate({ to: "/realm" })}>
          {t("page.home.sections.active_realms.more")}
        </Button>
      </div>
      {isLoading ? (
        <CircularProgress size={20} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {realms.map((realm) => (
            <RealmCard key={realm.unitId} realm={realm} />
          ))}
        </div>
      )}
    </div>
  );
};
