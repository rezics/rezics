import { buildMeiliUnitQuery } from "@rezics/api/meili/meili.queries";
import { UnitType } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { ExcerptListContainer } from "@/review/components/ExcerptList.tsx";

export type ExcerptPreviewProps = {
  id: string;
  excerptNumber?: number;
};

export const ExcerptPreview: React.FC<ExcerptPreviewProps> = ({
  id,
  excerptNumber = 3,
}) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.QUOTE,
      start: 0,
      targetUnitId: id,
      keyword: "",
      limit: excerptNumber,
      mapFn: (unitResp: any) => unitResp,
      options: { enabled: !!id },
    }),
  );

  if (isLoading) return <div>{t("common.loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  return (
    <div>
      <ExcerptListContainer
        data={{
          units: data?.units?.slice(0, excerptNumber) || [],
          total: data?.total,
        }}
      />
    </div>
  );
};

export { ExcerptPreview as ExcerptPreviewContainer };
