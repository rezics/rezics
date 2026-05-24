import { useEntityList } from "@rezics/api/entity";
import * as m from "@rezics/i18n/messages";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import { unitHref } from "@/shared/ui/link";
import { useUserProfileStore } from "@/user/states";
import { EntityIdentityRow } from "../components/EntityIdentityRow";

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
          {m.entity_login_required()}
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
          {m.entity_my_entities()}
        </h1>
        <Link to="/user/me/entities/new">
          <Button>{m.entity_new_button()}</Button>
        </Link>
      </div>

      {entities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-whisper p-8 text-center">
          <p className="text-sm text-text-secondary">
            {m.entity_empty_owned()}
          </p>
          <Link to="/user/me/entities/new" className="mt-3 inline-block">
            <Button>{m.entity_declare()}</Button>
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {entities.map((entity) => {
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
                  <EntityIdentityRow entity={entity} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
