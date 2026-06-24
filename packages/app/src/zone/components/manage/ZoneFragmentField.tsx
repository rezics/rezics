import { wikiPostsByRealmQuery } from "@rezics/contract/api/post/post";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import { AppSafeLink } from "@/shared/ui/link";
import type { ZoneRefUnitMap } from "../../models/zoneMenu";
import { ManageField } from "./ZoneManageFields";

/**
 * richText `contentUnitId` field. Boundary: zone fragments are WIKI posts
 * with `visibility: "UNLISTED"`, and the public post list endpoints only
 * return PUBLIC units (`packages/server/src/post/post.service.ts`), so
 * UNLISTED fragments cannot be listed here — the raw id input is the
 * primary path for them, while the picker covers listable PUBLIC wiki
 * posts of the context realm. The "create fragment" shortcut links into
 * the realm wiki create flow; that flow has no UNLISTED-visibility preset
 * parameter yet, so authors set visibility inside the editor.
 * richText 的 `contentUnitId` 字段。边界：专区片段是
 * `visibility: "UNLISTED"` 的 WIKI 帖子，而公开帖子列表端点只返回
 * PUBLIC Unit（`packages/server/src/post/post.service.ts`），因此此处无法
 * 列出 UNLISTED 片段——原始 id 输入是它们的主要路径，选择器则覆盖语境
 * realm 中可列出的 PUBLIC wiki 帖子。「创建片段」捷径链入 realm wiki
 * 创建流程；该流程尚无 UNLISTED 可见性预设参数，作者需在编辑器内设置
 * 可见性。
 */
export function ZoneFragmentField({
  label,
  value,
  onChange,
  refUnits,
  contextRealmUnitId,
  contextRealmSlug,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  refUnits: ZoneRefUnitMap;
  contextRealmUnitId: string | null;
  contextRealmSlug: string | null;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const [open, setOpen] = useState(false);
  const preview = value ? refUnits[value]?.title : null;

  return (
    <ManageField
      label={label}
      hint={preview ?? t("zone:manage_fragment_unlisted_hint")}
    >
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("common:unit_id")}
          className="font-mono text-sm"
        />
        {contextRealmUnitId ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={t("zone:manage_fragment_pick")}
            onClick={() => setOpen(true)}
          >
            <Search className="size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
      {contextRealmSlug ? (
        <AppSafeLink
          href={`/r/${contextRealmSlug}/create?mode=wiki`}
          className="inline-flex items-center gap-1 text-xs leading-dense text-text-brand hover:underline"
        >
          <ExternalLink className="size-3" aria-hidden />
          {t("zone:manage_fragment_create")}
        </AppSafeLink>
      ) : null}
      {contextRealmUnitId ? (
        <ZoneFragmentPickerDialog
          open={open}
          onOpenChange={setOpen}
          realmUnitId={contextRealmUnitId}
          onPick={(unitId) => {
            onChange(unitId);
            setOpen(false);
          }}
        />
      ) : null}
    </ManageField>
  );
}

function ZoneFragmentPickerDialog({
  open,
  onOpenChange,
  realmUnitId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realmUnitId: string;
  onPick: (unitId: string) => void;
}) {
  const { t } = useTranslation(["zone"]);
  const wikiQuery = useQuery({
    ...wikiPostsByRealmQuery(realmUnitId, { limit: 30 }),
    enabled: open,
  });
  const posts = wikiQuery.data?.posts ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border-whisper p-4">
          <DialogTitle>{t("zone:manage_fragment_pick")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto p-3">
          {wikiQuery.isFetching ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : null}
          {!wikiQuery.isFetching && posts.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm leading-body text-text-secondary">
              {t("zone:section_empty")}
            </p>
          ) : null}
          {posts.map((post) => (
            <button
              key={post.unitId}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm leading-ui text-text-primary hover:bg-surface-subtle"
              onClick={() => onPick(post.unitId)}
            >
              <span className="truncate">{post.title ?? post.unitId}</span>
              <span className="shrink-0 font-mono text-xs text-text-tertiary">
                {post.unitId.slice(0, 8)}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
