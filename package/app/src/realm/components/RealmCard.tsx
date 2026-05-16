import type { RealmDTO } from "@rezics/contract";
import { unitHref } from "@rezics/ui/primitive/link";
import { Badge, Card, CardContent } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import type React from "react";
import { getTranslation } from "@/shared/utils/translation-helpers";

interface RealmCardProps {
  realm: RealmDTO;
}

export const RealmCard: React.FC<RealmCardProps> = ({ realm }) => {
  const translation = getTranslation(realm.translations);
  const title = translation?.title ?? "Untitled Realm";
  const description = translation?.description ?? "";

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
            {description || "No description"}
          </p>
          <div className="mt-4 flex flex-row items-center gap-2">
            <span className="text-xs text-text-secondary">
              {realm.memberCount ?? 0} members
            </span>
            {realm.isPublic && (
              <Badge variant="outline" className="text-xs">
                Public
              </Badge>
            )}
            {realm.isOfficial && (
              <Badge
                variant="outline"
                className="border-brand-fill text-text-brand text-xs"
              >
                Official
              </Badge>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
};
