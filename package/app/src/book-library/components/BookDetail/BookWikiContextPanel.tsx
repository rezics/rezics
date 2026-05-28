import { realmDetailQuery } from "@rezics/api/realm/realm";
import { workRealmContextByReleaseQueryOptions } from "@rezics/api/work-realm-context/work-realm-context";
import { zoneByUnitIdQueryOptions } from "@rezics/api/zone/zone";
import type { BookDTO, RealmDTO, WorkRealmContextDTO } from "@rezics/contract";
import {
  common_loading,
  common_open,
  realm_official,
} from "@rezics/i18n/messages";
import { useLocale, useMessage } from "@rezics/i18n/react";
import { Button, Card, CardContent } from "@rezics/ui/shadcn";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Link } from "@/shared/ui/link";
import { getTranslation } from "@/shared/utils/translation-helpers";

const i18nMessages = {
  common_loading,
  common_open,
  realm_official,
};

type WikiContextOption = {
  context: WorkRealmContextDTO;
  label: string;
};

function contextLabel(context: WorkRealmContextDTO, fallback: string) {
  if (context.role === "official") return fallback;
  if (context.role === "language") return context.locale ?? "Language";
  return context.role;
}

function realmTitle(realm: RealmDTO | undefined, fallback: string) {
  return getTranslation(realm?.translations)?.title ?? fallback;
}

export function BookWikiContextPanel({
  bookInfo,
}: {
  bookInfo: Pick<BookDTO, "unitId">;
}) {
  const m = useMessage(i18nMessages);
  const locale = useLocale();
  const contextQuery = useQuery(
    workRealmContextByReleaseQueryOptions(bookInfo.unitId, {
      locale,
      includeCommunity: true,
      includeArchive: false,
    }),
  );
  const contextData = contextQuery.data;
  const options: WikiContextOption[] = [
    ...(contextData?.official
      ? [
          {
            context: contextData.official,
            label: m.realm_official(),
          },
        ]
      : []),
    ...(contextData?.language ?? []).map((context) => ({
      context,
      label: contextLabel(context, m.realm_official()),
    })),
    ...(contextData?.community ?? []).map((context) => ({
      context,
      label: contextLabel(context, m.realm_official()),
    })),
  ];
  const realmIds = [
    ...new Set(options.map((option) => option.context.realmUnitId)),
  ];
  const realmResults = useQueries({
    queries: realmIds.map((realmId) => realmDetailQuery(realmId)),
  });
  const realmsById = new Map(
    realmResults.flatMap((result, index) =>
      result.data ? [[realmIds[index]!, result.data] as const] : [],
    ),
  );
  const zoneIds = [
    ...new Set(
      options
        .map(
          (option) =>
            realmsById.get(option.context.realmUnitId)?.extra?.wikiZoneUnitId,
        )
        .filter((zoneId): zoneId is string => Boolean(zoneId)),
    ),
  ];
  const zoneResults = useQueries({
    queries: zoneIds.map((zoneId) => zoneByUnitIdQueryOptions(zoneId)),
  });
  const zonesById = new Map(
    zoneResults.flatMap((result, index) =>
      result.data ? [[zoneIds[index]!, result.data] as const] : [],
    ),
  );

  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-medium leading-ui text-text-primary">
            Wiki
          </h2>
          <p className="mt-1 text-sm leading-body text-text-secondary">
            Release-specific realm context.
          </p>
        </div>

        {contextQuery.isLoading ? (
          <p className="text-sm leading-ui text-text-secondary">
            {m.common_loading()}
          </p>
        ) : contextData?.conflicts.length ? (
          <p className="text-sm leading-body text-text-secondary">
            Conflicting official wiki realms need review.
          </p>
        ) : options.length === 0 ? (
          <p className="text-sm leading-body text-text-secondary">
            No wiki realm is linked to this release yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {options.map(({ context, label }) => {
              const realm = realmsById.get(context.realmUnitId);
              const zoneId = realm?.extra?.wikiZoneUnitId ?? null;
              const zone = zoneId ? zonesById.get(zoneId) : null;

              return (
                <div
                  key={context.id}
                  className="rounded-sm border border-border-subtle p-3"
                >
                  <p className="text-xs font-medium uppercase tracking-normal text-text-tertiary">
                    {label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-ui text-text-primary">
                    {realmTitle(realm, context.realmUnitId)}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <Link
                      to="/realm/$realmId"
                      params={{ realmId: context.realmUnitId }}
                      search={{ tab: "wiki" }}
                    >
                      <Button size="sm" variant="outline" className="w-full">
                        Wiki
                      </Button>
                    </Link>
                    {zone?.slug && (
                      <Link to="/z/$slug" params={{ slug: zone.slug }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {m.common_open()}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
