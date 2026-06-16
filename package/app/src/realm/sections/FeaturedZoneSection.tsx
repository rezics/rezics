import { zonePortalQueryOptions } from "@rezics/api/zone/zone";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";

/**
 * Highlights a featured zone/collection for a realm.
 * Displays zone name, description preview, and "Open" button linking to zone detail.
 * Returns null if zone ID missing, query error, or zone not found.
 *
 * 突出显示社区的特色区域/合集。
 * 显示区域名称、描述预览和链接到区域详情的"打开"按钮。
 * 如果区域ID缺失、查询错误或区域未找到，返回null。
 *
 * Layout:
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Featured Zone            │
 * ├──────────────────────────┤
 * │ Zone Name / Slug         │
 * │ Zone description preview │
 * │ clamped to 2 lines       │
 * │                          │
 * │ [Open ─→ Button]         │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Featured Zone                      │
 * ├────────────────────────────────────┤
 * │ Zone Name / Slug                   │
 * │ Zone description preview clamped   │
 * │ to 2 lines                         │
 * │                                    │
 * │ [Open ─→ Button - full width]      │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────┐
 * │ Featured Zone                        │
 * ├──────────────────────────────────────┤
 * │ Zone Name / Slug                     │
 * │ Zone description preview clamped     │
 * │ to 2 lines                           │
 * │                                      │
 * │ [Open ─→ Button - full width]        │
 * └──────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop - contained card
 */
export interface FeaturedZoneSectionProps {
  zoneUnitId?: string | null;
}

export function FeaturedZoneSection({ zoneUnitId }: FeaturedZoneSectionProps) {
  const { t } = useTranslation(["common", "entity", "zone"]);
  const readContext = useReadLanguageContext();
  const zoneQuery = useQuery({
    ...zonePortalQueryOptions(zoneUnitId ?? "", "home", readContext.languages),
    enabled: readContext.ready && Boolean(zoneUnitId),
  });
  const zone = zoneQuery.data?.zone;
  if (!zoneUnitId || zoneQuery.isError || !zone) return null;

  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-xs font-medium uppercase leading-dense text-text-tertiary">
            {t("entity:realm_featured_zone")}
          </p>
          <h2 className="mt-1 text-base font-medium leading-ui text-text-primary">
            {zone.name || zone.slug}
          </h2>
          {zone.description ? (
            <p className="mt-1 line-clamp-2 text-sm leading-body text-text-secondary">
              {zone.description}
            </p>
          ) : null}
        </div>
        <SafeLink href={`/z/${zone.slug}`} className="w-full">
          <Button size="sm" className="w-full gap-2">
            {t("common:open")}
            <ArrowRight aria-hidden className="size-4" />
          </Button>
        </SafeLink>
      </CardContent>
    </Card>
  );
}
