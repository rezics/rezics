import { contentDocMarkdownFallback, type RealmDTO } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { Badge, Card, CardContent } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import type React from "react";
import { unitHref } from "@/shared/ui/link";
import { getTranslation } from "@/shared/utils/translation-helpers";

interface RealmCardProps {
  realm: RealmDTO;
}

export const RealmCard: React.FC<RealmCardProps> = ({ realm }) => {
  const translation = getTranslation(realm.translations);
  const title = translation?.title ?? m.realm_untitled();
  const description = contentDocMarkdownFallback(translation?.description);

  return (
    <Card className="cursor-pointer border-0 shadow-none">
      <Link
        to={unitHref({
          type: "REALM",
          unitId: realm.unitId,
          slug: realm.slug ?? null,
        })}
        className="block w-full text-left"
      >
        <CardContent>
          <h3 className="truncate text-lg font-semibold">{title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
            {description || m.common_no_description()}
          </p>
          <div className="mt-4 flex flex-row items-center gap-2">
            <span className="text-xs text-text-secondary">
              {m.realm_member_count({ count: realm.memberCount ?? 0 })}
            </span>
            {realm.isPublic && (
              <Badge variant="outline" className="text-xs">
                {m.realm_public()}
              </Badge>
            )}
            {realm.isOfficial && (
              <Badge
                variant="outline"
                className="border-brand-fill text-text-brand text-xs"
              >
                {m.realm_official()}
              </Badge>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
};
