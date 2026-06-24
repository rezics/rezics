/**
 * My entities page showing user-owned entities with list view.
 * 展示用户拥有的实体的列表页面。
 *
 * Header with title and create button, followed by entity list or empty state.
 * 包含标题和创建按钮的头部，后面是实体列表或空状态。
 *
 * Mobile (<640px):
 * +------40px-----+
 * | Title         |  flex-wrap gap-3
 * | [New Button]  |  text-2xl font-semibold
 * |               |
 * | +---Border--- |  gap-2 list items
 * | | Entity      |  p-3 border border-whisper
 * | | Identity    |
 * | +----------+  |
 * | | Entity 2 |  rounded-md hover effect
 * | +----------+  |
 * +---------------+
 *
 * Tablet (640-1023px):
 * +-------60px-------+
 * | Title    [New]   |  flex flex-wrap
 * |                  |  max-w-4xl centered
 * | +---Entity 1---+ |
 * | | ID - Name    | |
 * | | Identity Row | |
 * | +-----------+   |
 * |                  |
 * | +---Entity 2---+ |
 * | +-----------+   |
 * +------------------+
 *
 * Desktop (1024-1535px):
 * +-------80px-------+
 * |  Title     [New] |  max-w-4xl mx-auto
 * |                  |  mb-6 spacing
 * | +---Entity 1--+ |  flex gap-2
 * | | Detailed    | |  border hover:border-strong
 * | | Identity    | |
 * | +--------+    |
 * |               |
 * | +---Entity 2+ |
 * | +--------+    |
 * +------------------+
 *
 * Ultra-wide (>=1536px):
 * +----------100px-----------+
 * |    Title           [New] |  max-w-4xl constraint
 * |                          |  px-4 py-8 padding
 * |  +----Entity Row----+    |
 * |  | Entity ID Info   |    |
 * |  +------------------+    |
 * |                          |
 * |  +----Entity Row 2---+   |
 * |  +------------------+   |
 * +------------------------+
 */

import { useEntityList } from "@rezics/contract/api/entity";
import { useCurrentUserId } from "@rezics/contract/api/hooks";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import { QueryErrorDisplay } from "@/core";
import { unitHref } from "@/shared/ui/link";
import { EntityIdentityRow } from "../components/EntityIdentityRow";

export function MyEntitiesPage() {
  const { t } = useTranslation(["entity"]);
  const currentUserUnitId = useCurrentUserId();

  const { data, isLoading, isError, error } = useEntityList(
    currentUserUnitId ? { ownerUnitId: currentUserUnitId } : undefined,
  );

  if (!currentUserUnitId) {
    return (
      <div className="w-full mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-text-secondary">
          {t("entity:login_required")}
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

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  const entities = data?.entities ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text-primary">
          {t("entity:my_entities")}
        </h1>
        <Link to="/user/me/entity/new">
          <Button>{t("entity:new_button")}</Button>
        </Link>
      </div>

      {entities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-whisper p-8 text-center">
          <p className="text-sm text-text-secondary">
            {t("entity:empty_owned")}
          </p>
          <Link to="/user/me/entity/new" className="mt-3 inline-block">
            <Button>{t("entity:declare")}</Button>
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
