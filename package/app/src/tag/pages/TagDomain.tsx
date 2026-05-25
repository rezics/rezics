import { tagQueries } from "@rezics/api/tag/tag";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { Route as tagDomainRoute } from "@/routes/_mainLayout/tag/domain/$unitId/route";
import { Route as tagDomainTitleRoute } from "@/routes/_mainLayout/tag/domain/$unitId/title/$title";
import { TagWrapper } from "../components/TagWrapper";
import { useMessage } from "@rezics/i18n/react";
import {
  common_load_failed,
  tag_domain_title,
  tag_loading,
} from "@rezics/i18n/messages";
const m = {
  common_load_failed,
  tag_domain_title,
  tag_loading,
};

const i18nMessages = {
  common_load_failed,
  tag_domain_title,
  tag_loading,
};

export function TagDomainPage() {
  const m = useMessage(i18nMessages);
  // Keep both route shapes available while the tag routes are being migrated.
  const withTitleMatch = tagDomainTitleRoute.useMatch({ shouldThrow: true });
  const baseMatch = tagDomainRoute.useMatch({ shouldThrow: true });
  const unitId =
    withTitleMatch?.params.unitId ?? baseMatch?.params.unitId ?? "";
  const title = withTitleMatch?.params.title;
  const { data, isLoading, error } = useQuery(tagQueries.list({ unitId }));
  if (isLoading) {
    return (
      <div className="w-11/12 mx-auto mt-16">
        <div className="text-sm text-gray-500">{m.tag_loading()}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-11/12 mx-auto mt-16">
        <div className="text-sm text-red-600">
          {m.common_load_failed()}: {String((error as any)?.message ?? error)}
        </div>
      </div>
    );
  }

  return (
    <div className="w-11/12 mx-auto mt-16">
      <AccentBarWithText text={title ?? m.tag_domain_title({ id: unitId })} />
      <TagWrapper filters={{ unitId }} mode="flat" />
    </div>
  );
}
