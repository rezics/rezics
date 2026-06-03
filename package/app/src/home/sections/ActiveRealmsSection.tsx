import { realmListQuery } from "@rezics/api/realm/realm";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import { buttonVariants } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { RealmCard } from "@/realm/components/RealmCard";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

export const ActiveRealmsSection: React.FC = () => {
  const { t } = useTranslation(["page"]);
  const readLanguage = useReadLanguageContext();
  const { data, isLoading, error } = useQuery({
    ...realmListQuery({
      isPublic: true,
      sort: { field: "memberCount", order: "desc" },
      limit: 5,
      languages: readLanguage.languages,
      languageMode: readLanguage.languageMode,
    }),
    enabled: readLanguage.ready,
  });

  const realms = data?.realms ?? [];

  if (error) {
    return <QueryErrorDisplay error={error} />;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">
          {t("page:home_sections_active_realms_title")}
        </h2>
        <Link to="/realm" className={buttonVariants({ variant: "ghost" })}>
          {t("page:home_sections_active_realms_more")}
        </Link>
      </div>
      {isLoading ? (
        <Spinner size="sm" />
      ) : (
        <>
          <div className="sm:hidden">
            <DomainCarousel
              items={realms}
              itemKey={(realm) => realm.unitId}
              itemClassName="pl-4 basis-[86%] xsm:basis-[62%]"
              showArrows={false}
              ariaLabel={t("page:home_sections_active_realms_title")}
              renderItem={(realm) => <RealmCard realm={realm} />}
            />
          </div>
          <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {realms.map((realm) => (
              <RealmCard key={realm.unitId} realm={realm} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
