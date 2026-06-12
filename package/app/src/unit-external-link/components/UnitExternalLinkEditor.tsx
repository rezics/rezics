import {
  useCreateUnitExternalLink,
  useDeleteUnitExternalLink,
  useUnitExternalLinks,
} from "@rezics/api/unit-external-link";
import { useEntity } from "@rezics/api/entity";
import type { UnitExternalLinkDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button, Input, Skeleton } from "@rezics/ui/shadcn";
import { ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EntityIdentityRow } from "@/entity";
import { EntityPicker } from "@/entity-picker";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * UnitExternalLinkEditor
 *
 * Mobile
 * +--------------------------------+
 * | Title                          |
 * | [Choose source entity]         |
 * | [URL input             ]       |
 * | [Add]                          |
 * | link rows stack full width      |
 * +--------------------------------+
 *
 * Tablet
 * +------------------------------------------------+
 * | Title                                          |
 * | [Choose source entity]                         |
 * | [URL input                         ] [Add]      |
 * | source name / url rows                         |
 * +------------------------------------------------+
 *
 * Desktop
 * +----------------------------------------------------------------+
 * | Title                                                          |
 * | [Choose source entity] [URL input....................] [Add]    |
 * | source name        url................................ delete   |
 * +----------------------------------------------------------------+
 *
 * Ultra-wide
 * +----------------------------------------------------------------+
 * | constrained editor width; rows keep url truncation in center    |
 * +----------------------------------------------------------------+
 *
 * 这是 UnitExternalLink 的通用编辑器。用户必须先通过 EntityPicker 选择
 * source Entity，再输入完整 URL；组件不暴露裸 entity id，也不做平台 URL
 * 识别。宽度不足时表单换行，URL 文本 `min-w-0 truncate`；固定按钮与图标
 * `shrink-0`。宽屏时容器 `w-full` 填满父级，列表行的 URL 区域承担伸展。
 */
export function UnitExternalLinkEditor({
  unitId,
  title,
  description,
}: {
  unitId: string;
  title?: string;
  description?: string;
}) {
  const { t } = useTranslation(["common", "entity"]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sourceEntityUnitId, setSourceEntityUnitId] = useState<string | null>(
    null,
  );
  const [url, setUrl] = useState("");
  const linksQuery = useUnitExternalLinks(unitId);
  const selectedEntityQuery = useEntity(sourceEntityUnitId ?? "");
  const createMutation = useCreateUnitExternalLink({
    onSuccess: () => {
      setUrl("");
      toast.success(t("common:external_links_add_success"));
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:mutation_error_generic"),
      );
    },
  });
  const deleteMutation = useDeleteUnitExternalLink({
    onSuccess: () => toast.success(t("common:external_links_remove_success")),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:mutation_error_generic"),
      );
    },
  });

  const trimmedUrl = url.trim();
  const canAdd =
    Boolean(sourceEntityUnitId) &&
    trimmedUrl.length > 0 &&
    isValidUrl(trimmedUrl) &&
    !createMutation.isPending;
  const selectedEntity = selectedEntityQuery.data;
  const sortedLinks = useMemo(
    () =>
      [...(linksQuery.data?.links ?? [])].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      ),
    [linksQuery.data?.links],
  );

  const handleAdd = async () => {
    if (!sourceEntityUnitId || !trimmedUrl) {
      toast.error(t("common:external_links_source_required"));
      return;
    }
    if (!isValidUrl(trimmedUrl)) {
      toast.error(t("common:external_links_invalid_url"));
      return;
    }
    await createMutation.mutateAsync({
      unitId,
      sourceEntityUnitId,
      url: trimmedUrl,
      role: "source",
      sortOrder: sortedLinks.length,
    });
  };

  return (
    <section className="w-full">
      <div className="mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title ?? t("common:external_links_title")}
        </h3>
        {description ? (
          <p className="mt-2 text-sm leading-ui text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs font-medium leading-dense text-text-secondary">
              {t("common:external_links_source_label")}
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full justify-start gap-2 lg:max-w-xs"
              onClick={() => setPickerOpen(true)}
            >
              <Search className="size-4 shrink-0" />
              <span className="min-w-0 truncate">
                {selectedEntity
                  ? (selectedEntity.translations?.find(
                      (translation) => translation.title,
                    )?.title ?? t("entity:untitled"))
                  : t("common:external_links_choose_source")}
              </span>
            </Button>
          </div>

          <label className="flex min-w-0 flex-[2] flex-col gap-1">
            <span className="text-xs font-medium leading-dense text-text-secondary">
              {t("common:external_links_url_label")}
            </span>
            <Input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder={t("common:external_links_url_placeholder")}
              className="h-10 w-full"
            />
          </label>

          <Button
            type="button"
            className="h-10 shrink-0"
            disabled={!canAdd}
            onClick={() => void handleAdd()}
          >
            {createMutation.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            {t("common:add")}
          </Button>
        </div>

        {sourceEntityUnitId && selectedEntity ? (
          <div className="rounded-md bg-surface-subtle p-2">
            <EntityIdentityRow entity={selectedEntity} avatarSize="sm" />
          </div>
        ) : null}

        <UnitExternalLinkRows
          links={sortedLinks}
          loading={linksQuery.isLoading}
          onDelete={(link) =>
            deleteMutation.mutate({ id: link.id, unitId: link.unitId })
          }
          deletingId={deleteMutation.variables?.id}
        />
      </div>

      <EntityPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        creationContext="catalog"
        onSelect={(entityUnitId) => {
          setSourceEntityUnitId(entityUnitId);
          return true;
        }}
      />
    </section>
  );
}

function UnitExternalLinkRows({
  links,
  loading,
  onDelete,
  deletingId,
}: {
  links: UnitExternalLinkDTO[];
  loading: boolean;
  onDelete: (link: UnitExternalLinkDTO) => void;
  deletingId?: string;
}) {
  const { t } = useTranslation(["common"]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <p className="rounded-md bg-surface-subtle px-3 py-4 text-sm leading-ui text-text-secondary">
        {t("common:external_links_empty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {links.map((link) => (
        <li
          key={link.id}
          className="flex min-w-0 flex-col gap-2 rounded-md bg-surface-subtle px-3 py-3 sm:flex-row sm:items-center"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-ui text-text-primary">
              {link.sourceEntity.name}
            </p>
            <SafeLink
              href={link.url}
              className="mt-1 block min-w-0 truncate text-xs leading-dense text-link hover:underline"
            >
              {link.url}
            </SafeLink>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SafeLink
              href={link.url}
              title={t("common:external_links_open")}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-4xl text-text-primary transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="size-4" />
            </SafeLink>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-error-text hover:text-error-text"
              aria-label={t("common:delete")}
              disabled={deletingId === link.id}
              onClick={() => onDelete(link)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
