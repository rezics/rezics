import { useEntityList } from "@rezics/api/entity";
import type { UnitTranslationDTO } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { unitHref } from "@rezics/ui/primitive/link";
import { Button } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { useUserProfileStore } from "@/user/states";

function getPrimaryTitle(
  translations: UnitTranslationDTO[] | undefined,
): string {
  if (!translations || translations.length === 0) return "Untitled entity";
  return translations[0]?.title?.trim() || "Untitled entity";
}

export function MyEntitiesPage() {
  const currentUserUnitId = useUserProfileStore(
    (state) => state.user?.unitId,
  ) as string | undefined;

  const { data, isLoading } = useEntityList(
    currentUserUnitId ? { ownerUnitId: currentUserUnitId } : undefined,
  );

  if (!currentUserUnitId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-text-secondary">
          Please log in to view your entities.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const entities = data?.entities ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text-primary">
          My entities
        </h1>
        <Link to="/user/me/entities/new">
          <Button>New entity</Button>
        </Link>
      </div>

      {entities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-whisper p-8 text-center">
          <p className="text-sm text-text-secondary">
            You haven&apos;t declared any entities yet.
          </p>
          <Link to="/user/me/entities/new" className="mt-3 inline-block">
            <Button>Declare an entity</Button>
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {entities.map((entity) => {
            const title = getPrimaryTitle(entity.translations);
            const href = unitHref({
              type: "ENTITY",
              unitId: entity.unitId,
              slug: entity.slug ?? null,
            });
            return (
              <li key={entity.unitId}>
                <Link
                  to={href}
                  className="flex w-full items-center gap-3 rounded-md border border-border-whisper p-3 hover:border-border-strong"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-subtle text-xs text-text-secondary">
                    {entity.avatar ? (
                      <img
                        src={entity.avatar}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      title.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="flex-1 truncate text-text-primary">
                    {title}
                  </span>
                  {entity.kind ? (
                    <span className="rounded-full border border-border-whisper px-2 py-0.5 text-xs uppercase text-text-secondary">
                      {entity.kind}
                    </span>
                  ) : null}
                  {entity.verified ? (
                    <BadgeCheck
                      className="h-4 w-4 text-text-brand"
                      aria-label="Verified entity"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
