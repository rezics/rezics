import { Badge, Card, CardContent } from "@rezics/ui/shadcn";
import type { UnitTagDTO } from "@rezics/contract";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import type React from "react";
import { cn } from "@/shared/utils/css-util";

export const TagCard: React.FC<{
  tag: UnitTagDTO;
  label?: string;
  onClick?: (tag: UnitTagDTO) => void;
  selected?: boolean;
}> = ({ tag, label: labelProp, onClick, selected }) => {
  const label = labelProp ?? tag.tagUnitId;
  return (
    // biome-ignore lint/a11y/useSemanticElements: interactive card wrapper
    <div
      className={cn(
        "cursor-pointer transition border rounded-md p-3 flex flex-col gap-1 hover:shadow-sm",
        selected
          ? "border-rezics-color-primary shadow"
          : "border-rezics-color-border",
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
        <span className="text-xs text-rezics-color-fg-muted font-mono">
          score: {tag.score}
        </span>
      </div>
      {tag.voteCount > 0 && (
        <div className="text-[10px] text-rezics-color-fg-muted mt-1">
          {tag.voteCount} votes
        </div>
      )}
    </div>
  );
};

export const TagDetailCard: React.FC<{
  tag: UnitTagDTO;
  label?: string;
  onNavigate?: (tag: UnitTagDTO) => void;
}> = ({ tag, label: labelProp }) => {
  const label = labelProp ?? tag.tagUnitId;
  return (
    <Card className="border border-rezics-color-border rounded-md shadow-none">
      <CardContent className="space-y-2">
        <h3 className="text-base font-semibold">
          {label}
          <span className="ml-2 text-xs font-normal text-rezics-color-fg-muted align-middle">
            score: {tag.score} | {tag.voteCount} votes
          </span>
        </h3>
        <div>
          <TextLink
            to={"/tag/$unitId"}
            params={{ unitId: tag.tagUnitId }}
            className="text-sm text-rezics-color-primary hover:underline"
          >
            查看详情 →
          </TextLink>
          <TextLink
            to={"/book"}
            search={{ tags: label }}
            className="text-sm text-rezics-color-primary hover:underline !ml-12"
          >
            搜索标签 →
          </TextLink>
        </div>
      </CardContent>
    </Card>
  );
};

export default TagCard;
