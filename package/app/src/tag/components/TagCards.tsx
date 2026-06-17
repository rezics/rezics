import type { TagUnitDTO, UnitTagDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Badge, Card, CardContent } from "@rezics/ui/shadcn";
import type React from "react";
import { TextLink, unitHref } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

export const TagCard: React.FC<{
  tag: UnitTagDTO;
  label?: string;
  onClick?: (tag: UnitTagDTO) => void;
  selected?: boolean;
}> = ({ tag, label: labelProp, onClick, selected }) => {
  const { t } = useTranslation(["common"]);
  const label = labelProp ?? tag.tagUnitId;
  return (
    // biome-ignore lint/a11y/useSemanticElements: interactive card wrapper
    <div
      className={cn(
        "cursor-pointer transition-colors border rounded-md p-3 flex flex-col gap-1 hover:bg-surface-subtle",
        selected
          ? "border-brand-fill bg-surface-subtle"
          : "border-border-whisper",
      )}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(tag)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(tag);
        }
      }}
      data-tag-id={tag.tagUnitId}
    >
      <div className="flex items-center gap-2">
        <Badge variant={selected ? "default" : "secondary"}>{label}</Badge>
        <span className="text-xs text-text-secondary font-mono">
          {t("common:score")}: {tag.score}
        </span>
      </div>
      {tag.voteCount > 0 && (
        <div className="text-[10px] text-text-secondary mt-1">
          {tag.voteCount} {t("common:votes")}
        </div>
      )}
    </div>
  );
};

export const TagDetailCard: React.FC<{
  tag: TagUnitDTO | UnitTagDTO;
  label?: string;
}> = ({ tag, label: labelProp }) => {
  const { t } = useTranslation(["common", "community"]);
  const scored = "tagUnitId" in tag;
  const tagUnitId = scored ? tag.tagUnitId : tag.unitId;
  const label =
    labelProp ??
    (scored ? tag.tagUnitId : (tag.label ?? tag.slug ?? tag.unitId));
  const visual = scored ? null : (tag.visual ?? null);
  return (
    <Card surface="contained">
      <CardContent className="space-y-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-whisper bg-surface-base text-sm font-medium leading-ui text-text-primary"
            style={{
              backgroundColor: visual?.color ?? undefined,
            }}
          >
            {visual?.avatarUrl ? (
              <img
                src={visual.avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              label.slice(0, 2)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 truncate text-base font-semibold leading-ui text-text-primary">
              {label}
            </h3>
            <p className="m-0 truncate font-mono text-xs leading-dense text-text-tertiary">
              {tagUnitId}
            </p>
          </div>
        </div>
        <dl className="grid gap-2 text-sm leading-ui sm:grid-cols-2">
          <div>
            <dt className="text-text-secondary">{t("common:slug")}</dt>
            <dd className="m-0 text-text-primary">
              {scored ? "-" : (tag.slug ?? "-")}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">
              {t("community:tag_visual_color")}
            </dt>
            <dd className="m-0 text-text-primary">{visual?.color ?? "-"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-text-secondary">
              {t("community:tag_visual_svg_icon")}
            </dt>
            <dd className="m-0 text-text-primary">
              {visual?.iconSvg
                ? t("community:tag_visual_svg_stored")
                : t("common:none")}
            </dd>
          </div>
          {scored ? (
            <div>
              <dt className="text-text-secondary">{t("common:score")}</dt>
              <dd className="m-0 text-text-primary">{tag.score}</dd>
            </div>
          ) : null}
          {scored ? (
            <div>
              <dt className="text-text-secondary">{t("common:votes")}</dt>
              <dd className="m-0 text-text-primary">{tag.voteCount}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex flex-wrap gap-4">
          <TextLink
            to={unitHref({
              type: "TAG",
              unitId: tagUnitId,
              slug: scored ? null : (tag.slug ?? null),
            })}
            className="text-sm text-link hover:underline"
          >
            {t("community:tag_open_detail")}
          </TextLink>
        </div>
      </CardContent>
    </Card>
  );
};
